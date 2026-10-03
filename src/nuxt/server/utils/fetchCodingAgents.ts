/**
 * Fetches AA Coding Agent Index using Playwright to render JavaScript.
 * Extracts data from Next.js RSC payload in script tags.
 */

import { chromium } from 'playwright'

export interface CodingAgentBenchmark {
  agentName: string
  provider: string
  model: string
  hostModelSlug: string
  indexScore: number | null
  deepSweScore: number | null
  sweAtlasScore: number | null
  terminalBenchScore: number | null
  costPerTask: number | null
  inputTokens: number | null
  outputTokens: number | null
  cacheHitRate: number | null
  isDefault: boolean
  isHighlighted: boolean
}

const AA_CODING_AGENTS_URL = 'https://artificialanalysis.ai/agents/coding-agents'

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseFirstCapture(pattern: RegExp, text: string): number | null {
  const match = pattern.exec(text)
  if (match && match[1] !== undefined) {
    return asFiniteNumber(match[1])
  }
  return null
}

/**
 * Extracts agents from a script content that contains RSC data.
 * The data contains patterns like:
 * "agentName":"Muse Code","provider":"meta","hostModelSlug":"meta_aa_glacier135"
 */
function extractAgentsFromScript(scriptContent: string): CodingAgentBenchmark[] {
  const results: CodingAgentBenchmark[] = []
  
  // Pattern to match agent entries in the script
  // The script contains data like: "agentName":"Muse Code","provider":"meta","hostModelSlug":"meta_aa_glacier135"
  const agentPattern = /"agentName":"([^"]+)","provider":"([^"]+)","hostModelSlug":"([^"]+)"/g
  
  let match
  while ((match = agentPattern.exec(scriptContent)) !== null) {
    const agentName = String(match[1] ?? '')
    const provider = String(match[2] ?? '')
    const hostModelSlug = String(match[3] ?? '')
    
    // Skip empty matches
    if (!agentName || !provider) continue
    
    // Get context for this agent
    const agentStart = match.index
    const nextAgent = scriptContent.indexOf('"agentName":"', agentStart + 100)
    const agentEnd = nextAgent > 0 ? nextAgent : scriptContent.length
    const agentContext = scriptContent.slice(agentStart, agentEnd)
    
    // Extract model from display
    const modelMatch = /"model":"([^"]+)"/.exec(agentContext)
    const model = String(modelMatch?.[1] ?? '')
    
    // Extract indexScore
    const indexScore = parseFirstCapture(/"indexScore":([0-9.]+)/, agentContext)
    
    // Extract costUsd
    const costPerTask = parseFirstCapture(/"costUsd":([0-9.]+)/, agentContext)
    
    // Extract cacheHitRate
    const cacheHitRate = parseFirstCapture(/"cacheHitRate":([0-9.]+)/, agentContext)
    
    // Extract isDefault and isHighlighted
    const isDefault = agentContext.includes('"isDefault":true')
    const isHighlighted = agentContext.includes('"isHighlighted":true')
    
    // Extract evals
    let deepSweScore: number | null = null
    let sweAtlasScore: number | null = null
    let terminalBenchScore: number | null = null
    
    const evalsMatch = /"evals":\[(.*?)\]/.exec(agentContext)
    if (evalsMatch && evalsMatch[1]) {
      const evalsContent = evalsMatch[1]
      deepSweScore = parseFirstCapture(/"deep-swe-v1.1"[^}]*"reward":([0-9.]+)/, evalsContent)
      sweAtlasScore = parseFirstCapture(/"swe-atlas-qna"[^}]*"reward":([0-9.]+)/, evalsContent)
      terminalBenchScore = parseFirstCapture(/"terminal-bench-v4"[^}]*"reward":([0-9.]+)/, evalsContent)
    }
    
    results.push({
      agentName,
      provider,
      model,
      hostModelSlug,
      indexScore,
      deepSweScore,
      sweAtlasScore,
      terminalBenchScore,
      costPerTask,
      inputTokens: null,
      outputTokens: null,
      cacheHitRate,
      isDefault,
      isHighlighted
    })
  }
  
  return results
}

// Cache for parsed results
let cachedAgents: CodingAgentBenchmark[] | null = null
let lastFetchTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetches the AA Coding Agent Index data using Playwright.
 */
export async function fetchCodingAgentBenchmarks(
  forceRefresh = false
): Promise<CodingAgentBenchmark[]> {
  const now = Date.now()

  if (!forceRefresh && cachedAgents && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedAgents
  }

  let browser = null
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    await page.goto(AA_CODING_AGENTS_URL, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    })
    
    // Wait a bit more for React to finish rendering
    await page.waitForTimeout(10000)
    
    // Extract data from script tags
    const agents = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script')
      
      for (const script of scripts) {
        const content = script.textContent || ''
        
        // Look for scripts that contain agent data
        if (content.includes('"agentName"') && 
            content.includes('"provider"') &&
            content.includes('"hostModelSlug"') &&
            content.includes('"Muse Code"')) {
          return content
        }
      }
      
      return null
    })
    
    if (agents && typeof agents === 'string') {
      cachedAgents = extractAgentsFromScript(agents)
      lastFetchTime = now
      console.log(`[CodingAgentIndex] Fetched ${cachedAgents.length} agents via Playwright`)
      return cachedAgents
    }
    
    // If no data found, return empty array
    console.warn('[CodingAgentIndex] No agents found on page')
    return cachedAgents || []
    
  } catch (error) {
    console.error('[CodingAgentIndex] Playwright error:', error)
    return cachedAgents || []
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

/**
 * Finds a coding agent benchmark entry by model name or slug.
 */
export function findCodingAgentBenchmark(
  agents: CodingAgentBenchmark[],
  modelName: string,
  modelSlug?: string
): CodingAgentBenchmark | null {
  const normalizedName = modelName.toLowerCase()

  for (const agent of agents) {
    const agentName = agent.agentName.toLowerCase()
    const provider = agent.provider.toLowerCase()
    const model = agent.model.toLowerCase()

    // Check for agent name match with provider
    if (normalizedName.includes(agentName) || agentName.includes(normalizedName)) {
      if (normalizedName.includes(provider) || provider.includes(normalizedName)) {
        return agent
      }
      if (normalizedName.includes(model) || model.includes(normalizedName)) {
        return agent
      }
    }

    // Direct model slug match
    if (modelSlug && agent.hostModelSlug.toLowerCase().includes(modelSlug.toLowerCase())) {
      return agent
    }
  }

  return null
}
