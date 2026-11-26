import type { ModelData } from '~/data/models'
import {
  USAGE_LIMIT_PROFILES,
  type LimitTier,
  type LimitValue,
  type UsageLimitProfile
} from '~/data/usageLimits'
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '~/data/subscriptions'
import { baseModelSlug } from '~/utils/modelFormatters'

/**
 * The usage limits that apply to one model.
 *
 * Three kinds are kept apart, because they limit different things:
 * - API limits cap how much you may send per minute, day or month.
 * - The monthly spend cap caps how much you may pay per calendar month.
 * - Plan quotas cap how much of a subscription you may use.
 *
 * A limit that is not published is reported as not published. It is never
 * turned into zero or into "unlimited".
 */
export interface ModelUsageLimits {
  /** The published API limits, null when the provider publishes no numbers. */
  api: {
    provider: string
    /** The tier the numbers below belong to. */
    tier: string
    tierRequirement: string | null
    rpm: number | null
    rps: number | null
    tpm: number | null
    tpd: LimitValue | null
    rpd: LimitValue | null
    concurrency: number | null
    monthlyUsdCap: number | null
    sourceUrl: string
    verifiedDate: string
    note: string | null
    /** Every published tier, so a range can be shown. */
    tiers: LimitTier[]
    /** The highest published tier, used for "and then it becomes unlimited". */
    topTier: LimitTier | null
  } | null
  /** True when the provider does not publish static per-model numbers. */
  notPublished: boolean
  /** Why there are no numbers, when there are none. */
  notPublishedReason: string | null
  /** The subscriptions the model is included in. */
  plans: PlanUsageQuota[]
}

export interface PlanUsageQuota {
  plan: SubscriptionPlan
  /** A short label of what the quota looks like. */
  label: string
  /** The window the quota applies to, e.g. "5 h", "månad", "vecka". */
  window: string | null
  /** The published value, null when the quota is not expressed in a number. */
  value: number | null
  /** The unit of the value, e.g. "credits", "anrop", "$". */
  unit: string | null
  /** The kind of quota, so the UI can explain it. */
  kind: 'credits-usd' | 'quota-units' | 'soft-limits'
  note: string
}

/** Matches a slug against a profile's slug prefixes. */
function slugMatches(profile: UsageLimitProfile, slug: string): boolean {
  if (profile.slugPrefixes.length === 0) return true
  return profile.slugPrefixes.some(prefix => slug === prefix || slug.startsWith(`${prefix}-`))
}

/** The profile that covers a model, if any. */
export function findUsageLimitProfile(model: ModelData): UsageLimitProfile | null {
  const candidates = USAGE_LIMIT_PROFILES.filter(profile => profile.provider === model.provider)
  return candidates.find(profile => slugMatches(profile, model.slug ?? '')) ?? null
}

/**
 * True when a plan includes a model.
 *
 * The catalog has one row per reasoning effort. A subscription includes the
 * model, so every effort of it is covered.
 */
export function planIncludesModel(plan: SubscriptionPlan, slug: string | null | undefined): boolean {
  if (!slug) return false
  const base = baseModelSlug(slug)
  return plan.modelSlugs.some(
    planSlug => planSlug === slug || baseModelSlug(planSlug) === base
  )
}

/**
 * The lowest tier that publishes actual numbers.
 *
 * Some providers publish a tier with only a monthly limit, and the rate
 * limits start one tier up. Showing an empty first tier would hide the
 * limits that do exist.
 */
function entryTier(profile: UsageLimitProfile | null): LimitTier | null {
  if (!profile) return null
  const withNumbers = profile.tiers.find(
    tier => tier.rpm != null || tier.rps != null || tier.tpm != null || tier.concurrency != null
  )
  return withNumbers ?? profile.tiers[0] ?? null
}

/** The tier that carries the monthly spend cap. */
function capTier(profile: UsageLimitProfile | null): LimitTier | null {
  return profile?.tiers.find(tier => tier.monthlyUsdCap != null) ?? profile?.tiers[0] ?? null
}

/** The quota of a plan, in the shape the UI needs. */
function planQuota(plan: SubscriptionPlan): PlanUsageQuota | null {
  if (!plan.quota) return null
  const quota = plan.quota

  if (quota.kind === 'credits-usd') {
    return {
      plan,
      label: quota.amountUsdPerMonth != null
        ? `$${quota.amountUsdPerMonth}/mån i credits`
        : 'credits utan publicerat dollarvärde',
      window: 'månad',
      value: quota.amountUsdPerMonth ?? null,
      unit: '$',
      kind: quota.kind,
      note: quota.note
    }
  }

  if (quota.kind === 'quota-units') {
    if (quota.requestsPerWindow != null) {
      const window = quota.windowHours != null ? `${quota.windowHours} h` : null
      return {
        plan,
        label: window
          ? `${quota.requestsPerWindow.toLocaleString('sv-SE')} anrop/${window}`
          : `${quota.requestsPerWindow.toLocaleString('sv-SE')} anrop`,
        window,
        value: quota.requestsPerWindow,
        unit: 'anrop',
        kind: quota.kind,
        note: quota.note
      }
    }
    return {
      plan,
      label: quota.publishedRange ?? 'relativ kvot utan publicerat värde',
      window: null,
      value: null,
      unit: null,
      kind: quota.kind,
      note: quota.note
    }
  }

  return {
    plan,
    label: quota.publishedRange ?? 'mjuk gräns, ej publicerad i siffror',
    window: null,
    value: null,
    unit: null,
    kind: quota.kind,
    note: quota.note
  }
}

/**
 * Every limit that applies to a model: the provider's API limits, the
 * monthly spend cap and the subscriptions the model is included in.
 */
export function getModelUsageLimits(model: ModelData): ModelUsageLimits {
  const profile = findUsageLimitProfile(model)
  const tier = entryTier(profile)

  const plans = SUBSCRIPTION_PLANS
    .filter(plan => planIncludesModel(plan, model.slug))
    .map(plan => planQuota(plan))
    .filter((quota): quota is PlanUsageQuota => quota !== null)

  if (!profile) {
    return {
      api: null,
      notPublished: false,
      notPublishedReason: null,
      plans
    }
  }

  if (profile.notPublished) {
    return {
      api: null,
      notPublished: true,
      notPublishedReason: profile.notPublishedReason ?? null,
      plans
    }
  }

  return {
    api: {
      provider: profile.provider,
      tier: tier?.tier ?? 'Standard',
      tierRequirement: tier?.requirement ?? null,
      rpm: tier?.rpm ?? null,
      rps: tier?.rps ?? null,
      tpm: tier?.tpm ?? null,
      tpd: tier?.tpd ?? null,
      rpd: tier?.rpd ?? null,
      concurrency: tier?.concurrency ?? null,
      monthlyUsdCap: capTier(profile)?.monthlyUsdCap ?? null,
      sourceUrl: profile.sourceUrl,
      verifiedDate: profile.verifiedDate,
      note: profile.note ?? null,
      tiers: profile.tiers,
      topTier: profile.tiers[profile.tiers.length - 1] ?? null
    },
    notPublished: false,
    notPublishedReason: null,
    plans
  }
}

/** Formats a token count the way the sources write it. */
export function formatTokenLimit(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace('.', ',')}M tokens`
  }
  if (value >= 1000) {
    const thousands = value / 1000
    return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1).replace('.', ',')}K tokens`
  }
  return `${value} tokens`
}

/**
 * The limits of one model as short rows for the UI.
 *
 * Every row says which period it covers, so a per-minute limit is never
 * read as a daily one.
 */
export interface UsageLimitRow {
  /** The period the limit covers. */
  period: 'tim' | 'dag' | 'månad' | 'plan'
  /** The limit in words. */
  text: string
  /** True when the limit is not quantified. */
  unquantified: boolean
}

export function usageLimitRows(limits: ModelUsageLimits): UsageLimitRow[] {
  const rows: UsageLimitRow[] = []

  if (limits.api) {
    const api = limits.api
    const minute: string[] = []
    if (api.rpm != null) minute.push(`${api.rpm.toLocaleString('sv-SE')} anrop/min`)
    if (api.rps != null) minute.push(`${api.rps.toLocaleString('sv-SE')} anrop/s`)
    if (api.tpm != null) minute.push(`${formatTokenLimit(api.tpm)}/min`)
    if (api.concurrency != null) {
      minute.push(`${api.concurrency.toLocaleString('sv-SE')} samtidiga`)
    }
    if (minute.length > 0) {
      rows.push({ period: 'tim', text: `${minute.join(' · ')} (${api.tier})`, unquantified: false })
    }

    const day: string[] = []
    if (api.tpd === 'unlimited') day.push('tok/dag: obegränsat')
    else if (api.tpd != null) {
      const top = api.topTier?.tpd
      day.push(
        top === 'unlimited'
          ? `${formatTokenLimit(api.tpd)}/dag (${api.tier}) → obegränsat vid högre nivå`
          : `${formatTokenLimit(api.tpd)}/dag`
      )
    }
    if (api.rpd === 'unlimited') day.push('anrop/dag: obegränsat')
    else if (api.rpd != null) day.push(`${api.rpd.toLocaleString('sv-SE')} anrop/dag`)
    if (day.length > 0) {
      rows.push({ period: 'dag', text: day.join(' · '), unquantified: false })
    }

    if (api.monthlyUsdCap != null) {
      rows.push({
        period: 'månad',
        text: `$${api.monthlyUsdCap.toLocaleString('sv-SE')}/mån i spend`,
        unquantified: false
      })
    }
  }

  for (const quota of limits.plans) {
    rows.push({
      period: 'plan',
      text: `${quota.plan.vendor} ${quota.plan.name}: ${quota.label}`,
      unquantified: quota.value === null
    })
  }

  return rows
}

/** A one-line summary for tables: the tightest published limit. */
export function usageLimitSummary(limits: ModelUsageLimits): string {
  if (limits.notPublished) return 'ej publicerade'
  const rows = usageLimitRows(limits)
  if (rows.length === 0) return 'inga publicerade gränser'
  return rows.map(row => row.text).join(' · ')
}
