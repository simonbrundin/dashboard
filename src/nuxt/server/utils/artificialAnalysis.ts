import { query } from './db'
import {
  averageBenchmarkCosts,
  costPerSuccessfulTask,
  getDeepSweBenchmark,
  type CodingBenchmarkCosts
} from './benchmarkCosts'
import {
  findCodingAgentBenchmark,
  type CodingAgentBenchmark
} from './fetchCodingAgents'

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
    price_1m_blended_3_to_1: number
    price_1m_input_tokens: number
    price_1m_output_tokens: number
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

interface AAAPIResponse {
  status: number
  data: AAModel[]
}

interface BenchLMResponse {
  lastUpdated?: string
  models?: BenchLMModel[]
}

const MODEL_INSERT = `
  INSERT INTO models (id, name, slug, provider, provider_logo, intelligence_index,
    coding_index, terminal_bench_score, benchlm_coding_score, benchlm_evidence_status,
    benchlm_model_name, benchlm_match_type,
    aa_intelligence_cost_per_task, terminal_bench_cost_per_task,
    deep_swe_cost_per_task, coding_agent_cost_per_task,
    terminal_bench_cost_per_successful_task, deep_swe_cost_per_successful_task,
    coding_agent_cost_per_successful_task,
    aa_coding_agent_index, aa_coding_agent_cost_per_task,
    cost_per_task,
    input_price_per_m, output_price_per_m, category,
    strengths, context_window, open_weights, speed, latency)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
`

/** Sync model metadata without replacing measured task costs. */
export const UPSERT_MODELS = `${MODEL_INSERT}
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, provider = EXCLUDED.provider,
    provider_logo = EXCLUDED.provider_logo,
    intelligence_index = EXCLUDED.intelligence_index,
    coding_index = COALESCE(EXCLUDED.coding_index, models.coding_index),
    terminal_bench_score = COALESCE(EXCLUDED.terminal_bench_score, models.terminal_bench_score),
    benchlm_coding_score = COALESCE(EXCLUDED.benchlm_coding_score, models.benchlm_coding_score),
    benchlm_evidence_status = COALESCE(EXCLUDED.benchlm_evidence_status, models.benchlm_evidence_status),
    benchlm_model_name = COALESCE(EXCLUDED.benchlm_model_name, models.benchlm_model_name),
    benchlm_match_type = COALESCE(EXCLUDED.benchlm_match_type, models.benchlm_match_type),
    aa_intelligence_cost_per_task = COALESCE(
      EXCLUDED.aa_intelligence_cost_per_task,
      models.aa_intelligence_cost_per_task
    ),
    terminal_bench_cost_per_task = COALESCE(
      EXCLUDED.terminal_bench_cost_per_task,
      models.terminal_bench_cost_per_task
    ),
    deep_swe_cost_per_task = COALESCE(
      EXCLUDED.deep_swe_cost_per_task,
      models.deep_swe_cost_per_task
    ),
    coding_agent_cost_per_task = COALESCE(
      EXCLUDED.coding_agent_cost_per_task,
      models.coding_agent_cost_per_task
    ),
    terminal_bench_cost_per_successful_task = COALESCE(
      EXCLUDED.terminal_bench_cost_per_successful_task,
      models.terminal_bench_cost_per_successful_task
    ),
    deep_swe_cost_per_successful_task = COALESCE(
      EXCLUDED.deep_swe_cost_per_successful_task,
      models.deep_swe_cost_per_successful_task
    ),
    coding_agent_cost_per_successful_task = COALESCE(
      EXCLUDED.coding_agent_cost_per_successful_task,
      models.coding_agent_cost_per_successful_task
    ),
    aa_coding_agent_index = COALESCE(
      EXCLUDED.aa_coding_agent_index,
      models.aa_coding_agent_index
    ),
    aa_coding_agent_cost_per_task = COALESCE(
      EXCLUDED.aa_coding_agent_cost_per_task,
      models.aa_coding_agent_cost_per_task
    ),
    input_price_per_m = EXCLUDED.input_price_per_m,
    output_price_per_m = EXCLUDED.output_price_per_m,
    category = EXCLUDED.category,
    open_weights = EXCLUDED.open_weights,
    speed = EXCLUDED.speed, latency = EXCLUDED.latency,
    updated_at = CURRENT_TIMESTAMP
`

/** Kept for callers that only want to insert genuinely new rows. */
export const INSERT_MODELS_IF_MISSING = `${MODEL_INSERT}
  ON CONFLICT DO NOTHING
`

export async function ensureModelsSchema(): Promise<void> {
  // Existing deployments may have been created before the additional source
  // and cost fields existed. The backfill preserves the old scraped value.
  await query(`
    ALTER TABLE models ADD COLUMN IF NOT EXISTS coding_index DECIMAL(5, 2);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS terminal_bench_score DECIMAL(5, 2);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS benchlm_coding_score DECIMAL(5, 2);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS benchlm_evidence_status VARCHAR(30);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS benchlm_model_name VARCHAR(500);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS benchlm_match_type VARCHAR(20);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS aa_intelligence_cost_per_task DECIMAL(10, 4);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS terminal_bench_cost_per_task DECIMAL(10, 4);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS deep_swe_cost_per_task DECIMAL(10, 4);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS coding_agent_cost_per_task DECIMAL(10, 4);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS terminal_bench_cost_per_successful_task DECIMAL(10, 4);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS deep_swe_cost_per_successful_task DECIMAL(10, 4);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS coding_agent_cost_per_successful_task DECIMAL(10, 4);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS aa_coding_agent_index DECIMAL(5, 2);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS aa_coding_agent_cost_per_task DECIMAL(10, 4);
    UPDATE models
    SET aa_intelligence_cost_per_task = cost_per_task
    WHERE aa_intelligence_cost_per_task IS NULL AND cost_per_task IS NOT NULL;
  `)
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

export async function fetchModelsFromAA(apiKey: string): Promise<AAModel[]> {
  try {
    const response = await $fetch<AAAPIResponse>('https://artificialanalysis.ai/api/v2/data/llms/models', {
      headers: { 'x-api-key': apiKey }
    })

    if (response.status !== 200) {
      throw createError({ statusCode: response.status, message: 'Failed to fetch from AA API' })
    }

    return response.data.filter(
      model => model.evaluations?.artificial_analysis_intelligence_index != null &&
        model.pricing?.price_1m_blended_3_to_1 !== undefined
    )
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

    throw error
  }
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

export function determineCategory(pricePerMillion: number): string {
  if (pricePerMillion === 0) return 'budget'
  if (pricePerMillion > 50) return 'frontier'
  if (pricePerMillion > 10) return 'high'
  if (pricePerMillion > 1) return 'mid'
  return 'budget'
}

export function isOpenWeights(name: string): boolean {
  const patterns = ['llama', 'gemma', 'mistral', 'qwen', 'deepseek-r1', 'deepseek-v3', 'phi', 'granite', 'devstral', 'codestral']
  const lower = name.toLowerCase()
  return patterns.some(pattern => lower.includes(pattern.toLowerCase()))
}

export function toModelRow(
  model: AAModel,
  benchMatch?: BenchLMMatch,
  benchmarkCosts?: CodingBenchmarkCosts,
  codingAgentBenchmarks?: CodingAgentBenchmark[]
): unknown[] {
  const codingIndex = model.evaluations.artificial_analysis_coding_index
  const aaTaskCost = model.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost
  const benchLmCodingScore = benchMatch?.model.categoryScores?.coding
  const terminalBench = benchmarkCosts?.terminalBench.get(model.slug) ?? null
  const deepSwe = benchmarkCosts
    ? getDeepSweBenchmark(model.slug, model.name, benchmarkCosts.deepSwe)
    : null
  const terminalBenchCost = terminalBench?.costPerTask ?? null
  const deepSweCost = deepSwe?.costPerTask ?? null
  const codingAgentCost = averageBenchmarkCosts([terminalBenchCost, deepSweCost])
  const terminalBenchCostPerSuccessfulTask = costPerSuccessfulTask(
    terminalBenchCost,
    terminalBench?.score
  )
  const deepSweCostPerSuccessfulTask = costPerSuccessfulTask(
    deepSweCost,
    deepSwe?.score
  )
  const codingAgentCostPerSuccessfulTask = averageBenchmarkCosts([
    terminalBenchCostPerSuccessfulTask,
    deepSweCostPerSuccessfulTask
  ])

  // Get AA Coding Agent Index data if available
  const codingAgentMatch = codingAgentBenchmarks
    ? findCodingAgentBenchmark(codingAgentBenchmarks, model.name, model.slug)
    : null
  const aaIndexScore = codingAgentMatch?.indexScore ?? null
  const aaIndexCost = codingAgentMatch?.costPerTask ?? null

  return [
    model.id, model.name, model.slug, model.model_creator.name, model.model_creator.slug,
    Math.round(model.evaluations.artificial_analysis_intelligence_index || 0),
    codingIndex == null ? null : Math.round(codingIndex * 100) / 100,
    terminalBench?.score == null ? null : Math.round(terminalBench.score * 100) / 100,
    benchLmCodingScore == null ? null : Math.round(benchLmCodingScore * 100) / 100,
    benchMatch?.model.evidenceStatus ?? null,
    benchMatch?.model.model ?? null,
    benchMatch?.matchType ?? null,
    aaTaskCost == null ? null : aaTaskCost,
    terminalBenchCost,
    deepSweCost,
    codingAgentCost,
    terminalBenchCostPerSuccessfulTask,
    deepSweCostPerSuccessfulTask,
    codingAgentCostPerSuccessfulTask,
    aaIndexScore,
    aaIndexCost,
    null, // cost_per_task - not computed here
    model.pricing.price_1m_input_tokens, model.pricing.price_1m_output_tokens,
    determineCategory(model.pricing.price_1m_blended_3_to_1), [], 'N/A',
    isOpenWeights(model.name),
    Math.round(model.median_output_tokens_per_second),
    Math.round(model.median_time_to_first_token_seconds * 100) / 100
  ]
}
