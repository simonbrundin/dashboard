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
    scoreLabel: 'DeepSWE-andel lösade',
    costLabel: 'Kostnad per försök',
    rankingLabel: 'Kostnad per lyckad uppgift',
    direction: 'asc',
    metricKind: 'cost-per-success',
    measured: true
  },
  {
    value: 'terminal-bench-4-1',
    label: 'Terminal-Bench 4.1',
    scoreLabel: 'Terminal-Bench 4.1-poäng',
    costLabel: 'Kostnad per försök',
    rankingLabel: 'Kostnad per lyckad uppgift',
    direction: 'asc',
    metricKind: 'cost-per-success',
    measured: true
  },
  {
    value: 'terminal-bench-4-0',
    label: 'Terminal-Bench 4.0',
    scoreLabel: 'Terminal-Bench 4.0-poäng',
    costLabel: 'Kostnad per försök',
    rankingLabel: 'Kostnad per lyckad uppgift',
    direction: 'asc',
    metricKind: 'cost-per-success',
    measured: true
  },
  {
    value: 'aa-coding-agent',
    label: 'AA Coding Agent Index',
    scoreLabel: 'Coding Agent Index-poäng',
    costLabel: 'AA-kostnad per försök',
    rankingLabel: 'Coding Agent Index per dollar',
    direction: 'desc',
    metricKind: 'score-per-dollar',
    measured: true
  },
  {
    value: 'benchlm',
    label: 'BenchLM (endast kvalitet)',
    scoreLabel: 'BenchLM-kodpoäng',
    costLabel: 'Ingen matchad kostnad',
    rankingLabel: 'BenchLM-poäng (endast kvalitet)',
    direction: 'desc',
    metricKind: 'score-only',
    measured: true
  },
  {
    value: 'estimated',
    label: 'Uppskattad kostnad (alla modeller)',
    scoreLabel: 'Intelligence Index',
    costLabel: 'Uppskattad kostnad per försök',
    rankingLabel: 'Intelligence-poäng per uppskattad dollar',
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

// ============================================================================
// Budget finder: cheapest models that still clear a quality threshold
// ============================================================================

export interface BudgetSourceOption {
  value: RankingBenchmark
  label: string
  count: number
  costLabel: string
}

/** Sources usable for the budget finder: code scores with their own costs. */
export function getBudgetSourceOptions(models: ModelData[]): BudgetSourceOption[] {
  const countWithScore = (benchmark: RankingBenchmark): number =>
    models.filter(model => getBenchmarkScore(model, benchmark, true) !== null).length

  return [
    {
      value: 'aa-coding-agent',
      label: 'AA Coding Agent Index',
      count: countWithScore('aa-coding-agent'),
      costLabel: 'AA agent cost per task'
    },
    {
      value: 'terminal-bench-4-1',
      label: 'Terminal-Bench 4.1',
      count: countWithScore('terminal-bench-4-1'),
      costLabel: 'Kostnad per lyckad uppgift'
    },
    {
      value: 'terminal-bench-4-0',
      label: 'Terminal-Bench 4.0',
      count: countWithScore('terminal-bench-4-0'),
      costLabel: 'Kostnad per lyckad uppgift'
    },
    {
      value: 'deep-swe',
      label: 'DeepSWE v1.1',
      count: countWithScore('deep-swe'),
      costLabel: 'Kostnad per lyckad uppgift'
    },
    {
      value: 'estimated',
      label: 'Intelligence Index (uppskattad)',
      count: countWithScore('estimated'),
      costLabel: 'Uppskattad kostnad per försök'
    }
  ]
}

/** The measured cost that belongs to the budget source itself. */
function getBudgetSourceCost(model: ModelData, benchmark: RankingBenchmark): number | null {
  switch (benchmark) {
    case 'aa-coding-agent':
      return finiteCost(model.aaCodingAgentCostPerTask)
    case 'terminal-bench-4-1':
      return finiteCost(model.terminalBench41CostPerSuccessfulTask)
    case 'terminal-bench-4-0':
      return finiteCost(model.terminalBenchCostPerSuccessfulTask)
    case 'deep-swe':
      return finiteCost(model.deepSweCostPerSuccessfulTask)
    case 'benchlm':
    case 'estimated':
      return null
  }
}

export interface BudgetFinderRow {
  model: ModelData
  quality: number
  /** The shown cost: measured for the source, or a token-price estimate. */
  cost: number | null
  costIsEstimated: boolean
  /** Percent cheaper than the reference, same cost kind only. */
  savingsPct: number | null
}

export interface BudgetFinderResult {
  reference: ModelData | null
  threshold: number | null
  referenceCost: number | null
  referenceCostIsEstimated: boolean
  /** Candidates with a measured source cost, cheapest first. */
  measuredRows: BudgetFinderRow[]
  /** Candidates without a measured cost, ranked by token-price estimate. */
  estimatedRows: BudgetFinderRow[]
}

function budgetSavings(referenceCost: number | null, row: BudgetFinderRow, sameKind: boolean): number | null {
  if (referenceCost === null || !sameKind || referenceCost <= 0) return null
  if (row.cost === null) return null
  return Math.round(((referenceCost - row.cost) / referenceCost) * 100)
}

/**
 * Answers "which is the cheapest model that is still smart enough": models
 * scoring at least as high as the reference on the same source, cheapest
 * first. Measured source costs are kept strictly separate from token-price
 * estimates.
 */
export function findCheapestSufficient(
  models: ModelData[],
  benchmark: RankingBenchmark,
  referenceSlug: string | null,
  includeEstimatedScores = false
): BudgetFinderResult {
  const reference = referenceSlug
    ? models.find(model => model.slug === referenceSlug) ?? null
    : null
  const threshold = reference ? getBenchmarkScore(reference, benchmark, includeEstimatedScores) : null

  if (reference === null || threshold === null) {
    return {
      reference,
      threshold: null,
      referenceCost: null,
      referenceCostIsEstimated: false,
      measuredRows: [],
      estimatedRows: []
    }
  }

  const allEstimated = benchmark === 'estimated'
  const candidates = models
    .filter(model => getBenchmarkScore(model, benchmark, includeEstimatedScores) !== null)

  const measuredRows: BudgetFinderRow[] = []
  const estimatedRows: BudgetFinderRow[] = []

  for (const model of candidates) {
    const quality = getBenchmarkScore(model, benchmark, includeEstimatedScores)
    if (quality === null || quality < threshold) continue

    const measured = getBudgetSourceCost(model, benchmark)
    const estimate = finiteCost(model.estimatedCostPerTask)

    if (allEstimated || measured === null) {
      // No source cost: the estimate is the honest fallback.
      if (estimate === null) continue
      const row: BudgetFinderRow = {
        model,
        quality,
        cost: estimate,
        costIsEstimated: true,
        savingsPct: null
      }
      const referenceRow = allEstimated && model.slug === referenceSlug ? row : null
      if (referenceRow) {
        referenceRow.savingsPct = 0
      }
      estimatedRows.push(row)
      continue
    }

    measuredRows.push({
      model,
      quality,
      cost: measured,
      costIsEstimated: false,
      savingsPct: null
    })
  }

  const finalize = (rows: BudgetFinderRow[]): BudgetFinderRow[] => {
    rows.sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity))
    return rows.map(row => ({
      ...row,
      savingsPct: budgetSavings(referenceCost, row, row.costIsEstimated === referenceCostIsEstimated)
    }))
  }

  const referenceMeasured = getBudgetSourceCost(reference, benchmark)
  const referenceCostIsEstimated = allEstimated || referenceMeasured === null
  const referenceCost = referenceCostIsEstimated
    ? finiteCost(reference.estimatedCostPerTask)
    : referenceMeasured

  // Fill in savings now that the reference cost kind is known.
  const withSavings = (rows: BudgetFinderRow[]): BudgetFinderRow[] =>
    rows.map(row => ({
      ...row,
      savingsPct: budgetSavings(referenceCost ?? 0, row, row.costIsEstimated === referenceCostIsEstimated)
    }))

  return {
    reference,
    threshold,
    referenceCost,
    referenceCostIsEstimated,
    measuredRows: finalize(withSavings(measuredRows)),
    estimatedRows: finalize(withSavings(estimatedRows))
  }
}
