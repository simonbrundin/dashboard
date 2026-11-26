import type { ModelData } from '~/data/models'
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '~/data/subscriptions'
import { formatModelName, getReasoningEffort } from '~/utils/modelFormatters'
import { computePlanCost, computeApiCreditCoverage } from '~/utils/planCost'
import {
  AGENT_BENCHMARKS,
  costPerSolvedTaskFrom,
  getAgentBenchmark,
  resolveCostBasis,
  type AgentBenchmark,
  type AgentBenchmarkId
} from '~/utils/agentBenchmarks'

export interface RecommendationOption {
  kind: 'plan' | 'api'
  label: string
  model: ModelData
  plan?: SubscriptionPlan
  /**
   * The ranking metric: cost per successful task when the benchmark has a
   * pass rate, otherwise cost per attempt.
   */
  costPerTask: number
  /** True when the metric is cost per attempt rather than per solved task. */
  costIsPerAttempt: boolean
  /** Cost of a single attempt, when the benchmark publishes it. */
  costPerAttempt: number | null
  /** The benchmark's score for this option's model. */
  score: number | null
  /** Pass rate in percent, when the benchmark has one. */
  passRate: number | null
  /** Lower bound of the published confidence interval on the score, in percent. */
  ciLow: number | null
  /** Upper bound of the published confidence interval on the score, in percent. */
  ciHigh: number | null
  /** The agent/harness that produced the measurement. */
  agent: string | null
  /** The raw measured API cost for the same task without any plan. */
  apiCostPerTask: number
  /** Monthly agent tasks where the plan price equals the API cost. */
  breakEvenTasksPerMonth: number | null
  /** The cost is a token-price estimate, not a measured agent run. */
  apiCostIsEstimated: boolean
  /** The model's quality level is measured in the chosen benchmark. */
  qualityKnown: boolean
  /** Agent tasks the plan's included allowance covers, when quantifiable. */
  includedTasksPerMonth?: number | null
  /** True when the cost per task only holds while the plan's limits hold. */
  costIsLowerBound?: boolean
  /** How the plan's usage limit was applied. */
  quotaKind?: 'credits-usd' | 'quota-units' | 'soft-limits' | 'none'
  /** API credits included with the plan, in USD per month. */
  apiCreditsUsdPerMonth?: number | null
  /** True when the usage exceeds the plan's included allowance. */
  hasOverage?: boolean
}

export interface Recommendation {
  /** The benchmark the threshold and the costs come from. */
  benchmark: AgentBenchmark | null
  threshold: number | null
  reference: ModelData | null
  best: RecommendationOption | null
  /** Cheapest option that does not require a subscription. */
  bestWithoutPlan: RecommendationOption | null
  /** Plans priced with a measurement from the chosen benchmark. */
  planOptions: RecommendationOption[]
  /** API models priced with a measurement from the chosen benchmark. */
  apiOptions: RecommendationOption[]
  /** Plans whose models are not measured in this benchmark. They stay visible
   * but can never win, because their coding level is unknown here. */
  unmeasuredPlanOptions: RecommendationOption[]
  /** Options that clear the bar but have no measured cost in this benchmark. */
  unpricedOptions: RecommendationOption[]
  /** API models priced from token prices only - never part of the ranking. */
  estimatedOptions: RecommendationOption[]
  /** Models that are not measured in this benchmark at all. */
  notMeasuredCount: number
}

/** The agent that produced a measurement, per benchmark. */
function agentFor(model: ModelData, benchmark: AgentBenchmark): string | null {
  return benchmark.harnessFor?.(model) ?? benchmark.harness
}

/** The published confidence interval, per benchmark. */
function confidenceFor(
  model: ModelData,
  benchmark: AgentBenchmark
): { low: number | null; high: number | null } {
  const published = benchmark.confidenceFor?.(model)
  if (published) return published
  return { low: null, high: null }
}

/** The reasoning effort of a measured configuration, when it is published. */
export function effortFor(model: ModelData): string | null {
  const effort = getReasoningEffort(model)
  return effort === 'unknown' ? null : effort
}

/**
 * Picks the benchmark the recommendation should use.
 *
 * A benchmark is only usable when the reference model has a score in it -
 * the threshold and the costs must come from the same runs. Terminal-Bench
 * comes first because it publishes a pass rate, which makes the cost per
 * successful task meaningful.
 */
export function pickRecommendationBenchmark(
  models: ModelData[],
  reference: ModelData | null,
  preferred?: AgentBenchmarkId | null
): AgentBenchmark | null {
  if (!reference) return null

  if (preferred) {
    const benchmark = getAgentBenchmark(preferred)
    return benchmark.score(reference) != null ? benchmark : null
  }

  const usable = AGENT_BENCHMARKS.filter(benchmark => {
    if (benchmark.score(reference) == null) return false
    return models.some(model => benchmark.score(model) != null)
  })

  return usable[0] ?? null
}

/**
 * The end-user answer: "which model should I run, through what?".
 *
 * The threshold and every cost come from one benchmark, so a score is never
 * compared against a cost from a different measurement. The ranking metric is
 * the cost per successful task when the benchmark publishes a pass rate - a
 * model that fails most attempts is not cheap, and cost per attempt hides
 * that.
 */
export function buildRecommendation(
  models: ModelData[],
  referenceSlug: string | null,
  tasksPerDay: number,
  preferredBenchmark?: AgentBenchmarkId | null
): Recommendation {
  const reference = referenceSlug
    ? models.find(model => model.slug === referenceSlug) ?? null
    : null

  const benchmark = pickRecommendationBenchmark(models, reference, preferredBenchmark)
  const threshold = benchmark && reference ? benchmark.score(reference) : null

  if (reference === null || benchmark === null || threshold === null) {
    return {
      benchmark,
      threshold: null,
      reference,
      best: null,
      bestWithoutPlan: null,
      planOptions: [],
      apiOptions: [],
      unmeasuredPlanOptions: [],
      unpricedOptions: [],
      estimatedOptions: [],
      notMeasuredCount: 0
    }
  }

  const qualifies = (model: ModelData): boolean => (benchmark.score(model) ?? -1) >= threshold

  /** Builds an option from a model that has a measurement in this benchmark. */
  const toOption = (model: ModelData): RecommendationOption | null => {
    const basis = resolveCostBasis(model, benchmark)
    const score = benchmark.score(model)
    const confidence = confidenceFor(model, benchmark)
    const metric = basis?.costPerSolvedTask ?? basis?.costPerAttempt ?? null
    if (metric === null) return null

    return {
      kind: 'api' as const,
      label: formatModelName(model.name),
      model,
      costPerTask: metric,
      costIsPerAttempt: basis?.isPerAttempt ?? true,
      costPerAttempt: basis?.costPerAttempt ?? null,
      score,
      passRate: basis?.passRate ?? null,
      ciLow: confidence.low,
      ciHigh: confidence.high,
      agent: agentFor(model, benchmark),
      apiCostPerTask: metric,
      breakEvenTasksPerMonth: null,
      apiCostIsEstimated: false,
      qualityKnown: true
    }
  }

  const measured = models.filter(model => benchmark.score(model) != null)

  const apiOptions: RecommendationOption[] = measured
    .filter(qualifies)
    .map(toOption)
    .filter((option): option is RecommendationOption => option !== null)
    .sort((a, b) => a.costPerTask - b.costPerTask)

  // Models that clear the bar but have no measured cost in this benchmark.
  const unpricedOptions: RecommendationOption[] = measured
    .filter(qualifies)
    .filter(model => resolveCostBasis(model, benchmark) === null)
    .map(model => ({
      kind: 'api' as const,
      label: formatModelName(model.name),
      model,
      costPerTask: 0,
      costIsPerAttempt: true,
      costPerAttempt: null,
      score: benchmark.score(model),
      passRate: null,
      ciLow: null,
      ciHigh: null,
      agent: agentFor(model, benchmark),
      apiCostPerTask: 0,
      breakEvenTasksPerMonth: null,
      apiCostIsEstimated: false,
      qualityKnown: true
    }))

  // Models that are not measured in this benchmark at all. Their coding level
  // is unknown here, so they can never win - but a token-price estimate still
  // gives a rough sense of the price.
  const notMeasured = models.filter(model => benchmark.score(model) == null)
  const estimatedOptions: RecommendationOption[] = notMeasured
    .filter(model => estimateCost(model) !== null)
    .map(model => ({
      kind: 'api' as const,
      label: formatModelName(model.name),
      model,
      costPerTask: estimateCost(model)!,
      costIsPerAttempt: true,
      costPerAttempt: estimateCost(model)!,
      score: null,
      passRate: null,
      ciLow: null,
      ciHigh: null,
      agent: null,
      apiCostPerTask: estimateCost(model)!,
      breakEvenTasksPerMonth: null,
      apiCostIsEstimated: true,
      qualityKnown: false
    }))
    .sort((a, b) => a.costPerTask - b.costPerTask)

  const planOptions: RecommendationOption[] = []
  const unmeasuredPlanOptions: RecommendationOption[] = []
  const usageMonth = tasksPerDay * 30
  for (const plan of SUBSCRIPTION_PLANS) {
    const planModels = plan.modelSlugs
      .map(slug => models.find(model => model.slug === slug))
      .filter((model): model is ModelData => model !== undefined)
    if (planModels.length === 0) continue

    // The best model in the plan is the one a subscriber would actually use.
    // It must be measured in the same benchmark, otherwise the plan cannot be
    // priced against the threshold.
    const measuredPlanModels = planModels.filter(model => benchmark.score(model) != null)
    if (measuredPlanModels.length === 0) {
      // No model of this plan is measured in this benchmark. The plan stays
      // visible with a token-price estimate, but it can never win.
      const best = [...planModels].sort(
        (a, b) => (benchmark.score(b) ?? -1) - (benchmark.score(a) ?? -1)
      )[0]!
      const estimate = estimateCost(best)
      if (estimate === null) continue

      const planCost = computePlanCost(plan, estimate, usageMonth)
      unmeasuredPlanOptions.push({
        kind: 'plan',
        label: `${plan.vendor} ${plan.name}`,
        model: best,
        plan,
        costPerTask: planCost.costPerTask ?? estimate,
        costIsPerAttempt: true,
        costPerAttempt: estimate,
        score: null,
        passRate: null,
        ciLow: null,
        ciHigh: null,
        agent: null,
        apiCostPerTask: estimate,
        breakEvenTasksPerMonth: planCost.breakEvenTasksPerMonth,
        apiCostIsEstimated: true,
        qualityKnown: false,
        includedTasksPerMonth: planCost.includedTasksPerMonth,
        quotaKind: planCost.quotaKind,
        hasOverage: planCost.hasOverage,
        costIsLowerBound: planCost.costIsLowerBound
      })
      continue
    }

    const best = [...measuredPlanModels].sort(
      (a, b) => (benchmark.score(b) ?? -1) - (benchmark.score(a) ?? -1)
    )[0]!

    // A plan whose best model does not clear the bar is not an alternative.
    if (!qualifies(best)) continue

    const basis = resolveCostBasis(best, benchmark)
    const costPerAttempt = basis?.costPerAttempt ?? null
    const metric = basis?.costPerSolvedTask ?? costPerAttempt
    if (metric === null) continue

    // The plan is costed per attempt, because that is what the plan price
    // buys. The pass rate of the same measurement then converts it to a cost
    // per solved task, so the plan and the API are compared in the same unit.
    const planCost = computePlanCost(plan, costPerAttempt, usageMonth)
    const planCostPerSolvedTask = costPerSolvedTaskFrom(planCost.costPerTask, basis?.passRate)
    const planMetric = planCostPerSolvedTask ?? planCost.costPerTask ?? metric

    // Anthropic Max/Ultra include API credits. They are consumed at list
    // price and are worth exactly the subscription price, so they make API
    // usage free of overage up to that amount without making the plan
    // cheaper than plain API usage.
    const creditCoverage = computeApiCreditCoverage(plan, costPerAttempt)
    const confidence = confidenceFor(best, benchmark)

    planOptions.push({
      kind: 'plan',
      label: `${plan.vendor} ${plan.name}`,
      model: best,
      plan,
      costPerTask: planMetric,
      costIsPerAttempt: planCostPerSolvedTask === null,
      costPerAttempt,
      score: benchmark.score(best),
      passRate: basis?.passRate ?? null,
      ciLow: confidence.low,
      ciHigh: confidence.high,
      agent: agentFor(best, benchmark),
      apiCostPerTask: metric,
      breakEvenTasksPerMonth: planCost.breakEvenTasksPerMonth,
      apiCostIsEstimated: false,
      qualityKnown: true,
      includedTasksPerMonth: planCost.includedTasksPerMonth,
      quotaKind: planCost.quotaKind,
      hasOverage: planCost.hasOverage,
      costIsLowerBound: planCost.costIsLowerBound,
      apiCreditsUsdPerMonth: creditCoverage.creditUsd || null
    })
  }

  planOptions.sort((a, b) => a.costPerTask - b.costPerTask)
  unmeasuredPlanOptions.sort((a, b) => a.costPerTask - b.costPerTask)

  const ranked = [...planOptions, ...apiOptions].sort((a, b) => a.costPerTask - b.costPerTask)

  return {
    benchmark,
    threshold,
    reference,
    best: ranked[0] ?? null,
    bestWithoutPlan: apiOptions[0] ?? null,
    planOptions,
    apiOptions,
    unmeasuredPlanOptions,
    unpricedOptions,
    estimatedOptions,
    notMeasuredCount: notMeasured.length
  }
}

/** Token-price estimate for a model, when the agent run was not measured. */
function estimateCost(model: ModelData): number | null {
  const value = model.estimatedCostPerTask
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}
