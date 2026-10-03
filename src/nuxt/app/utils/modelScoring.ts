import type { ModelData } from '~/data/models'

export type CodingCostType = 'measured-coding' | 'unknown'
export type CodingConfidence = 'high' | 'medium' | 'low' | 'unavailable'

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function finiteCost(value: number | null | undefined): number | null {
  const cost = finiteNumber(value)
  return cost !== null && cost >= 0 ? cost : null
}

/**
 * Primary coding score from the Artificial Analysis Coding Agent Index.
 * This is the AA-published composite score combining DeepSWE, SWE-Atlas-QnA, and Terminal-Bench.
 */
export function getAaCodingAgentIndex(model: ModelData): number | null {
  return finiteNumber(model.aaCodingAgentIndex)
}

/**
 * Terminal-Bench 4.0 score (supplementary evidence).
 */
export function getTerminalBenchCodingScore(model: ModelData): number | null {
  return finiteNumber(model.terminalBenchScore)
}

/**
 * BenchLM Coding score (supplementary evidence).
 */
export function getBenchLmCodingScore(model: ModelData): number | null {
  return finiteNumber(model.benchLmCodingScore)
}

/**
 * The primary coding score used for ranking.
 * Prefers the AA Coding Agent Index; falls back to individual benchmark scores if unavailable.
 */
export function getCodingScore(model: ModelData): number | null {
  // Primary: AA Coding Agent Index
  const aaIndex = getAaCodingAgentIndex(model)
  if (aaIndex !== null) return aaIndex

  // Fallback: average of available individual scores
  const scores = [
    getTerminalBenchCodingScore(model),
    getBenchLmCodingScore(model)
  ].filter((score): score is number => score !== null)

  if (scores.length === 0) return null
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

export function getCombinedCodingScore(model: ModelData): number | null {
  return getCodingScore(model)
}

/** Cost per task from AA Coding Agent Index. */
export function getAaCodingAgentCost(model: ModelData): number | null {
  return finiteCost(model.aaCodingAgentCostPerTask)
}

/** Legacy measured task cost from benchmark-specific sources. */
export function getMeasuredTaskCost(model: ModelData): number | null {
  return finiteCost(model.codingAgentCostPerSuccessfulTask)
}

export function getTaskCost(model: ModelData): number | null {
  // Primary: AA Coding Agent Index cost
  const aaCost = getAaCodingAgentCost(model)
  if (aaCost !== null) return aaCost

  // Fallback: measured coding benchmark costs
  return getMeasuredTaskCost(model)
}

export function getCodingCostType(model: ModelData): CodingCostType {
  if (getAaCodingAgentCost(model) !== null || getMeasuredTaskCost(model) !== null) {
    return 'measured-coding'
  }
  return 'unknown'
}

export function getTaskCostSource(model: ModelData): CodingCostType {
  return getCodingCostType(model)
}

export function hasMeasuredCodingCost(model: ModelData): boolean {
  return getAaCodingAgentCost(model) !== null || getMeasuredTaskCost(model) !== null
}

export function getCodingCostLabel(model: ModelData): string {
  const hasAaIndex = getAaCodingAgentIndex(model) !== null
  const hasTerminalBench = finiteCost(model.terminalBenchCostPerSuccessfulTask) !== null
  const hasDeepSwe = finiteCost(model.deepSweCostPerSuccessfulTask) !== null

  if (hasAaIndex) return 'AA Coding Agent Index'
  if (hasTerminalBench && hasDeepSwe) return 'Terminal-Bench + DeepSWE average'
  if (hasTerminalBench) return 'Terminal-Bench 4.0'
  if (hasDeepSwe) return 'DeepSWE v1.1'
  return 'Unavailable'
}

export function getBenchLmMatchLabel(model: ModelData): string {
  if (getBenchLmCodingScore(model) === null) return 'not available'
  if (model.benchLmMatchType === 'exact') return 'exact variant'
  if (model.benchLmMatchType === 'family') return 'base-family fallback'
  return 'match not recorded'
}

export function getCodingConfidence(model: ModelData): CodingConfidence {
  const score = getCodingScore(model)
  if (score === null) return 'unavailable'

  // AA Coding Agent Index is the highest confidence source
  if (getAaCodingAgentIndex(model) !== null) return 'high'

  // Individual benchmark scores
  const benchLmScore = getBenchLmCodingScore(model)
  if (benchLmScore === null) return 'medium'

  const benchLmSupported = model.benchLmEvidenceStatus?.toLowerCase() === 'supported'
  const benchLmExact = model.benchLmMatchType === 'exact'

  if (benchLmSupported && benchLmExact) return 'high'
  if (benchLmSupported || benchLmExact) return 'medium'
  return 'low'
}

export function getCodingConfidenceLabel(model: ModelData): string {
  switch (getCodingConfidence(model)) {
    case 'high': return 'High confidence'
    case 'medium': return 'Medium confidence'
    case 'low': return 'Low confidence'
    default: return 'Unavailable'
  }
}

/**
 * Coding Value = Coding Score / Cost per Task
 * Higher is better (more coding capability per dollar).
 */
export function getCodingValue(model: ModelData): number | null {
  const codingScore = getCodingScore(model)
  const taskCost = getTaskCost(model)

  if (codingScore === null || taskCost === null) return null
  if (taskCost === 0) return Infinity
  return codingScore / taskCost
}

export function getMeasuredCodingValue(model: ModelData): number | null {
  return getCodingValue(model)
}

/**
 * Check if model has rankable coding evidence.
 * Uses AA Coding Agent Index if available, or individual benchmark scores.
 */
export function hasRankableCodingEvidence(model: ModelData, includeEstimated = false): boolean {
  const score = getCodingScore(model)
  if (score === null) return false

  // If using AA Coding Agent Index, it's always rankable
  if (getAaCodingAgentIndex(model) !== null) return true

  // For individual benchmark fallback, respect the Estimated filter
  if (!includeEstimated) {
    const benchLmScore = getBenchLmCodingScore(model)
    if (benchLmScore !== null) {
      return model.benchLmEvidenceStatus?.toLowerCase() === 'supported'
    }
  }

  return true
}

export function getRankingCodingValue(
  model: ModelData,
  includeEstimated = false
): number | null {
  if (!hasRankableCodingEvidence(model, includeEstimated)) return null
  return getCodingValue(model)
}

export function hasTaskCost(model: ModelData): boolean {
  return getAaCodingAgentCost(model) !== null || getMeasuredTaskCost(model) !== null
}
