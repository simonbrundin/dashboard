/**
 * Benchmark cost calculators.
 *
 * Sources:
 * - Terminal-Bench 4.0/4.1: https://artificialanalysis.ai/evaluations/terminalbench-v4-0
 * - DeepSWE v1.1: https://deepswe.datacurve.ai/blog/deepswe-v1-1
 *
 * Every measurement is stored per release and reasoning effort because the
 * leaderboards publish one row per effort configuration while Artificial
 * Analysis publishes one model row per effort variant.
 */

import {
  baseReleaseSlug,
  extractEffortFromName,
  measurementKey,
  normalizeEffort,
  type ReasoningEffort
} from '../../shared/utils/modelEffort'

const TERMINAL_BENCH_URL = 'https://artificialanalysis.ai/evaluations/terminalbench-v4-0'
const DEEP_SWE_URL = 'https://deepswe.datacurve.ai/blog/deepswe-v1-1'
/** Terminal-Bench 4.0 and 4.1 use the same 66 tasks (4.1 updates the verifiers). */
export const TERMINAL_BENCH_TASK_COUNT = 66

export type TerminalBenchVersion = '4.1' | '4.0'

export interface BenchmarkMeasurement {
  /** Score on a 0-100 scale, null when the source does not publish it. */
  score: number | null
  /** Cost of one attempt in USD, null when the source does not publish it. */
  costPerTask: number | null
  /** Cost of one successful task in USD, null when the score is unknown. */
  costPerSuccessfulTask: number | null
}

export interface TerminalBenchMeasurement extends BenchmarkMeasurement {
  version: TerminalBenchVersion
}

export interface TerminalBenchRow {
  releaseSlug: string
  effort: ReasoningEffort
  version: TerminalBenchVersion
  score: number | null
  costPerTask: number | null
}

export interface CodingBenchmarkCosts {
  /** Terminal-Bench measurements keyed by release slug, effort and version. */
  terminalBench: Map<string, TerminalBenchMeasurement>
  /** DeepSWE measurements keyed by release slug and effort. */
  deepSwe: Map<string, BenchmarkMeasurement>
  /** Median token profile per effort, used for cost estimates. */
  referenceProfiles: Map<ReasoningEffort, TokenProfile>
}

/** Median per-task token usage observed for one effort tier. */
export interface TokenProfile {
  inputTokens: number
  answerTokens: number
  reasoningTokens: number
  cacheableInputTokens: number
  cacheHitRate: number
}

// ============================================================================
// Type definitions
// ============================================================================

interface TerminalBenchModel {
  slug?: unknown
  name?: unknown
  effort?: { slug?: unknown } | null
  suffix?: unknown
  terminalBench40?: unknown
  terminalBench41?: unknown
  canonicalEvalTokenCounts?: Record<string, {
    input?: unknown
    answer?: unknown
    reasoning?: unknown
    cacheableInput?: unknown
  } | null> | null
  price1mInputTokens?: unknown
  price1mOutputTokens?: unknown
  cacheHitPrice?: unknown
  cacheWritePrice?: unknown
  cacheHitRate?: unknown
}

// ============================================================================
// Helper functions
// ============================================================================

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Converts a leaderboard ratio (0-1) to a 0-100 score. */
function asPercentScore(value: unknown): number | null {
  const parsed = asFiniteNumber(value)
  if (parsed === null) return null
  return parsed <= 1 ? parsed * 100 : parsed
}

function decodeEmbeddedJsonArray(
  html: string,
  marker: string,
  endMarker: string
): unknown[] {
  const startMarker = html.indexOf(marker)
  if (startMarker < 0) return []

  const arrayStart = startMarker + marker.length
  const arrayEnd = html.indexOf(endMarker, arrayStart)
  if (arrayEnd < 0) return []

  try {
    const encodedArray = html.slice(arrayStart, arrayEnd + 1)
    const decodedArray = JSON.parse(`"${encodedArray}"`) as string
    const parsed = JSON.parse(decodedArray) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ============================================================================
// Cost calculation
// ============================================================================

interface TokenCounts {
  input?: unknown
  answer?: unknown
  reasoning?: unknown
  cacheableInput?: unknown
}

/**
 * Cost of one attempt for a benchmark run. Cache prices are used when the
 * source publishes cacheable input and cache rates, otherwise the plain
 * input/output price applies.
 */
function calculateCostPerTask(
  tokenCounts: TokenCounts,
  inputPrice: unknown,
  outputPrice: unknown,
  cacheHitPrice: unknown,
  cacheWritePrice: unknown,
  cacheHitRate: unknown,
  taskCount: number
): number | null {
  const inputTokens = asFiniteNumber(tokenCounts.input)
  const answerTokens = asFiniteNumber(tokenCounts.answer)
  const reasoningTokens = asFiniteNumber(tokenCounts.reasoning)
  const inputPricePerMillion = asFiniteNumber(inputPrice)
  const outputPricePerMillion = asFiniteNumber(outputPrice)

  if (
    inputTokens === null ||
    answerTokens === null ||
    reasoningTokens === null ||
    inputPricePerMillion === null ||
    outputPricePerMillion === null ||
    taskCount <= 0
  ) {
    return null
  }

  const cacheableInput = asFiniteNumber(tokenCounts.cacheableInput)

  if (cacheableInput !== null) {
    const hitRate = asFiniteNumber(cacheHitRate)

    if (hitRate === null) return null

    // Providers often publish a cache-read price but no separate cache-write
    // price. Missing cache prices fall back to the normal input price, which
    // is how those tokens are billed.
    const cacheHitPricePerMillion = asFiniteNumber(cacheHitPrice) ?? inputPricePerMillion
    const cacheWritePricePerMillion = asFiniteNumber(cacheWritePrice) ?? inputPricePerMillion

    const cacheReadTokens = cacheableInput * hitRate
    const cacheWriteTokens = inputTokens - cacheReadTokens
    if (cacheWriteTokens < 0) return null

    const totalCost =
      cacheReadTokens / 1_000_000 * cacheHitPricePerMillion +
      cacheWriteTokens / 1_000_000 * cacheWritePricePerMillion +
      (answerTokens + reasoningTokens) / 1_000_000 * outputPricePerMillion

    return totalCost / taskCount
  }

  const totalCost =
    inputTokens / 1_000_000 * inputPricePerMillion +
    (answerTokens + reasoningTokens) / 1_000_000 * outputPricePerMillion

  return totalCost / taskCount
}

/**
 * Cost of one successful task. The score is a percentage (0-100); the success
 * rate is the same number divided by 100.
 */
export function costPerSuccessfulTask(
  costPerTask: number | null | undefined,
  scorePercent: number | null | undefined
): number | null {
  if (
    typeof costPerTask !== 'number' || !Number.isFinite(costPerTask) || costPerTask < 0 ||
    typeof scorePercent !== 'number' || !Number.isFinite(scorePercent) || scorePercent <= 0
  ) {
    return null
  }

  const successRate = scorePercent / 100
  return successRate > 0 ? costPerTask / successRate : null
}

// ============================================================================
// Terminal-Bench fetcher
// ============================================================================

interface TerminalBenchVersionData {
  score: number | null
  costPerTask: number | null
}

function readTerminalBenchVersion(
  model: TerminalBenchModel,
  version: TerminalBenchVersion
): TerminalBenchVersionData {
  const score = asPercentScore(
    version === '4.1' ? model.terminalBench41 : model.terminalBench40
  )
  const tokenCounts = version === '4.1'
    ? model.canonicalEvalTokenCounts?.terminalBench41
    : model.canonicalEvalTokenCounts?.terminalBench40

  if (!tokenCounts) return { score, costPerTask: null }

  const costPerTask = calculateCostPerTask(
    tokenCounts,
    model.price1mInputTokens,
    model.price1mOutputTokens,
    model.cacheHitPrice,
    model.cacheWritePrice,
    model.cacheHitRate,
    TERMINAL_BENCH_TASK_COUNT
  )

  return { score, costPerTask }
}

function parseTerminalBenchRows(html: string): TerminalBenchRow[] {
  const models = decodeEmbeddedJsonArray(
    html,
    '\\"initialModels\\":',
    '],\\"defaultSlugs'
  ) as TerminalBenchModel[]

  const rows: TerminalBenchRow[] = []
  for (const model of models) {
    if (typeof model.slug !== 'string') continue
    const effort = normalizeEffort(asString(model.effort?.slug)) ?? 'max'

    for (const version of ['4.1', '4.0'] as const) {
      const { score, costPerTask } = readTerminalBenchVersion(model, version)
      if (score === null && costPerTask === null) continue

      rows.push({
        releaseSlug: model.slug,
        effort,
        version,
        score,
        costPerTask
      })
    }
  }

  return rows
}

async function fetchTerminalBenchCosts(): Promise<{
  measurements: Map<string, TerminalBenchMeasurement>
  profiles: Map<ReasoningEffort, TokenProfile>
}> {
  const html = await $fetch<string>(TERMINAL_BENCH_URL)
  const rows = parseTerminalBenchRows(html)
  const measurements = new Map<string, TerminalBenchMeasurement>()
  const profiles = new Map<ReasoningEffort, TokenProfile>()

  const candidates = new Map<string, TerminalBenchRow[]>()
  for (const row of rows) {
    const key = measurementKey(row.releaseSlug, row.effort)
    const bucket = candidates.get(key) ?? []
    bucket.push(row)
    candidates.set(key, bucket)
  }

  for (const [key, bucket] of candidates) {
    // Score and cost are only combined when both come from the same version.
    for (const version of ['4.1', '4.0'] as const) {
      const row = bucket.find(candidate => candidate.version === version)
      if (!row) continue

      measurements.set(`${key}|${version}`, {
        version,
        score: row.score,
        costPerTask: row.costPerTask,
        costPerSuccessfulTask: costPerSuccessfulTask(row.costPerTask, row.score)
      })
    }
  }

  return { measurements, profiles }
}

// ============================================================================
// DeepSWE fetcher
// ============================================================================

interface DeepSweRow {
  releaseSlug: string
  effort: ReasoningEffort
  score: number
  costPerTask: number
}

function parseDeepSweRows(html: string): DeepSweRow[] {
  const rows: DeepSweRow[] = []
  const rowPattern = /model:"([^"]+)"[^}]*?reasoning_effort:"([^"]+)"[^}]*?pass_rate:([0-9.eE+-]+)[^}]*?mean_cost_usd:([0-9.eE+-]+)/gs

  for (const match of html.matchAll(rowPattern)) {
    const releaseSlug = match[1]
    const effort = normalizeEffort(match[2])
    const passRate = asFiniteNumber(match[3])
    const costPerTask = asFiniteNumber(match[4])
    if (!releaseSlug || !effort || passRate === null || costPerTask === null) continue
    if (costPerTask < 0) continue

    rows.push({
      releaseSlug,
      effort,
      score: passRate <= 1 ? passRate * 100 : passRate,
      costPerTask
    })
  }

  return rows
}

async function fetchDeepSweCosts(): Promise<Map<string, BenchmarkMeasurement>> {
  const html = await $fetch<string>(DEEP_SWE_URL)
  const measurements = new Map<string, BenchmarkMeasurement>()

  for (const row of parseDeepSweRows(html)) {
    measurements.set(measurementKey(row.releaseSlug, row.effort), {
      score: row.score,
      costPerTask: row.costPerTask,
      costPerSuccessfulTask: costPerSuccessfulTask(row.costPerTask, row.score)
    })
  }

  return measurements
}

// ============================================================================
// Reference token profiles (used for cost estimates)
// ============================================================================

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}

function buildReferenceProfiles(html: string): Map<ReasoningEffort, TokenProfile> {
  const models = decodeEmbeddedJsonArray(
    html,
    '\\"initialModels\\":',
    '],\\"defaultSlugs'
  ) as TerminalBenchModel[]

  const byEffort = new Map<ReasoningEffort, {
    input: number[]
    answer: number[]
    reasoning: number[]
    cacheable: number[]
    hitRate: number[]
  }>()

  for (const model of models) {
    if (typeof model.slug !== 'string') continue
    const effort = normalizeEffort(asString(model.effort?.slug)) ?? 'max'
    const tokenCounts = model.canonicalEvalTokenCounts?.terminalBench41
      ?? model.canonicalEvalTokenCounts?.terminalBench40
    if (!tokenCounts) continue

    const input = asFiniteNumber(tokenCounts.input)
    const answer = asFiniteNumber(tokenCounts.answer)
    const reasoning = asFiniteNumber(tokenCounts.reasoning)
    const cacheable = asFiniteNumber(tokenCounts.cacheableInput) ?? 0
    const hitRate = asFiniteNumber(model.cacheHitRate)
    if (input === null || answer === null || reasoning === null || hitRate === null) continue

    const bucket = byEffort.get(effort) ?? {
      input: [], answer: [], reasoning: [], cacheable: [], hitRate: []
    }
    bucket.input.push(input / TERMINAL_BENCH_TASK_COUNT)
    bucket.answer.push(answer / TERMINAL_BENCH_TASK_COUNT)
    bucket.reasoning.push(reasoning / TERMINAL_BENCH_TASK_COUNT)
    bucket.cacheable.push(cacheable / TERMINAL_BENCH_TASK_COUNT)
    bucket.hitRate.push(hitRate)
    byEffort.set(effort, bucket)
  }

  const profiles = new Map<ReasoningEffort, TokenProfile>()
  for (const [effort, bucket] of byEffort) {
    const profile: TokenProfile = {
      inputTokens: median(bucket.input) ?? 0,
      answerTokens: median(bucket.answer) ?? 0,
      reasoningTokens: median(bucket.reasoning) ?? 0,
      cacheableInputTokens: median(bucket.cacheable) ?? 0,
      cacheHitRate: median(bucket.hitRate) ?? 0
    }
    profiles.set(effort, profile)
  }

  return profiles
}

/**
 * Estimated cost of one attempt for a model without a measured benchmark run.
 * The estimate reuses the median token profile of the same effort tier and
 * the model's own token prices, so it is an approximation - never a
 * measurement.
 */
export function estimateCostPerTask(
  profile: TokenProfile | undefined,
  prices: {
    inputPricePerMillion: number | null
    outputPricePerMillion: number | null
    cacheHitPricePerMillion?: number | null
    cacheWritePricePerMillion?: number | null
  }
): number | null {
  if (!profile) return null
  const {
    inputPricePerMillion,
    outputPricePerMillion,
    cacheHitPricePerMillion,
    cacheWritePricePerMillion
  } = prices
  // A model without published token prices gets no estimate - zero would
  // wrongly rank it as free.
  if (inputPricePerMillion == null || outputPricePerMillion == null) return null
  if (!Number.isFinite(inputPricePerMillion) || !Number.isFinite(outputPricePerMillion)) return null

  const cacheReadTokens = profile.cacheableInputTokens * profile.cacheHitRate
  const cacheWriteTokens = Math.max(profile.inputTokens - cacheReadTokens, 0)
  const hasCachePrices = cacheHitPricePerMillion != null && cacheWritePricePerMillion != null

  const cost = hasCachePrices
    ? cacheReadTokens / 1_000_000 * cacheHitPricePerMillion! +
      cacheWriteTokens / 1_000_000 * cacheWritePricePerMillion! +
      (profile.answerTokens + profile.reasoningTokens) / 1_000_000 * outputPricePerMillion
    : profile.inputTokens / 1_000_000 * inputPricePerMillion +
      (profile.answerTokens + profile.reasoningTokens) / 1_000_000 * outputPricePerMillion

  // A zero estimate is legitimate: models with published zero prices are
  // free. Only missing prices yield null.
  return cost >= 0 ? cost : null
}

// ============================================================================
// Public API
// ============================================================================

/** Looks up a Terminal-Bench measurement for a model slug, name and version. */
export function getTerminalBenchBenchmark(
  modelSlug: string,
  modelName: string,
  measurements: Map<string, TerminalBenchMeasurement>,
  version: TerminalBenchVersion
): TerminalBenchMeasurement | null {
  const key = measurementKey(baseReleaseSlug(modelSlug), extractEffortFromName(modelName))
  return measurements.get(`${key}|${version}`) ?? null
}

/** Looks up a DeepSWE measurement for a model slug and name. */
export function getDeepSweBenchmark(
  modelSlug: string,
  modelName: string,
  costs: Map<string, BenchmarkMeasurement>
): BenchmarkMeasurement | null {
  const key = measurementKey(baseReleaseSlug(modelSlug), extractEffortFromName(modelName))
  return costs.get(key) ?? null
}

export function getDeepSweCost(
  modelSlug: string,
  modelName: string,
  costs: Map<string, BenchmarkMeasurement>
): number | null {
  return getDeepSweBenchmark(modelSlug, modelName, costs)?.costPerTask ?? null
}

export function averageBenchmarkCosts(costs: Array<number | null | undefined>): number | null {
  const available = costs.filter((cost): cost is number =>
    typeof cost === 'number' && Number.isFinite(cost) && cost >= 0
  )
  if (available.length === 0) return null
  return available.reduce((sum, cost) => sum + cost, 0) / available.length
}

export async function fetchCodingBenchmarkCosts(): Promise<CodingBenchmarkCosts> {
  const terminalBench = await fetchTerminalBenchCosts().catch(error => {
    console.warn('Failed to fetch Terminal-Bench costs:', error)
    return { measurements: new Map<string, TerminalBenchMeasurement>(), profiles: new Map<ReasoningEffort, TokenProfile>() }
  })

  const deepSwe = await fetchDeepSweCosts().catch(error => {
    console.warn('Failed to fetch DeepSWE costs:', error)
    return new Map<string, BenchmarkMeasurement>()
  })

  let referenceProfiles = terminalBench.profiles
  if (referenceProfiles.size === 0) {
    const html = await $fetch<string>(TERMINAL_BENCH_URL).catch(() => null)
    referenceProfiles = html ? buildReferenceProfiles(html) : new Map<ReasoningEffort, TokenProfile>()
  }

  return {
    terminalBench: terminalBench.measurements,
    deepSwe,
    referenceProfiles
  }
}
