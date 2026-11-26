export interface AAModel {
  id: string
  name: string
  slug: string
  model_creator: { id: string; name: string; slug: string }
  evaluations: {
    artificial_analysis_intelligence_index: number | null | undefined
    artificial_analysis_coding_index?: number | null
    [key: string]: number | null | undefined
  }
  artificial_analysis_intelligence_index_cost?: {
    cost_per_task?: {
      total_cost?: number | null
    }
  }
  pricing: {
    price_1m_blended_3_to_1: number | null
    price_1m_input_tokens: number | null
    price_1m_output_tokens: number | null
    price_1m_cache_hit_tokens: number | null
    price_1m_cache_write_tokens: number | null
  }
  median_output_tokens_per_second: number
  median_time_to_first_token_seconds: number
}

export interface BenchLMModel {
  model: string
  creator?: string | null
  categoryScores?: {
    coding?: number | null
  }
  evidenceStatus?: string | null
}

/**
 * Wire format of the current Artificial Analysis V2 API.
 * `/api/v2/data/*` was retired on 2026-11-04 (410 Gone) and replaced by
 * `/api/v2/language/models` (Pro+) and `/api/v2/language/models/free`.
 */
interface AARawPricing {
  price_1m_blended_3_to_1?: number | null
  price_1m_input_tokens?: number | null
  price_1m_output_tokens?: number | null
  price_1m_cache_hit_tokens?: number | null
  price_1m_cache_write_tokens?: number | null
}

interface AARawPerformance {
  median_output_tokens_per_second?: number | null
  median_time_to_first_token_seconds?: number | null
}

interface AARawPerformanceV3 {
  mean_output_tokens_per_second?: number | null
  mean_time_to_first_token_seconds?: number | null
}

interface AARawModel {
  id: string
  name: string
  slug: string
  model_creator?: { id: string; name: string; slug?: string } | null
  evaluations?: Record<string, number | null | undefined>
  artificial_analysis_intelligence_index_cost?: {
    cost_per_task?: { total_cost?: number | null }
  } | null
  pricing?: AARawPricing | null
  performance?: AARawPerformance | null
  performance_v3?: AARawPerformanceV3 | null
}

interface AARawListResponse {
  tier?: string
  pagination?: {
    page?: number
    page_size?: number
    total_pages?: number
    has_more?: boolean
  }
  data?: AARawModel[]
}

interface BenchLMResponse {
  lastUpdated?: string
  models?: BenchLMModel[]
}

export function requireApiKey(): string {
  const config = useRuntimeConfig()
  const apiKey = config.artificialAnalysisApiKey || process.env.ARTIFICIAL_ANALYSIS_API_KEY
  if (!apiKey?.trim()) {
    throw createError({
      statusCode: 500,
      message: 'Artificial Analysis API key is not configured. Set ARTIFICIAL_ANALYSIS_API_KEY or NUXT_ARTIFICIAL_ANALYSIS_API_KEY.'
    })
  }
  return apiKey.trim()
}

const AA_API_BASE = 'https://artificialanalysis.ai/api/v2'
const AA_MODELS_PATH = '/language/models'
const AA_FREE_MODELS_PATH = '/language/models/free'
const AA_CACHE_KEY = 'aa:language-models'
/**
 * The free tier only allows 100 requests per 24h window and a full model
 * list costs one request per page, so the downloaded list is cached on disk.
 */
const AA_CACHE_TTL_MS = 6 * 60 * 60 * 1000

interface AACacheEntry {
  fetchedAt: number
  models: AAModel[]
}

let memoryCache: AACacheEntry | null = null

function slugifyCreator(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Map the V2 wire format onto the shape the rest of the app works with. */
export function normalizeAAModel(raw: AARawModel): AAModel {
  const pricing = raw.pricing ?? {}
  const inputPrice = pricing.price_1m_input_tokens ?? null
  const outputPrice = pricing.price_1m_output_tokens ?? null
  // Blended pricing is Pro-only. Approximate the 3:1 input/output blend so
  // the category buckets keep working for free-tier keys. A missing price
  // stays null: a model without published prices is not free.
  const blendedPrice = pricing.price_1m_blended_3_to_1
    ?? (inputPrice != null || outputPrice != null ? (3 * (inputPrice ?? 0) + (outputPrice ?? 0)) / 4 : null)

  const performance = raw.performance ?? {}
  const performanceV3 = raw.performance_v3 ?? {}
  const creator = raw.model_creator

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    model_creator: {
      id: creator?.id ?? '',
      name: creator?.name ?? 'Unknown',
      slug: creator?.slug ?? slugifyCreator(creator?.name ?? 'unknown')
    },
    evaluations: {
      ...(raw.evaluations ?? {}),
      artificial_analysis_intelligence_index: raw.evaluations?.artificial_analysis_intelligence_index ?? null,
      artificial_analysis_coding_index: raw.evaluations?.artificial_analysis_coding_index ?? null
    },
    artificial_analysis_intelligence_index_cost: raw.artificial_analysis_intelligence_index_cost ?? undefined,
    pricing: {
      price_1m_blended_3_to_1: blendedPrice,
      price_1m_input_tokens: inputPrice,
      price_1m_output_tokens: outputPrice,
      price_1m_cache_hit_tokens: pricing.price_1m_cache_hit_tokens ?? null,
      price_1m_cache_write_tokens: pricing.price_1m_cache_write_tokens ?? null
    },
    // Median performance is retired on 2026-12-10, fall back to the v3 means.
    median_output_tokens_per_second:
      performance.median_output_tokens_per_second ?? performanceV3.mean_output_tokens_per_second ?? 0,
    median_time_to_first_token_seconds:
      performance.median_time_to_first_token_seconds ?? performanceV3.mean_time_to_first_token_seconds ?? 0
  }
}

async function fetchAAList(apiKey: string, path: string, page: number): Promise<AARawListResponse> {
  return await $fetch<AARawListResponse>(`${AA_API_BASE}${path}`, {
    headers: { 'x-api-key': apiKey },
    query: page > 1 ? { page } : undefined
  })
}

async function downloadAAModels(apiKey: string): Promise<AAModel[]> {
  // The free endpoint accepts every key and reports the tier, so it doubles
  // as a tier probe. Pro/Commercial keys get the richer endpoint.
  const probe = await fetchAAList(apiKey, AA_FREE_MODELS_PATH, 1)
  const isPro = probe.tier !== undefined && probe.tier !== 'free'
  const path = isPro ? AA_MODELS_PATH : AA_FREE_MODELS_PATH
  const firstPage = isPro ? await fetchAAList(apiKey, path, 1) : probe
  const totalPages = firstPage.pagination?.total_pages ?? 1

  const rawModels: AARawModel[] = [...(firstPage.data ?? [])]
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchAAList(apiKey, path, page)
    rawModels.push(...(next.data ?? []))
  }

  // The catalog is imported in full. Models without an Intelligence Index
  // or prices stay in the database with null values so coverage counts and
  // the ranking views can show what is actually measured versus missing.
  return rawModels.map(normalizeAAModel)
}

async function readCachedModels(): Promise<AAModel[] | null> {
  if (memoryCache?.models.length && Date.now() - memoryCache.fetchedAt <= AA_CACHE_TTL_MS) {
    return memoryCache.models
  }

  try {
    const entry = await useStorage('cache').getItem<AACacheEntry>(AA_CACHE_KEY)
    if (entry?.models?.length && Date.now() - entry.fetchedAt <= AA_CACHE_TTL_MS) {
      memoryCache = entry
      return entry.models
    }
  } catch {
    // The cache mount is not available in every deployment - the in-memory
    // cache still covers a single running process.
  }

  return null
}

async function writeCachedModels(models: AAModel[]): Promise<void> {
  const entry: AACacheEntry = { fetchedAt: Date.now(), models }
  memoryCache = entry

  try {
    await useStorage('cache').setItem(AA_CACHE_KEY, entry)
  } catch {
    // Disk cache unavailable, the in-memory copy is enough for this process.
  }
}

/**
 * Download the model list. Results are cached because the free tier only
 * allows 100 requests per 24 hours.
 */
export async function fetchModelsFromAA(apiKey: string, options?: { forceRefresh?: boolean }): Promise<AAModel[]> {
  if (!options?.forceRefresh) {
    const cached = await readCachedModels()
    if (cached) return cached
  }

  try {
    const models = await downloadAAModels(apiKey)
    await writeCachedModels(models)
    return models
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null
      ? (error as { response?: { status?: number }; statusCode?: number }).response?.status
        ?? (error as { statusCode?: number }).statusCode
      : undefined

    if (status === 401) {
      throw createError({
        statusCode: 502,
        message: 'Artificial Analysis rejected the API key (401 Unauthorized). Update ARTIFICIAL_ANALYSIS_API_KEY or NUXT_ARTIFICIAL_ANALYSIS_API_KEY in the dev environment.'
      })
    }

    if (status === 429) {
      throw createError({
        statusCode: 502,
        message: 'Artificial Analysis rate limit reached (100 requests per 24h on the free tier). Try again after the quota resets.'
      })
    }

    throw error
  }
}

/** Number of models Artificial Analysis publishes for the configured key. */
export async function fetchAAModelCount(apiKey: string): Promise<number> {
  const models = await fetchModelsFromAA(apiKey)
  return models.length
}

export async function fetchBenchLMModels(): Promise<BenchLMModel[]> {
  try {
    const response = await $fetch<BenchLMResponse>('https://benchlm.ai/api/data/leaderboard')
    return response.models ?? []
  } catch (error) {
    console.warn('Failed to fetch BenchLM scores; preserving existing values:', error)
    return []
  }
}

function normalizeModelName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeBaseModelName(value: string): string {
  const baseName = value.split('(', 1)[0] ?? value
  return normalizeModelName(baseName)
}

export type BenchLMMatchType = 'exact' | 'family'

export interface BenchLMMatch {
  model: BenchLMModel
  matchType: BenchLMMatchType
}

function selectProviderMatch(
  model: AAModel,
  candidates: BenchLMModel[]
): BenchLMModel | undefined {
  const normalizedProvider = normalizeModelName(model.model_creator.name)
  const providerMatches = candidates.filter(candidate => {
    const creator = normalizeModelName(candidate.creator ?? '')
    return creator !== '' && creator === normalizedProvider
  })

  if (providerMatches.length === 1) return providerMatches[0]

  // A source row without a creator is safe only when the model name itself is
  // unique. Never select an arbitrary row from a family with ambiguous names.
  const [onlyCandidate] = candidates
  if (providerMatches.length === 0 && onlyCandidate && !onlyCandidate.creator) {
    return onlyCandidate
  }

  return undefined
}

/**
 * Match an exact configuration first. If BenchLM only publishes a base-family
 * row, keep that fallback explicit so callers can lower its confidence.
 */
export function findBenchLMMatch(model: AAModel, benchModels: BenchLMModel[]): BenchLMMatch | undefined {
  const exactCandidates = benchModels.filter(candidate =>
    normalizeModelName(candidate.model) === normalizeModelName(model.name)
  )
  const exact = selectProviderMatch(model, exactCandidates)
  if (exact) return { model: exact, matchType: 'exact' }

  const baseName = normalizeBaseModelName(model.name)
  const familyCandidates = benchModels.filter(candidate =>
    normalizeBaseModelName(candidate.model) === baseName
  )
  const family = selectProviderMatch(model, familyCandidates)
  if (family) return { model: family, matchType: 'family' }

  return undefined
}
