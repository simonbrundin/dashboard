/**
 * Effort-aware model identity shared by the server import and the client UI.
 *
 * Artificial Analysis publishes one model row per reasoning effort
 * ("GPT-6 Astra (Low)"), while benchmark leaderboards publish one row per
 * release and effort pair ("gpt-6-astra" + effort "low"). Matching a model to
 * a benchmark therefore needs both the release slug and the effort.
 */

export const REASONING_EFFORTS = ['max', 'xhigh', 'high', 'medium', 'low'] as const

export type ReasoningEffort = typeof REASONING_EFFORTS[number]

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === 'string' && (REASONING_EFFORTS as readonly string[]).includes(value)
}

/** Normalizes provider specific spellings such as "x-high" to "xhigh". */
export function normalizeEffort(value: string | null | undefined): ReasoningEffort | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (normalized === 'xhigh') return 'xhigh'
  if (normalized === 'high') return 'high'
  if (normalized === 'medium' || normalized === 'med') return 'medium'
  if (normalized === 'low') return 'low'
  if (normalized === 'max') return 'max'
  return null
}

/**
 * Reads the effort from a model name such as "Claude Opus 5 (Max, Default
 * Fallback)". Names without an effort suffix are treated as "max".
 */
export function extractEffortFromName(name: string | null | undefined): ReasoningEffort {
  const normalized = (name ?? '').toLowerCase()
  for (const effort of ['xhigh', 'high', 'medium', 'low'] as const) {
    if (new RegExp(`\\(${effort}\\b|\\(${effort},|\\b${effort}\\b`).test(normalized)) {
      return effort
    }
  }
  return 'max'
}

/** Strips the effort suffix from an Artificial Analysis model slug. */
export function baseReleaseSlug(slug: string): string {
  return slug.replace(/-(xhigh|high|medium|low)$/, '')
}

/**
 * Identity of a measured configuration: release slug plus reasoning effort.
 * Two model rows only share a measurement when both parts match.
 */
export function measurementKey(releaseSlug: string, effort: ReasoningEffort | null): string {
  return `${releaseSlug}|${effort ?? 'max'}`
}

/** Measurement key for an Artificial Analysis model row. */
export function modelMeasurementKey(slug: string, name: string): string {
  return measurementKey(baseReleaseSlug(slug), extractEffortFromName(name))
}
