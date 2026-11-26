import type { ModelData } from '~/data/models'
import type { SubscriptionPlan } from '~/data/subscriptions'

/**
 * Price per million tokens, normalized so models and plans can be compared.
 *
 * A subscription plan does not publish a token quota, so its price cannot be
 * turned into a token price directly. A credits plan does publish a dollar
 * value, and that is enough: the allowance is worth a known number of token
 * baskets at the model's own list price, which gives the plan an effective
 * price per basket.
 *
 * The basket is deliberately simple and documented: one million input tokens
 * plus one million output tokens. No hidden mix, no per-model weighting.
 */
export interface TokenBasket {
  /** List price of the basket in USD. */
  listPrice: number
  /** Price of the same basket when the input is served from the cache. */
  cachedPrice: number | null
  /** True when the model publishes cache prices. */
  hasCachePricing: boolean
}

/** The share of the input that is replayed from the prompt cache. */
export const CACHE_HIT_SHARE = 0.9

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * The price of one million input tokens plus one million output tokens.
 *
 * With cache pricing, the cached variant assumes that 90 % of the input is
 * replayed from the prompt cache and the rest is written to it. That share
 * comes from the DeepSWE runs, where the median configuration reads over 90 %
 * of its input from the cache - but it is an assumption, not a measurement of
 * the model.
 */
export function tokenBasket(model: ModelData): TokenBasket | null {
  const input = positive(model.inputPricePerM)
  const output = positive(model.outputPricePerM)
  if (input === null || output === null) return null

  const cacheHit = positive(model.cacheHitPricePerM)
  const cacheWrite = positive(model.cacheWritePricePerM)
  const hasCachePricing = cacheHit !== null && cacheWrite !== null

  const cachedPrice = hasCachePricing
    ? CACHE_HIT_SHARE * cacheHit! + (1 - CACHE_HIT_SHARE) * cacheWrite! + output
    : null

  return {
    listPrice: input + output,
    cachedPrice,
    hasCachePricing
  }
}

/** The share of the input that comes from the cache, as measured on a run. */
export function measuredCacheShare(model: ModelData): number | null {
  const read = model.deepSweMeanCacheReadTokens
  const input = model.deepSweMeanInputTokens
  if (read == null || input == null || input <= 0) return null
  return read / input
}

export interface PlanBasketPrice {
  /** Effective price of one basket through the plan, in USD. */
  effectivePrice: number | null
  /** True when the number is a lower bound, not an exact cost. */
  isLowerBound: boolean
  /** Why the number is missing, when it is. */
  reason: string | null
}

/**
 * The effective price of one token basket through a subscription plan.
 *
 * A credits plan has a published dollar allowance, so the number of baskets
 * it covers is known and the effective price follows. A plan with soft limits
 * or a request quota has no published dollar value - the number of tasks it
 * covers is unknown, and so is the number of tokens.
 */
export function planBasketPrice(
  plan: SubscriptionPlan,
  model: ModelData
): PlanBasketPrice {
  const basket = tokenBasket(model)
  if (!basket) {
    return { effectivePrice: null, isLowerBound: false, reason: 'modellen saknar listpris' }
  }

  const quota = plan.quota
  if (!quota || quota.kind !== 'credits-usd') {
    return {
      effectivePrice: null,
      isLowerBound: false,
      reason: 'kvoten är inte publicerad i dollar'
    }
  }

  const allowance = quota.amountUsdPerMonth ?? plan.pricePerMonth
  if (allowance <= 0) {
    return { effectivePrice: null, isLowerBound: false, reason: 'ingen inkluderad kvot' }
  }

  // The allowance buys this many baskets at list price.
  const baskets = allowance / basket.listPrice
  return {
    effectivePrice: plan.pricePerMonth / baskets,
    isLowerBound: false,
    reason: null
  }
}

/**
 * The measured token cost of one agent task, when the source published the
 * token counts of the run. This is the real number, not a price-based
 * estimate.
 */
export interface MeasuredRunCost {
  /** Cost of one attempt in USD. */
  costPerAttempt: number | null
  /** Cost of one successful task in USD. */
  costPerSolvedTask: number | null
  /** Input tokens per attempt. */
  inputTokens: number | null
  /** Output tokens per attempt. */
  outputTokens: number | null
  /** Reasoning tokens per attempt. */
  reasoningTokens: number | null
  /** Tokens served from the prompt cache per attempt. */
  cacheReadTokens: number | null
  /** Tokens written to the prompt cache per attempt. */
  cacheWriteTokens: number | null
  /** Share of the input that came from the cache, in percent. */
  cacheShare: number | null
  /** Median number of agent steps per task. */
  agentSteps: number | null
}

export function measuredRun(model: ModelData): MeasuredRunCost {
  const share = measuredCacheShare(model)
  return {
    costPerAttempt: model.deepSweCostPerTask ?? null,
    costPerSolvedTask: model.deepSweCostPerSuccessfulTask ?? null,
    inputTokens: model.deepSweMeanInputTokens ?? null,
    outputTokens: model.deepSweMeanOutputTokens ?? null,
    reasoningTokens: model.deepSweMeanReasoningTokens ?? null,
    cacheReadTokens: model.deepSweMeanCacheReadTokens ?? null,
    cacheWriteTokens: model.deepSweMeanCacheWriteTokens ?? null,
    cacheShare: share === null ? null : share * 100,
    agentSteps: model.deepSweMedianAgentSteps ?? null
  }
}

/** Formats a dollar amount per basket. */
export function formatBasketPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return 'Free'
  if (value < 1) return `$${value.toFixed(2)}`
  if (value < 10) return `$${value.toFixed(1)}`
  return `$${value.toFixed(0)}`
}
