/**
 * Terminal-Bench and DeepSWE benchmark cost calculators.
 * 
 * Sources:
 * - Terminal-Bench: https://artificialanalysis.ai/evaluations/terminalbench-v4-0
 * - DeepSWE: https://deepswe.datacurve.ai/blog/deepswe-v1-1
 */

const TERMINAL_BENCH_URL = 'https://artificialanalysis.ai/evaluations/terminalbench-v4-0'
const DEEP_SWE_URL = 'https://deepswe.datacurve.ai/blog/deepswe-v1-1'
const TERMINAL_BENCH_TASK_COUNT = 66

export interface BenchmarkCost {
  costPerTask: number
  score: number | null
}

export interface CodingBenchmarkCosts {
  terminalBench: Map<string, BenchmarkCost>
  deepSwe: Map<string, BenchmarkCost>
}

// ============================================================================
// Type definitions
// ============================================================================

interface TerminalBenchModel {
  slug?: unknown
  terminalBench40?: unknown
  canonicalEvalTokenCounts?: {
    terminalBench40?: { input?: unknown; answer?: unknown; reasoning?: unknown; cacheableInput?: unknown } | null
  } | null
  price1mInputTokens?: unknown
  price1mOutputTokens?: unknown
  cacheHitPrice?: unknown
  cacheWritePrice?: unknown
  cacheHitRate?: unknown
}

// ============================================================================
// Helper functions
// ============================================================================

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function decodeEmbeddedJsonArray(
  html: string,
  marker: string,
  endMarker: string
): unknown[] {
  const startMarker = html.indexOf(marker)
  if (startMarker < 0) return []

  const arrayStart = startMarker + marker.length
  const arrayEnd = html.indexOf(endMarker, arrayStart)
  if (arrayEnd < 0) return []

  try {
    const encodedArray = html.slice(arrayStart, arrayEnd + 1)
    const decodedArray = JSON.parse(`"${encodedArray}"`) as string
    const parsed = JSON.parse(decodedArray) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ============================================================================
// Cost calculation
// ============================================================================

function calculateCostPerTask(
  tokenCounts: { input?: unknown; answer?: unknown; reasoning?: unknown; cacheableInput?: unknown },
  inputPrice: unknown,
  outputPrice: unknown,
  cacheHitPrice: unknown,
  cacheWritePrice: unknown,
  cacheHitRate: unknown,
  taskCount: number
): number | null {
  const inputTokens = asFiniteNumber(tokenCounts.input)
  const answerTokens = asFiniteNumber(tokenCounts.answer)
  const reasoningTokens = asFiniteNumber(tokenCounts.reasoning)
  const inputPricePerMillion = asFiniteNumber(inputPrice)
  const outputPricePerMillion = asFiniteNumber(outputPrice)

  if (
    inputTokens === null ||
    answerTokens === null ||
    reasoningTokens === null ||
    inputPricePerMillion === null ||
    outputPricePerMillion === null ||
    taskCount <= 0
  ) {
    return null
  }

  const cacheableInput = asFiniteNumber(tokenCounts.cacheableInput)

  if (cacheableInput !== null) {
    const hitRate = asFiniteNumber(cacheHitRate)
    const cacheHitPricePerMillion = asFiniteNumber(cacheHitPrice)
    const cacheWritePricePerMillion = asFiniteNumber(cacheWritePrice)

    if (hitRate === null || cacheHitPricePerMillion === null || cacheWritePricePerMillion === null) {
      return null
    }

    const cacheReadTokens = cacheableInput * hitRate
    const cacheWriteTokens = inputTokens - cacheReadTokens
    if (cacheWriteTokens < 0) return null

    const totalCost =
      cacheReadTokens / 1_000_000 * cacheHitPricePerMillion +
      cacheWriteTokens / 1_000_000 * cacheWritePricePerMillion +
      (answerTokens + reasoningTokens) / 1_000_000 * outputPricePerMillion

    return totalCost / taskCount
  }

  const totalCost =
    inputTokens / 1_000_000 * inputPricePerMillion +
    (answerTokens + reasoningTokens) / 1_000_000 * outputPricePerMillion

  return totalCost / taskCount
}

// ============================================================================
// Terminal-Bench fetcher
// ============================================================================

async function fetchTerminalBenchCosts(): Promise<Map<string, BenchmarkCost>> {
  const html = await $fetch<string>(TERMINAL_BENCH_URL)
  const models = decodeEmbeddedJsonArray(
    html,
    '\\"initialModels\\":',
    '],\\"defaultSlugs'
  ) as TerminalBenchModel[]
  const costs = new Map<string, BenchmarkCost>()

  for (const model of models) {
    if (typeof model.slug !== 'string') continue
    const tokenCounts = model.canonicalEvalTokenCounts?.terminalBench40
    if (!tokenCounts) continue

    const costPerTask = calculateCostPerTask(
      tokenCounts,
      model.price1mInputTokens,
      model.price1mOutputTokens,
      model.cacheHitPrice,
      model.cacheWritePrice,
      model.cacheHitRate,
      TERMINAL_BENCH_TASK_COUNT
    )

    if (costPerTask !== null && costPerTask >= 0) {
      const rawScore = asFiniteNumber(model.terminalBench40)
      const score = rawScore === null ? null : rawScore <= 1 ? rawScore * 100 : rawScore
      costs.set(model.slug, { costPerTask, score })
    }
  }

  return costs
}

// ============================================================================
// DeepSWE fetcher
// ============================================================================

function normalizeEffort(value: string): string {
  return value.toLowerCase() === 'x-high' ? 'xhigh' : value.toLowerCase()
}

function getModelEffort(name: string): string {
  const normalized = name.toLowerCase()
  for (const effort of ['xhigh', 'high', 'medium', 'low']) {
    if (normalized.includes(effort)) return effort
  }
  return 'max'
}

function getDeepSweBaseSlug(slug: string): string {
  return slug.replace(/-(xhigh|high|medium|low)$/, '')
}

function parseDeepSweRows(html: string): Map<string, BenchmarkCost> {
  const costs = new Map<string, BenchmarkCost>()
  const rowPattern = /model:"([^"]+)"[^}]*?reasoning_effort:"([^"]+)"[^}]*?pass_rate:([0-9.eE+-]+)[^}]*?mean_cost_usd:([0-9.eE+-]+)/gs

  for (const match of html.matchAll(rowPattern)) {
    const model = match[1]
    const rawEffort = match[2]
    const rawScore = match[3]
    const rawCost = match[4]
    if (!model || !rawEffort || !rawScore || !rawCost) continue

    const effort = normalizeEffort(rawEffort)
    const costPerTask = Number(rawCost)
    const score = Number(rawScore)
    if (!Number.isFinite(costPerTask) || costPerTask < 0 || !Number.isFinite(score)) continue
    costs.set(`${model}|${effort}`, { costPerTask, score: score * 100 })
  }

  return costs
}

async function fetchDeepSweCosts(): Promise<Map<string, BenchmarkCost>> {
  const html = await $fetch<string>(DEEP_SWE_URL)
  const rows = parseDeepSweRows(html)
  const costs = new Map<string, BenchmarkCost>()

  for (const [key, cost] of rows) {
    const separator = key.lastIndexOf('|')
    const model = key.slice(0, separator)
    const effort = key.slice(separator + 1)
    costs.set(`${model}|${effort}`, cost)
  }

  return costs
}

// ============================================================================
// Public API
// ============================================================================

export function getDeepSweBenchmark(
  modelSlug: string,
  modelName: string,
  costs: Map<string, BenchmarkCost>
): BenchmarkCost | null {
  const effort = getModelEffort(modelName)
  return costs.get(`${getDeepSweBaseSlug(modelSlug)}|${effort}`) ?? null
}

export function getDeepSweCost(
  modelSlug: string,
  modelName: string,
  costs: Map<string, BenchmarkCost>
): number | null {
  return getDeepSweBenchmark(modelSlug, modelName, costs)?.costPerTask ?? null
}

export function averageBenchmarkCosts(costs: Array<number | null | undefined>): number | null {
  const available = costs.filter((cost): cost is number =>
    typeof cost === 'number' && Number.isFinite(cost) && cost >= 0
  )
  if (available.length === 0) return null
  return available.reduce((sum, cost) => sum + cost, 0) / available.length
}

export async function fetchCodingBenchmarkCosts(): Promise<CodingBenchmarkCosts> {
  const [terminalBench, deepSwe] = await Promise.all([
    fetchTerminalBenchCosts().catch(error => {
      console.warn('Failed to fetch Terminal-Bench costs:', error)
      return new Map<string, BenchmarkCost>()
    }),
    fetchDeepSweCosts().catch(error => {
      console.warn('Failed to fetch DeepSWE costs:', error)
      return new Map<string, BenchmarkCost>()
    })
  ])

  return { terminalBench, deepSwe }
}

export function costPerSuccessfulTask(
  costPerTask: number | null | undefined,
  score: number | null | undefined
): number | null {
  if (
    typeof costPerTask !== 'number' || !Number.isFinite(costPerTask) || costPerTask < 0 ||
    typeof score !== 'number' || !Number.isFinite(score) || score <= 0
  ) {
    return null
  }

  const successRate = score > 1 ? score / 100 : score
  return successRate > 0 ? costPerTask / successRate : null
}
