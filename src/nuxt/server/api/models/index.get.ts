import { query } from '../../utils/db'

interface ModelRow {
  id: string
  name: string
  slug: string
  provider: string
  provider_logo: string
  intelligence_index: number | null
  coding_index?: number | string | null
  terminal_bench_score?: number | string | null
  terminal_bench_41_score?: number | string | null
  terminal_bench_41_cost_per_task?: number | string | null
  terminal_bench_41_cost_per_successful_task?: number | string | null
  deep_swe_score?: number | string | null
  deep_swe_harness?: string | null
  deep_swe_reasoning_effort?: string | null
  deep_swe_ci_low?: number | string | null
  deep_swe_ci_high?: number | string | null
  deep_swe_runs?: number | string | null
  deep_swe_pass_at_4?: number | string | null
  deep_swe_tasks_attempted?: number | string | null
  deep_swe_passed_attempts?: number | string | null
  deep_swe_attempts?: number | string | null
  deep_swe_mean_input_tokens?: number | string | null
  deep_swe_mean_uncached_input_tokens?: number | string | null
  deep_swe_mean_cache_read_tokens?: number | string | null
  deep_swe_mean_cache_write_tokens?: number | string | null
  deep_swe_mean_output_tokens?: number | string | null
  deep_swe_mean_reasoning_tokens?: number | string | null
  deep_swe_median_agent_steps?: number | string | null
  deep_swe_mean_duration_seconds?: number | string | null
  benchlm_coding_score?: number | string | null
  benchlm_evidence_status?: string | null
  benchlm_model_name?: string | null
  benchlm_match_type?: 'exact' | 'family' | string | null
  aa_intelligence_cost_per_task?: number | string | null
  terminal_bench_cost_per_task?: number | string | null
  deep_swe_cost_per_task?: number | string | null
  coding_agent_cost_per_task?: number | string | null
  terminal_bench_cost_per_successful_task?: number | string | null
  deep_swe_cost_per_successful_task?: number | string | null
  coding_agent_cost_per_successful_task?: number | string | null
  aa_coding_agent_index?: number | string | null
  aa_coding_agent_cost_per_task?: number | string | null
  aa_coding_agent_name?: string | null
  estimated_cost_per_task?: number | string | null
  cost_per_task?: number | string | null
  input_price_per_m?: number | string | null
  output_price_per_m?: number | string | null
  cache_hit_price_per_m?: number | string | null
  cache_write_price_per_m?: number | string | null
  category: string | null
  strengths?: string[] | string | null
  context_window: string
  open_weights: boolean
  speed: number | null
  latency: number | string | null
}

interface ApiModel {
  id: string
  name: string
  slug: string
  provider: string
  providerLogo: string
  intelligenceIndex: number | null
  codingIndex: number | null
  terminalBenchScore: number | null
  terminalBench41Score: number | null
  terminalBench41CostPerTask: number | null
  terminalBench41CostPerSuccessfulTask: number | null
  deepSweScore: number | null
  deepSweHarness: string | null
  deepSweReasoningEffort: string | null
  deepSweCiLow: number | null
  deepSweCiHigh: number | null
  deepSweRuns: number | null
  deepSwePassAt4: number | null
  deepSweTasksAttempted: number | null
  deepSwePassedAttempts: number | null
  deepSweAttempts: number | null
  deepSweMeanInputTokens: number | null
  deepSweMeanUncachedInputTokens: number | null
  deepSweMeanCacheReadTokens: number | null
  deepSweMeanCacheWriteTokens: number | null
  deepSweMeanOutputTokens: number | null
  deepSweMeanReasoningTokens: number | null
  deepSweMedianAgentSteps: number | null
  deepSweMeanDurationSeconds: number | null
  benchLmCodingScore: number | null
  benchLmEvidenceStatus: string | null
  benchLmModelName: string | null
  benchLmMatchType: 'exact' | 'family' | null
  aaIntelligenceCostPerTask: number | null
  terminalBenchCostPerTask: number | null
  deepSweCostPerTask: number | null
  codingAgentCostPerTask: number | null
  terminalBenchCostPerSuccessfulTask: number | null
  deepSweCostPerSuccessfulTask: number | null
  codingAgentCostPerSuccessfulTask: number | null
  aaCodingAgentIndex: number | null
  aaCodingAgentCostPerTask: number | null
  aaCodingAgentName: string | null
  estimatedCostPerTask: number | null
  costPerTask: number | null
  costSource: 'measured-coding' | 'proxy' | 'unknown'
  inputPricePerM: number | null
  outputPricePerM: number | null
  cacheHitPricePerM: number | null
  cacheWritePricePerM: number | null
  category: string | null
  strengths: string[]
  contextWindow: string
  openWeights: boolean
  speed: number | null
  latency: number | null
}

function parseNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseStrengths(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.length > 0) return value.split(',').filter(Boolean)
  return []
}

export default defineEventHandler(async () => {
  try {
    const rows = await query<ModelRow>(
      'SELECT * FROM models ORDER BY intelligence_index DESC'
    )

    const models: ApiModel[] = rows.map(row => {
      const aaIntelligenceCost = parseNullableNumber(row.aa_intelligence_cost_per_task)
      const terminalBenchCost = parseNullableNumber(row.terminal_bench_cost_per_task)
      const deepSweCost = parseNullableNumber(row.deep_swe_cost_per_task)
      const codingAgentCost = parseNullableNumber(row.coding_agent_cost_per_task)
      const terminalBenchSuccessfulCost = parseNullableNumber(row.terminal_bench_cost_per_successful_task)
      const deepSweSuccessfulCost = parseNullableNumber(row.deep_swe_cost_per_successful_task)
      const codingAgentSuccessfulCost = parseNullableNumber(row.coding_agent_cost_per_successful_task)
      const legacyCost = parseNullableNumber(row.cost_per_task)
      const costPerTask = codingAgentSuccessfulCost ?? aaIntelligenceCost ?? legacyCost
      const costSource = codingAgentSuccessfulCost != null
        ? 'measured-coding'
        : aaIntelligenceCost != null || legacyCost != null
          ? 'proxy'
          : 'unknown'

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        provider: row.provider,
        providerLogo: row.provider_logo,
        intelligenceIndex: row.intelligence_index,
        codingIndex: parseNullableNumber(row.coding_index),
        terminalBenchScore: parseNullableNumber(row.terminal_bench_score),
        terminalBench41Score: parseNullableNumber(row.terminal_bench_41_score),
        terminalBench41CostPerTask: parseNullableNumber(row.terminal_bench_41_cost_per_task),
        terminalBench41CostPerSuccessfulTask: parseNullableNumber(row.terminal_bench_41_cost_per_successful_task),
        benchLmCodingScore: parseNullableNumber(row.benchlm_coding_score),
        benchLmEvidenceStatus: row.benchlm_evidence_status ?? null,
        benchLmModelName: row.benchlm_model_name ?? null,
        benchLmMatchType: row.benchlm_match_type === 'exact' || row.benchlm_match_type === 'family'
          ? row.benchlm_match_type
          : null,
        aaIntelligenceCostPerTask: aaIntelligenceCost ?? legacyCost,
        terminalBenchCostPerTask: terminalBenchCost,
        deepSweScore: parseNullableNumber(row.deep_swe_score),
        deepSweHarness: row.deep_swe_harness ?? null,
        deepSweReasoningEffort: row.deep_swe_reasoning_effort ?? null,
        deepSweCiLow: parseNullableNumber(row.deep_swe_ci_low),
        deepSweCiHigh: parseNullableNumber(row.deep_swe_ci_high),
        deepSweRuns: parseNullableNumber(row.deep_swe_runs),
        deepSwePassAt4: parseNullableNumber(row.deep_swe_pass_at_4),
        deepSweTasksAttempted: parseNullableNumber(row.deep_swe_tasks_attempted),
        deepSwePassedAttempts: parseNullableNumber(row.deep_swe_passed_attempts),
        deepSweAttempts: parseNullableNumber(row.deep_swe_attempts),
        deepSweMeanInputTokens: parseNullableNumber(row.deep_swe_mean_input_tokens),
        deepSweMeanUncachedInputTokens: parseNullableNumber(row.deep_swe_mean_uncached_input_tokens),
        deepSweMeanCacheReadTokens: parseNullableNumber(row.deep_swe_mean_cache_read_tokens),
        deepSweMeanCacheWriteTokens: parseNullableNumber(row.deep_swe_mean_cache_write_tokens),
        deepSweMeanOutputTokens: parseNullableNumber(row.deep_swe_mean_output_tokens),
        deepSweMeanReasoningTokens: parseNullableNumber(row.deep_swe_mean_reasoning_tokens),
        deepSweMedianAgentSteps: parseNullableNumber(row.deep_swe_median_agent_steps),
        deepSweMeanDurationSeconds: parseNullableNumber(row.deep_swe_mean_duration_seconds),
        deepSweCostPerTask: deepSweCost,
        codingAgentCostPerTask: codingAgentCost,
        terminalBenchCostPerSuccessfulTask: terminalBenchSuccessfulCost,
        deepSweCostPerSuccessfulTask: deepSweSuccessfulCost,
        codingAgentCostPerSuccessfulTask: codingAgentSuccessfulCost,
        aaCodingAgentIndex: parseNullableNumber(row.aa_coding_agent_index),
        aaCodingAgentCostPerTask: parseNullableNumber(row.aa_coding_agent_cost_per_task),
        aaCodingAgentName: row.aa_coding_agent_name ?? null,
        estimatedCostPerTask: parseNullableNumber(row.estimated_cost_per_task),
        costPerTask,
        costSource,
        inputPricePerM: parseNullableNumber(row.input_price_per_m),
        outputPricePerM: parseNullableNumber(row.output_price_per_m),
        cacheHitPricePerM: parseNullableNumber(row.cache_hit_price_per_m),
        cacheWritePricePerM: parseNullableNumber(row.cache_write_price_per_m),
        category: row.category,
        strengths: parseStrengths(row.strengths),
        contextWindow: row.context_window,
        openWeights: row.open_weights,
        speed: row.speed,
        latency: parseNullableNumber(row.latency)
      }
    })

    const latestUpdate = await query<{ updated_at: string }>(
      'SELECT updated_at FROM models ORDER BY updated_at DESC LIMIT 1'
    )

    return {
      source: 'artificialanalysis.ai + benchlm.ai + terminalbench + deepswe',
      updatedAt: latestUpdate[0]?.updated_at || new Date().toISOString(),
      totalModels: models.length,
      models
    }
  } catch (error: unknown) {
    console.error('Failed to fetch models from database:', error)

    // Fallback to JSON file if database is not available.
    try {
      const { readFile } = await import('fs/promises')
      const { join } = await import('path')
      const dataPath = join(process.cwd(), 'app', 'data', 'models-live.json')
      const data = await readFile(dataPath, 'utf-8')
      return JSON.parse(data)
    } catch {
      throw createError({
        statusCode: 500,
        message: 'No models available. Run /api/models/refresh to scrape data.'
      })
    }
  }
})
