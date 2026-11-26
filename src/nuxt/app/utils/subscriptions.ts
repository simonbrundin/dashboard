import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '~/data/subscriptions'
import type { ModelData } from '~/data/models'
import { getBenchmarkCostPerAttempt } from '~/utils/modelScoring'
import { computePlanCost, computeApiCreditCoverage } from '~/utils/planCost'

export interface SubscriptionComparisonRow {
  plan: SubscriptionPlan
  model: ModelData
  /** Per-task cost of the same model without a plan. */
  apiCostPerTask: number | null
  apiCostIsEstimated: boolean
  /**
   * Included agent tasks per month, when the plan's quota is convertible:
   * quota value / measured API cost per task.
   */
  includedTasksPerMonth: number | null
  /**
   * Total monthly cost at the chosen usage level: plan price plus overage
   * (list price) for usage beyond the included quota. Soft-limit plans are
   * assumed to cover the usage (flagged in the UI).
   */
  totalMonthlyCostAtUsage: number | null
  /** Total monthly cost spread over the chosen usage level. */
  costPerTaskAtUsage: number | null
  /** Legacy break-even value retained for recommendation/table consumers. */
  breakEvenTasksPerMonth: number | null
  /** Legacy name for costPerTaskAtUsage. */
  effectiveCostPerTask: number | null
  /** True when the cost per task only holds while the plan's limits hold. */
  costIsLowerBound: boolean
  /** API credits included with the plan, in USD per month. */
  apiCreditsUsdPerMonth: number | null
  /** Agent tasks the included API credits cover, when the cost is known. */
  apiCreditCoveredTasks: number | null
  /** True when usage beyond the included quota is billed at list price. */
  hasOverage: boolean
  cheaperThanApi: boolean | null
}

export interface SubscriptionComparison {
  rows: SubscriptionComparisonRow[]
  /** Rows whose price could not be re-verified recently. */
  unverifiedPlans: string[]
}

function finiteCost(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Compares fixed-price plans against pay-per-task API costs of the same
 * models, including each plan's usage limits:
 *
 * - credits-usd: the included quota has a published dollar value, so it
 *   converts to "included tasks" (quota value / measured API cost). Usage
 *   beyond the quota is billed at list price, so the total at a usage level
 *   is plan price + overage.
 * - quota-units: the quota is counted in requests or relative units, so the
 *   number of covered tasks is not calculable.
 * - soft-limits: the quota value is not published; the comparison assumes
 *   the plan covers the usage (flagged as an assumption in the UI).
 */
export function compareSubscriptionPlans(
  models: ModelData[],
  tasksPerDay: number
): SubscriptionComparison {
  const bySlug = new Map(models.map(model => [model.slug, model]))
  const rows: SubscriptionComparisonRow[] = []
  const usageMonth = tasksPerDay * 30

  for (const plan of SUBSCRIPTION_PLANS) {
    for (const slug of plan.modelSlugs) {
      const model = bySlug.get(slug)
      if (!model) continue

      const measured = getBenchmarkCostPerAttempt(model, 'aa-coding-agent')
      const estimate = finiteCost(model.estimatedCostPerTask)
      const apiCostPerTask = measured ?? estimate
      const apiCostIsEstimated = measured === null && estimate !== null

      const planCost = computePlanCost(plan, apiCostPerTask, usageMonth)

      // Anthropic Max/Ultra include API credits. The credits are consumed at
      // list price and are worth exactly the subscription price, so they make
      // API usage free of overage up to that amount - they never make the
      // plan cheaper than plain API usage.
      const creditCoverage = computeApiCreditCoverage(plan, apiCostPerTask)

      const includedTasksPerMonth = planCost.includedTasksPerMonth
      const totalMonthlyCostAtUsage = planCost.totalMonthlyCost
      const hasOverage = planCost.hasOverage
      const costPerTaskAtUsage = planCost.costPerTask
      const breakEvenTasksPerMonth = planCost.breakEvenTasksPerMonth
      const costIsLowerBound = planCost.costIsLowerBound

      const cheaperThanApi =
        costPerTaskAtUsage !== null &&
        apiCostPerTask !== null &&
        apiCostPerTask > 0
          ? costPerTaskAtUsage < apiCostPerTask
          : null

      rows.push({
        plan,
        model,
        apiCostPerTask,
        apiCostIsEstimated,
        includedTasksPerMonth,
        totalMonthlyCostAtUsage,
        costPerTaskAtUsage,
        breakEvenTasksPerMonth,
        effectiveCostPerTask: costPerTaskAtUsage,
        costIsLowerBound,
        hasOverage,
        cheaperThanApi,
        apiCreditsUsdPerMonth: creditCoverage.creditUsd || null,
        apiCreditCoveredTasks: creditCoverage.coveredTasks
      })
    }
  }

  rows.sort((a, b) => {
    const aCost = a.costPerTaskAtUsage ?? Number.POSITIVE_INFINITY
    const bCost = b.costPerTaskAtUsage ?? Number.POSITIVE_INFINITY
    return aCost - bCost
  })

  return {
    rows,
    unverifiedPlans: SUBSCRIPTION_PLANS.filter(plan => !plan.priceVerified).map(plan => plan.name)
  }
}
