import type { ModelData } from '~/data/models'

export type RankingBenchmark =
  | 'deep-swe'
  | 'terminal-bench-4-1'
  | 'terminal-bench-4-0'
  | 'aa-coding-agent'
  | 'benchlm'
  | 'estimated'
export type RankingDirection = 'asc' | 'desc'
export type RankingMetricKind = 'cost-per-success' | 'score-per-dollar' | 'score-only' | 'estimated-score-per-dollar'
export type BenchLMConfidence = 'high' | 'medium' | 'low' | 'unavailable'

export interface RankingMetric {
  value: number
  direction: RankingDirection
  kind: RankingMetricKind
  label: string
}

export interface RankingBenchmarkOption {
  value: RankingBenchmark
  label: string
  scoreLabel: string
  costLabel: string
  rankingLabel: string
  direction: RankingDirection
  metricKind: RankingMetricKind
  /** Benchmarks with measured costs only cover part of the model list. */
  measured: boolean
}

export const RANKING_BENCHMARKS: RankingBenchmarkOption[] = [
  {
    value: 'deep-swe',
    label: 'DeepSWE v1.1',
    scoreLabel: 'DeepSWE pass rate',
    costLabel: 'Cost per attempt',
    rankingLabel: 'Cost per successful task',
    direction: 'asc',
    metricKind: 'cost-per-success',
    measured: true
  },
  {
    value: 'terminal-bench-4-1',
    label: 'Terminal-Bench 4.1',
    scoreLabel: 'Terminal-Bench 4.1 score',
    costLabel: 'Cost per attempt',
    rankingLabel: 'Cost per successful task',
    direction: 'asc',
    metricKind: 'cost-per-success',
    measured: true
  },
  {
    value: 'terminal-bench-4-0',
    label: 'Terminal-Bench 4.0',
    scoreLabel: 'Terminal-Bench 4.0 score',
    costLabel: 'Cost per attempt',
    rankingLabel: 'Cost per successful task',
    direction: 'asc',
    metricKind: 'cost-per-success',
    measured: true
  },
  {
    value: 'aa-coding-agent',
    label: 'AA Coding Agent Index',
    scoreLabel: 'Coding Agent Index',
    costLabel: 'AA cost per task',
    rankingLabel: 'Coding Agent Index per dollar',
    direction: 'desc',
    metricKind: 'score-per-dollar',
    measured: true
  },
  {
    value: 'benchlm',
    label: 'BenchLM (quality only)',
    scoreLabel: 'BenchLM Coding score',
    costLabel: 'No matched cost',
    rankingLabel: 'BenchLM score (quality only)',
    direction: 'desc',
    metricKind: 'score-only',
    measured: true
  },
  {
    value: 'estimated',
    label: 'Estimated cost (all models)',
    scoreLabel: 'Intelligence Index',
    costLabel: 'Estimated cost per attempt',
    rankingLabel: 'Intelligence points per estimated dollar',
    direction: 'desc',
    metricKind: 'estimated-score-per-dollar',
    measured: false
  }
]

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function finiteCost(value: number | null | undefined): number | null {
  const cost = finiteNumber(value)
  return cost !== null && cost >= 0 ? cost : null
}

export function getBenchmarkOption(benchmark: RankingBenchmark): RankingBenchmarkOption {
  return RANKING_BENCHMARKS.find(option => option.value === benchmark) ?? RANKING_BENCHMARKS[0]!
}

/**
 * Score for the selected benchmark. BenchLM family matches and Estimated
 * evidence are excluded by default and require an explicit opt-in.
 */
export function getBenchmarkScore(
  model: ModelData,
  benchmark: RankingBenchmark,
  includeEstimated = false
): number | null {
  switch (benchmark) {
    case 'aa-coding-agent':
      return finiteNumber(model.aaCodingAgentIndex)
    case 'terminal-bench-4-1':
      return finiteNumber(model.terminalBench41Score)
    case 'terminal-bench-4-0':
      return finiteNumber(model.terminalBenchScore)
    case 'deep-swe':
      return finiteNumber(model.deepSweScore)
    case 'estimated':
      return finiteNumber(model.intelligenceIndex)
    case 'benchlm': {
      const score = finiteNumber(model.benchLmCodingScore)
      if (score === null) return null
      if (includeEstimated) return score
      return model.benchLmMatchType === 'exact' &&
        model.benchLmEvidenceStatus?.toLowerCase() === 'supported'
        ? score
        : null
    }
  }
}

export function getBenchmarkCostPerAttempt(
  model: ModelData,
  benchmark: RankingBenchmark
): number | null {
  switch (benchmark) {
    case 'aa-coding-agent':
      return finiteCost(model.aaCodingAgentCostPerTask)
    case 'terminal-bench-4-1':
      return finiteCost(model.terminalBench41CostPerTask)
    case 'terminal-bench-4-0':
      return finiteCost(model.terminalBenchCostPerTask)
    case 'deep-swe':
      return finiteCost(model.deepSweCostPerTask)
    case 'estimated':
      return finiteCost(model.estimatedCostPerTask)
    case 'benchlm':
      return null
  }
}

export function getBenchmarkCostPerSuccessfulTask(
  model: ModelData,
  benchmark: RankingBenchmark
): number | null {
  switch (benchmark) {
    case 'terminal-bench-4-1':
      return finiteCost(model.terminalBench41CostPerSuccessfulTask)
    case 'terminal-bench-4-0':
      return finiteCost(model.terminalBenchCostPerSuccessfulTask)
    case 'deep-swe':
      return finiteCost(model.deepSweCostPerSuccessfulTask)
    case 'aa-coding-agent':
    case 'benchlm':
    case 'estimated':
      return null
  }
}

/**
 * Returns only a source-aligned ranking metric. Terminal-Bench and DeepSWE
 * already account for success rate in cost/success, so their score is shown
 * separately rather than divided into that cost a second time. The estimated
 * view combines a token-price estimate with the general intelligence index and
 * is explicitly not a coding measurement.
 */
export function getBenchmarkRankingMetric(
  model: ModelData,
  benchmark: RankingBenchmark,
  includeEstimated = false
): RankingMetric | null {
  const option = getBenchmarkOption(benchmark)
  const score = getBenchmarkScore(model, benchmark, includeEstimated)
  if (score === null) return null

  switch (benchmark) {
    case 'aa-coding-agent': {
      const cost = getBenchmarkCostPerAttempt(model, benchmark)
      if (cost === null) return null
      return {
        value: cost === 0 ? (score > 0 ? Number.POSITIVE_INFINITY : 0) : score / cost,
        direction: option.direction,
        kind: option.metricKind,
        label: option.rankingLabel
      }
    }
    case 'estimated': {
      const cost = getBenchmarkCostPerAttempt(model, benchmark)
      if (cost === null) return null
      return {
        value: cost === 0 ? (score > 0 ? Number.POSITIVE_INFINITY : 0) : score / cost,
        direction: option.direction,
        kind: option.metricKind,
        label: option.rankingLabel
      }
    }
    case 'terminal-bench-4-1':
    case 'terminal-bench-4-0':
    case 'deep-swe': {
      const cost = getBenchmarkCostPerSuccessfulTask(model, benchmark)
      if (cost === null) return null
      return {
        value: cost,
        direction: option.direction,
        kind: option.metricKind,
        label: option.rankingLabel
      }
    }
    case 'benchlm':
      return {
        value: score,
        direction: option.direction,
        kind: option.metricKind,
        label: option.rankingLabel
      }
  }
}

export function getBenchLmMatchLabel(model: ModelData): string {
  if (finiteNumber(model.benchLmCodingScore) === null) return 'not available'
  if (model.benchLmMatchType === 'exact') return 'exact variant'
  if (model.benchLmMatchType === 'family') return 'base-family fallback'
  return 'match not recorded'
}

export function getBenchLmConfidence(model: ModelData): BenchLMConfidence {
  if (finiteNumber(model.benchLmCodingScore) === null) return 'unavailable'

  const supported = model.benchLmEvidenceStatus?.toLowerCase() === 'supported'
  const exact = model.benchLmMatchType === 'exact'
  if (supported && exact) return 'high'
  if (supported || exact) return 'medium'
  return 'low'
}

export function getBenchLmConfidenceLabel(model: ModelData): string {
  switch (getBenchLmConfidence(model)) {
    case 'high': return 'High confidence'
    case 'medium': return 'Medium confidence'
    case 'low': return 'Low confidence'
    default: return 'Unavailable'
  }
}

/** Aggregate cost remains for the header's source-coverage count only. */
export function getMeasuredTaskCost(model: ModelData): number | null {
  return finiteCost(model.codingAgentCostPerSuccessfulTask)
}

/** Generic cost accessor remains for coverage/buttons, never for a ranking. */
export function getTaskCost(model: ModelData): number | null {
  return finiteCost(model.aaCodingAgentCostPerTask) ?? getMeasuredTaskCost(model)
}

export function hasAnyCodingScore(model: ModelData): boolean {
  return finiteNumber(model.aaCodingAgentIndex) !== null ||
    finiteNumber(model.terminalBench41Score) !== null ||
    finiteNumber(model.terminalBenchScore) !== null ||
    finiteNumber(model.deepSweScore) !== null ||
    finiteNumber(model.benchLmCodingScore) !== null
}
