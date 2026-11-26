import type { SubscriptionPlan } from '~/data/subscriptions'

/**
 * The cost of running agent tasks through a subscription plan, including the
 * plan's usage limits.
 *
 * Three kinds of limits exist, and they are not interchangeable:
 *
 * - `credits-usd`: the plan includes an allowance with a published dollar
 *   value (GitHub Copilot AI credits, 1 credit = $0.01). Usage within the
 *   allowance is covered by the plan price; usage beyond it is billed at list
 *   price. The cost per task can therefore be calculated exactly.
 * - `quota-units`: the allowance is counted in requests per time window or in
 *   relative units (MiniMax Token Plan, M Plan). It has no published dollar
 *   value and an agent task is many requests, so the number of covered tasks
 *   cannot be calculated. The cost per task is only a lower bound.
 * - `soft-limits`: the limits are not published as a dollar value (5-hour
 *   windows, "5x Pro usage"). They cannot be converted into an amount of
 *   agent tasks, so the cost per task is NOT calculable. The only honest
 *   statement is the break-even: how many tasks per month the plan price is
 *   worth - which only holds while the limits allow that much usage.
 */
export interface PlanCost {
  /**
   * Cost per agent task at the given usage level. For plans with soft limits
   * this is a lower bound: it assumes the limits hold at the chosen usage.
   */
  costPerTask: number | null
  /**
   * True when the cost per task only holds while the plan's usage limits
   * hold - the limits are not published as a dollar value, so the number
   * cannot be verified.
   */
  costIsLowerBound: boolean
  /**
   * The plan price spread over the usage level. Only meaningful while the
   * plan's limits hold - it is a lower bound, not a measured cost.
   */
  spreadCostPerTask: number | null
  /** Total monthly cost at the given usage level. */
  totalMonthlyCost: number
  /** Agent tasks the included allowance covers, when it has a dollar value. */
  includedTasksPerMonth: number | null
  /** True when the usage exceeds the included allowance. */
  hasOverage: boolean
  /**
   * Monthly agent tasks where the plan price equals the API cost, or null
   * when the plan can never be cheaper (list-price quota).
   */
  breakEvenTasksPerMonth: number | null
  /** The limit kind the cost was derived from. */
  quotaKind: 'credits-usd' | 'quota-units' | 'soft-limits' | 'none'
}

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * How much agent work a plan's included API credits cover.
 *
 * Anthropic publishes API credits for Max ($100) and Ultra ($200) per month.
 * The credits are consumed at list price, so they cover a known number of
 * agent tasks at the measured API cost. They do not cover the in-app agent
 * usage (Claude Code) - only API calls - and they expire at the end of the
 * billing cycle.
 *
 * Note that the credits are worth exactly the subscription price, so they
 * make API usage free of overage up to that amount but never make the plan
 * cheaper than plain API usage.
 */
export function computeApiCreditCoverage(
  plan: SubscriptionPlan,
  apiCostPerTask: number | null
): { creditUsd: number; coveredTasks: number | null } {
  const creditUsd = plan.apiCreditsUsdPerMonth ?? 0
  if (creditUsd <= 0 || apiCostPerTask === null || apiCostPerTask <= 0) {
    return { creditUsd, coveredTasks: null }
  }
  return { creditUsd, coveredTasks: creditUsd / apiCostPerTask }
}

/**
 * Computes what a plan costs per agent task at the chosen usage level.
 *
 * @param plan The subscription plan.
 * @param apiCostPerTask Measured (or estimated) API cost for the same task.
 * @param usageMonth Agent tasks per month at the chosen usage level.
 */
export function computePlanCost(
  plan: SubscriptionPlan,
  apiCostPerTask: number | null,
  usageMonth: number
): PlanCost {
  const quota = plan.quota
  const quotaKind = quota?.kind ?? 'none'
  const monthlyPrice = plan.pricePerMonth
  const spreadCostPerTask = usageMonth > 0 ? monthlyPrice / usageMonth : null

  if (quotaKind === 'soft-limits' || quotaKind === 'quota-units' || quotaKind === 'none') {
    // The limits are not published in dollars. Spreading the plan price over
    // the usage assumes the limits hold - it is a lower bound, not a real
    // cost per task.
    return {
      costPerTask: spreadCostPerTask,
      costIsLowerBound: true,
      spreadCostPerTask,
      totalMonthlyCost: monthlyPrice,
      includedTasksPerMonth: null,
      hasOverage: false,
      breakEvenTasksPerMonth:
        positive(apiCostPerTask) !== null ? monthlyPrice / apiCostPerTask! : null,
      quotaKind
    }
  }

  const allowanceUsd = quota?.amountUsdPerMonth ?? monthlyPrice
  const cost = positive(apiCostPerTask)

  if (cost === null) {
    // Without a per-task cost there is nothing to convert the allowance into.
    return {
      costPerTask: null,
      costIsLowerBound: true,
      spreadCostPerTask,
      totalMonthlyCost: monthlyPrice,
      includedTasksPerMonth: null,
      hasOverage: false,
      breakEvenTasksPerMonth: null,
      quotaKind
    }
  }

  const includedTasksPerMonth = allowanceUsd / cost
  const usedValue = usageMonth * cost
  const overage = Math.max(0, usedValue - allowanceUsd)
  const totalMonthlyCost = monthlyPrice + overage

  // A credits plan is cheaper than the plain API as soon as you use more
  // than the plan price worth of API usage - the allowance is worth more
  // than the plan price, so the plan wins by that difference every month.
  const breakEvenTasksPerMonth = allowanceUsd > monthlyPrice ? monthlyPrice / cost : null

  return {
    costPerTask: usageMonth > 0 ? totalMonthlyCost / usageMonth : totalMonthlyCost,
    costIsLowerBound: false,
    spreadCostPerTask: null,
    totalMonthlyCost,
    includedTasksPerMonth,
    hasOverage: overage > 0,
    breakEvenTasksPerMonth,
    quotaKind
  }
}
