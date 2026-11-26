export type Category = 'all' | 'frontier' | 'high' | 'mid' | 'budget'

/** The reasoning efforts the benchmarks publish, from least to most. */
export const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export type ReasoningEffortLabel = (typeof REASONING_EFFORTS)[number] | 'non-reasoning' | 'unknown'

/**
 * The reasoning effort of a model configuration.
 *
 * The benchmarks publish one row per effort, so the effort is part of the
 * identity of a measurement - comparing a "max" run with a "low" run is not
 * comparing the same thing.
 */
export function getReasoningEffort(model: { name: string; deepSweReasoningEffort?: string | null }): ReasoningEffortLabel {
  if (model.deepSweReasoningEffort) {
    const effort = model.deepSweReasoningEffort.toLowerCase()
    if ((REASONING_EFFORTS as readonly string[]).includes(effort)) {
      return effort as ReasoningEffortLabel
    }
    if (effort.includes('non-reasoning')) return 'non-reasoning'
  }

  const qualifiers = /\(([^()]*)\)\s*$/.exec(model.name)?.[1]
  if (!qualifiers) return 'unknown'
  const effort = qualifiers.split(',')[0]?.trim().toLowerCase() ?? ''
  if (effort.length === 0) return 'unknown'
  if ((REASONING_EFFORTS as readonly string[]).includes(effort)) {
    return effort as ReasoningEffortLabel
  }
  if (effort.includes('non-reasoning')) return 'non-reasoning'
  return 'unknown'
}

/**
 * The slug of a model without its reasoning-effort suffix.
 *
 * The catalog has one row per effort, so "claude-sonnet-5-5-high" and
 * "claude-sonnet-5-5" are the same model in different settings. A
 * subscription includes the model, not one setting of it.
 */
export function baseModelSlug(slug: string | null | undefined): string {
  if (!slug) return ''
  return slug.replace(/-(non-reasoning|xhigh|high|medium|low|max|minimal|none)$/i, '')
}

export function getCategoryColor(category: string | null | undefined): string {
  const colors: Record<Exclude<Category, 'all'>, string> = {
    frontier: 'text-purple-500 bg-purple-500/10',
    high: 'text-blue-500 bg-blue-500/10',
    mid: 'text-green-500 bg-green-500/10',
    budget: 'text-amber-500 bg-amber-500/10'
  }
  if (category === 'all') return 'text-gray-500 bg-gray-500/10'
  return colors[category as Exclude<Category, 'all'>] || 'text-gray-500 bg-gray-500/10'
}

export interface ValueRating {
  stars: number
  label: string
}

export function getValueRating(ratio: number | null | undefined): ValueRating {
  if (ratio == null || Number.isNaN(ratio)) {
    return { stars: 0, label: 'Unavailable' }
  }
  if (!isFinite(ratio)) {
    return { stars: 5, label: 'Free' }
  }
  if (ratio >= 200) return { stars: 5, label: 'Excellent' }
  if (ratio >= 100) return { stars: 4, label: 'Great' }
  if (ratio >= 50) return { stars: 3, label: 'Good' }
  if (ratio >= 25) return { stars: 2, label: 'Fair' }
  return { stars: 1, label: 'Basic' }
}

/**
 * Shortens model names for comparison views: "Claude Sonnet 5.5 (Max, Default
 * Fallback)" -> "Claude Sonnet 5.5 · Max". Configuration qualifiers matter for
 * honesty, so they are kept - just separated from the product name.
 */
export function formatModelName(name: string): string {
  const match = /^(?<base>.*?)\((?<qualifiers>[^()]+)\)$/.exec(name)
  const base = match?.groups?.base
  const qualifiers = match?.groups?.qualifiers
  if (!base || !qualifiers) return name
  const parts = qualifiers
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0 && !/^Default Fallback$/i.test(part))
  if (parts.length === 0) return base
  return `${base} · ${parts.join(' · ')}`
}

export function formatCodingValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (!isFinite(value)) return 'Free'
  return `${value.toFixed(0)} pts/$`
}

export function formatCost(cost: number | string | null | undefined): string {
  if (cost == null) return '—'
  const numCost = typeof cost === 'string' ? parseFloat(cost) : cost
  if (isNaN(numCost)) return '—'
  if (!isFinite(numCost)) return '∞'
  if (numCost === 0) return 'Free'
  if (numCost < 0.01) return `$${numCost.toFixed(3)}/task`
  if (numCost < 0.1) return `$${numCost.toFixed(2)}/task`
  if (numCost < 1) return `$${numCost.toFixed(2)}/task`
  if (numCost < 10) return `$${numCost.toFixed(1)}/task`
  return `$${numCost.toFixed(0)}/task`
}

export function formatCostPerSuccessfulTask(cost: number | string | null | undefined): string {
  const formatted = formatCost(cost)
  return formatted.endsWith('/task')
    ? `${formatted.slice(0, -5)}/success`
    : formatted
}

/**
 * Formats a cost with the unit the measurement actually has.
 *
 * A cost per successful task and a cost per attempt are different numbers
 * and must not be shown with the same label.
 */
/**
 * Formats a cost as an amount.
 *
 * The unit is added by `metricUnitLabel`, because a cost per successful task
 * and a cost per attempt are different numbers and must not be shown with
 * the same label.
 */
export function formatMetricCost(cost: number | string | null | undefined): string {
  const formatted = formatCost(cost)
  if (!formatted.endsWith('/task')) return formatted
  return formatted.slice(0, -5)
}

/** The Swedish label for the metric a cost is measured in. */
export function metricUnitLabel(isPerAttempt: boolean): string {
  return isPerAttempt ? 'per försök' : 'per lyckad uppgift'
}

/** Formats a confidence interval, e.g. "65.1-71.4 %". */
export function formatConfidenceInterval(
  low: number | null | undefined,
  high: number | null | undefined
): string | null {
  if (low == null || high == null) return null
  return `${low.toFixed(1)}-${high.toFixed(1)} %`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleString()
}
