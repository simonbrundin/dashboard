/**
 * Builds and stores model rows.
 *
 * Every benchmark owns its own score and cost columns. They are overwritten
 * on every import so a new score can never be paired with a stale cost from
 * a different measurement.
 */

import {
  estimateCostPerTask,
  getDeepSweBenchmark,
  getTerminalBenchBenchmark,
  type CodingBenchmarkCosts,
  type TerminalBenchMeasurement
} from './benchmarkCosts'
import {
  selectBestAgentForModel,
  type CodingAgentBenchmark
} from './fetchCodingAgents'
import { extractEffortFromName } from '../../shared/utils/modelEffort'
import type { AAModel, BenchLMMatch } from './artificialAnalysis'

export interface ModelRowInputs {
  benchmarkCosts: CodingBenchmarkCosts
  codingAgents: CodingAgentBenchmark[]
}

const MODEL_INSERT = `
  INSERT INTO models (id, name, slug, provider, provider_logo, intelligence_index,
    coding_index,
    terminal_bench_score, terminal_bench_cost_per_task, terminal_bench_cost_per_successful_task,
    terminal_bench_41_score, terminal_bench_41_cost_per_task, terminal_bench_41_cost_per_successful_task,
    deep_swe_score, deep_swe_cost_per_task, deep_swe_cost_per_successful_task,
    benchlm_coding_score, benchlm_evidence_status, benchlm_model_name, benchlm_match_type,
    aa_coding_agent_index, aa_coding_agent_cost_per_task, aa_coding_agent_name,
    aa_intelligence_cost_per_task, estimated_cost_per_task,
    cost_per_task,
    input_price_per_m, output_price_per_m, category,
    strengths, context_window, open_weights, speed, latency)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
    $32, $33, $34)
`

/**
 * Benchmark columns are owned by their source and are replaced on every
 * import. A missing measurement therefore clears the old value instead of
 * keeping a score from one measurement and a cost from another.
 */
export const UPSERT_MODELS = `${MODEL_INSERT}
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, provider = EXCLUDED.provider,
    provider_logo = EXCLUDED.provider_logo,
    intelligence_index = EXCLUDED.intelligence_index,
    coding_index = COALESCE(EXCLUDED.coding_index, models.coding_index),
    terminal_bench_score = EXCLUDED.terminal_bench_score,
    terminal_bench_cost_per_task = EXCLUDED.terminal_bench_cost_per_task,
    terminal_bench_cost_per_successful_task = EXCLUDED.terminal_bench_cost_per_successful_task,
    terminal_bench_41_score = EXCLUDED.terminal_bench_41_score,
    terminal_bench_41_cost_per_task = EXCLUDED.terminal_bench_41_cost_per_task,
    terminal_bench_41_cost_per_successful_task = EXCLUDED.terminal_bench_41_cost_per_successful_task,
    deep_swe_score = EXCLUDED.deep_swe_score,
    deep_swe_cost_per_task = EXCLUDED.deep_swe_cost_per_task,
    deep_swe_cost_per_successful_task = EXCLUDED.deep_swe_cost_per_successful_task,
    benchlm_coding_score = EXCLUDED.benchlm_coding_score,
    benchlm_evidence_status = EXCLUDED.benchlm_evidence_status,
    benchlm_model_name = EXCLUDED.benchlm_model_name,
    benchlm_match_type = EXCLUDED.benchlm_match_type,
    aa_coding_agent_index = EXCLUDED.aa_coding_agent_index,
    aa_coding_agent_cost_per_task = EXCLUDED.aa_coding_agent_cost_per_task,
    aa_coding_agent_name = EXCLUDED.aa_coding_agent_name,
    aa_intelligence_cost_per_task = COALESCE(
      EXCLUDED.aa_intelligence_cost_per_task,
      models.aa_intelligence_cost_per_task
    ),
    estimated_cost_per_task = EXCLUDED.estimated_cost_per_task,
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
  await query(`
    ALTER TABLE models ADD COLUMN IF NOT EXISTS coding_index DECIMAL(5, 2);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS terminal_bench_score DECIMAL(5, 2);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS terminal_bench_41_score DECIMAL(5, 2);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS terminal_bench_41_cost_per_task DECIMAL(10, 4);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS terminal_bench_41_cost_per_successful_task DECIMAL(10, 4);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS deep_swe_score DECIMAL(5, 2);
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
    ALTER TABLE models ADD COLUMN IF NOT EXISTS aa_coding_agent_name VARCHAR(100);
    ALTER TABLE models ADD COLUMN IF NOT EXISTS estimated_cost_per_task DECIMAL(10, 4);
    -- The catalog is imported in full: models without a score or prices keep
    -- null values instead of being dropped or faked as zero.
    ALTER TABLE models ALTER COLUMN intelligence_index DROP NOT NULL;
    ALTER TABLE models ALTER COLUMN category DROP NOT NULL;
    UPDATE models
    SET aa_intelligence_cost_per_task = cost_per_task
    WHERE aa_intelligence_cost_per_task IS NULL AND cost_per_task IS NOT NULL;
  `)
}

function round(value: number | null | undefined, digits: number): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function terminalBenchRow(
  measurement: TerminalBenchMeasurement | null,
  version: '4.1' | '4.0'
): { score: number | null; costPerTask: number | null; costPerSuccessfulTask: number | null } {
  if (!measurement || measurement.version !== version) {
    return { score: null, costPerTask: null, costPerSuccessfulTask: null }
  }
  return {
    score: round(measurement.score, 2),
    costPerTask: round(measurement.costPerTask, 4),
    costPerSuccessfulTask: round(measurement.costPerSuccessfulTask, 4)
  }
}

/** Assembles the database row for one Artificial Analysis model. */
export function buildModelRow(
  model: AAModel,
  benchMatch: BenchLMMatch | undefined,
  inputs: ModelRowInputs
): unknown[] {
  const { benchmarkCosts, codingAgents } = inputs

  const terminalBench = getTerminalBenchBenchmark(
    model.slug,
    model.name,
    benchmarkCosts.terminalBench,
    '4.0'
  )
  const terminalBench41 = getTerminalBenchBenchmark(
    model.slug,
    model.name,
    benchmarkCosts.terminalBench,
    '4.1'
  )
  const terminalBench40 = terminalBenchRow(terminalBench, '4.0')
  const terminalBench41Row = terminalBenchRow(terminalBench41, '4.1')

  const deepSwe = getDeepSweBenchmark(model.slug, model.name, benchmarkCosts.deepSwe)

  const agentSelection = selectBestAgentForModel(codingAgents, model.name)

  const profile = benchmarkCosts.referenceProfiles.get(extractEffortFromName(model.name))
    ?? benchmarkCosts.referenceProfiles.get('max')
  const estimatedCostPerTask = estimateCostPerTask(profile, {
    inputPricePerMillion: model.pricing.price_1m_input_tokens,
    outputPricePerMillion: model.pricing.price_1m_output_tokens,
    cacheHitPricePerMillion: model.pricing.price_1m_cache_hit_tokens,
    cacheWritePricePerMillion: model.pricing.price_1m_cache_write_tokens
  })

  const codingIndex = model.evaluations.artificial_analysis_coding_index
  const aaTaskCost = model.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost
  const benchLmCodingScore = benchMatch?.model.categoryScores?.coding

  return [
    model.id,
    model.name,
    model.slug,
    model.model_creator.name,
    model.model_creator.slug,
    model.evaluations.artificial_analysis_intelligence_index == null
      ? null
      : Math.round(model.evaluations.artificial_analysis_intelligence_index),
    codingIndex == null ? null : Math.round(codingIndex * 100) / 100,
    terminalBench40.score,
    terminalBench40.costPerTask,
    terminalBench40.costPerSuccessfulTask,
    terminalBench41Row.score,
    terminalBench41Row.costPerTask,
    terminalBench41Row.costPerSuccessfulTask,
    round(deepSwe?.score, 2),
    round(deepSwe?.costPerTask, 4),
    round(deepSwe?.costPerSuccessfulTask, 4),
    benchLmCodingScore == null ? null : Math.round(benchLmCodingScore * 100) / 100,
    benchMatch?.model.evidenceStatus ?? null,
    benchMatch?.model.model ?? null,
    benchMatch?.matchType ?? null,
    round(agentSelection?.benchmark.indexScore, 2),
    round(agentSelection?.benchmark.costPerTask, 4),
    agentSelection?.benchmark.agentName ?? null,
    aaTaskCost == null ? null : aaTaskCost,
    round(estimatedCostPerTask, 4),
    null, // cost_per_task - legacy field, no longer written
    model.pricing.price_1m_input_tokens,
    model.pricing.price_1m_output_tokens,
    determineCategory(model.pricing.price_1m_blended_3_to_1),
    [],
    'N/A',
    isOpenWeights(model.name),
    Math.round(model.median_output_tokens_per_second),
    Math.round(model.median_time_to_first_token_seconds * 100) / 100
  ]
}

function determineCategory(pricePerMillion: number | null): string | null {
  if (pricePerMillion == null) return null
  if (pricePerMillion === 0) return 'budget'
  if (pricePerMillion > 50) return 'frontier'
  if (pricePerMillion > 10) return 'high'
  if (pricePerMillion > 1) return 'mid'
  return 'budget'
}

function isOpenWeights(name: string): boolean {
  const patterns = ['llama', 'gemma', 'mistral', 'qwen', 'deepseek-r1', 'deepseek-v3', 'phi', 'granite', 'devstral', 'codestral']
  const lower = name.toLowerCase()
  return patterns.some(pattern => lower.includes(pattern.toLowerCase()))
}
