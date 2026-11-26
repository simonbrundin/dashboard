/**
 * Artificial Analysis Coding Agent Index.
 *
 * The public leaderboard embeds its data in the Next.js flight payload. The
 * rows contain the agent, the model configuration, the index score and the
 * measured cost of the agent run, so score and cost always come from the same
 * agent/model pair.
 */

const AA_CODING_AGENTS_URL = 'https://artificialanalysis.ai/agents/coding-agents'

export interface CodingAgentBenchmark {
  agentName: string
  provider: string
  /** Model configuration label, e.g. "Gemini 4 Neon (Xhigh)". */
  modelName: string
  /** Reasoning effort of the configuration, e.g. "xhigh". */
  effort: string
  /** Coding Agent Index score on a 0-100 scale. */
  indexScore: number | null
  /** Measured cost of the agent run in USD. */
  costPerTask: number | null
  isDefault: boolean
}

const ROWS_MARKER = '\\"rows\\":['

function extractSection(text: string, startIndex: number, maxLength: number): string {
  const segment = text.slice(startIndex, startIndex + maxLength)
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < segment.length; i++) {
    const char = segment[i]!

    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') inString = true
    else if (char === '[') depth++
    else if (char === ']') {
      depth--
      if (depth === 0) return segment.slice(0, i + 1)
    }
  }

  return segment
}

function matchNumber(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text)
  if (!match?.[1]) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function matchString(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text)
  return match?.[1] ?? null
}

/**
 * Parses the agent rows from the embedded flight payload. Each row is parsed
 * independently so a single malformed row cannot hide the rest.
 */
export function parseCodingAgentRows(html: string): CodingAgentBenchmark[] {
  const rowsIndex = html.indexOf(ROWS_MARKER)
  if (rowsIndex < 0) return []

  const start = rowsIndex + ROWS_MARKER.length - 1
  const rawSection = extractSection(html, start, 2_000_000)
  const markers = [...rawSection.matchAll(/\\"agentName\\":\\"/g)]
  const agents: CodingAgentBenchmark[] = []

  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index]!
    const chunkStart = marker.index!
    const chunkEnd = markers[index + 1]?.index ?? rawSection.length
    const chunk = rawSection.slice(chunkStart, chunkEnd)

    const agentName = matchString(chunk, /\\"agentName\\":\\"([^"]*)\\"/)
    if (!agentName) continue

    const provider = matchString(chunk, /\\"provider\\":\\"([^"]*)\\"/) ?? ''
    const modelName = matchString(
      chunk,
      /\\"display\\":\{\\"agent\\":\\"[^"]*\\",\\"model\\":\\"([^"]*)\\"/
    ) ?? matchString(chunk, /\\"model\\":\{[^}]*?\\"name\\":\\"([^"]*)\\"/)
    if (!modelName) continue

    const effort = matchString(chunk, /\\"effort\\":\{\\"slug\\":\\"([^"]*)\\"/) ?? 'max'
    const indexScore = matchNumber(chunk, /\\"indexScore\\":([0-9.]+)/)
    const costPerTask = matchNumber(chunk, /\\"mean\\":\{[^}]*?\\"costUsd\\":([0-9.]+)/)
    const isDefault = matchString(chunk, /\\"isDefault\\":(true|false)/) === 'true'

    agents.push({
      agentName,
      provider,
      modelName,
      effort,
      indexScore: indexScore === null ? null : indexScore <= 1 ? indexScore * 100 : indexScore,
      costPerTask,
      isDefault
    })
  }

  return agents
}

let cachedAgents: CodingAgentBenchmark[] | null = null
let lastFetchTime = 0
const CACHE_TTL_MS = 60 * 60 * 1000

/** Fetches the Coding Agent Index rows from the public leaderboard. */
export async function fetchCodingAgentBenchmarks(
  forceRefresh = false
): Promise<CodingAgentBenchmark[]> {
  const now = Date.now()

  if (!forceRefresh && cachedAgents && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedAgents
  }

  try {
    const html = await $fetch<string>(AA_CODING_AGENTS_URL)
    const agents = parseCodingAgentRows(html)
    cachedAgents = agents
    lastFetchTime = now
    console.log(`[CodingAgentIndex] Parsed ${agents.length} agent rows`)
    return agents
  } catch (error) {
    console.error('[CodingAgentIndex] Fetch failed:', error)
    return cachedAgents ?? []
  }
}

export interface CodingAgentSelection {
  benchmark: CodingAgentBenchmark
  /** True when the agent is the leaderboard's default for the model. */
  isDefault: boolean
}

/**
 * Picks the agent row that represents a model: the highest index score, and
 * for equal scores the cheapest run. Score and cost always come from the same
 * agent run.
 */
export function selectBestAgentForModel(
  agents: CodingAgentBenchmark[],
  modelName: string
): CodingAgentSelection | null {
  const candidates = agents.filter(agent => agent.modelName === modelName && agent.indexScore !== null)
  if (candidates.length === 0) return null

  const best = candidates.reduce((winner, agent) => {
    const winnerScore = winner.indexScore ?? -Infinity
    const agentScore = agent.indexScore ?? -Infinity
    if (agentScore > winnerScore) return agent
    if (agentScore === winnerScore) {
      return (agent.costPerTask ?? Infinity) < (winner.costPerTask ?? Infinity) ? agent : winner
    }
    return winner
  })

  return {
    benchmark: best,
    isDefault: best.isDefault
  }
}
