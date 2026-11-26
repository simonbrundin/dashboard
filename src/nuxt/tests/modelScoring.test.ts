import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ModelData } from '../app/data/models.ts'
import {
  getBenchmarkCostPerAttempt,
  getBenchmarkCostPerSuccessfulTask,
  getBenchmarkOption,
  getBenchmarkRankingMetric,
  getBenchmarkScore,
  RANKING_BENCHMARKS
} from '../app/utils/modelScoring.ts'
import {
  costPerSuccessfulTask,
  estimateCostPerTask,
  getDeepSweBenchmark,
  getTerminalBenchBenchmark,
  type CodingBenchmarkCosts,
  type TokenProfile
} from '../server/utils/benchmarkCosts.ts'
import {
  parseCodingAgentRows,
  selectBestAgentForModel
} from '../server/utils/fetchCodingAgents.ts'
import { normalizeAAModel, type AARawModel } from '../server/utils/artificialAnalysis.ts'
import { buildModelRow, type ModelRowInputs } from '../server/utils/modelRows.ts'
import {
  extractEffortFromName,
  measurementKey,
  modelMeasurementKey
} from '../shared/utils/modelEffort.ts'

function model(overrides: Partial<ModelData> = {}): ModelData {
  return {
    id: 'model-1',
    name: 'Test Model',
    provider: 'Test Provider',
    providerLogo: 'test',
    intelligenceIndex: 50,
    costPerTask: null,
    inputPricePerM: null,
    outputPricePerM: null,
    category: 'budget',
    strengths: [],
    contextWindow: 'N/A',
    openWeights: false,
    ...overrides
  }
}

test('cost per successful task treats the score as a percentage', () => {
  // 1 % pass rate must not be read as 100 %.
  assert.equal(costPerSuccessfulTask(0.5, 1), 50)
  assert.equal(costPerSuccessfulTask(0.5, 50), 1)
  assert.equal(costPerSuccessfulTask(0.5, 100), 0.5)
  assert.equal(costPerSuccessfulTask(0.5, 0), null)
  assert.equal(costPerSuccessfulTask(null, 50), null)
})

test('effort is read from the model name', () => {
  assert.equal(extractEffortFromName('Claude Opus 5 (Max, Default Fallback)'), 'max')
  assert.equal(extractEffortFromName('Gemini 4 Neon (Xhigh)'), 'xhigh')
  assert.equal(extractEffortFromName('GPT-6.1 Terra (Low)'), 'low')
  assert.equal(extractEffortFromName('Kimi K3.1 Pro'), 'max')
})

test('a measurement only matches the same release and effort', () => {
  const measurements = new Map<string, TerminalBenchMeasurement>([
    [`${measurementKey('gpt-6-astra', 'max')}|4.1`, {
      version: '4.1',
      score: 60,
      costPerTask: 2,
      costPerSuccessfulTask: 3.33
    }]
  ])

  assert.ok(getTerminalBenchBenchmark('gpt-6-astra', 'GPT-6 Astra (Max)', measurements, '4.1'))
  assert.equal(getTerminalBenchBenchmark('gpt-6-astra-low', 'GPT-6 Astra (Low)', measurements, '4.1'), null)
  assert.equal(getTerminalBenchBenchmark('gpt-6-astra', 'GPT-6 Astra (Max)', measurements, '4.0'), null)
})

test('DeepSWE measurements require the same effort', () => {
  const costs = new Map([
    [measurementKey('gpt-6-astra', 'max'), {
      score: 73,
      costPerTask: 7.5,
      costPerSuccessfulTask: 10.3
    }]
  ])

  assert.ok(getDeepSweBenchmark('gpt-6-astra', 'GPT-6 Astra (Max)', costs))
  assert.equal(getDeepSweBenchmark('gpt-6-astra-medium', 'GPT-6 Astra (Medium)', costs), null)
})

test('Terminal-Bench ranking uses cost per successful task without dividing the score again', () => {
  const candidate = model({
    terminalBench41Score: 80,
    terminalBench41CostPerTask: 0.1,
    terminalBench41CostPerSuccessfulTask: 0.125
  })

  assert.deepEqual(getBenchmarkRankingMetric(candidate, 'terminal-bench-4-1'), {
    value: 0.125,
    direction: 'asc',
    kind: 'cost-per-success',
    label: 'Cost per successful task'
  })
  assert.equal(getBenchmarkCostPerAttempt(candidate, 'terminal-bench-4-1'), 0.1)
  assert.equal(getBenchmarkCostPerSuccessfulTask(candidate, 'terminal-bench-4-1'), 0.125)
})

test('DeepSWE ranking uses only its own score and costs', () => {
  const candidate = model({
    deepSweScore: 70,
    deepSweCostPerTask: 0.2,
    deepSweCostPerSuccessfulTask: 0.4,
    terminalBench41Score: 99,
    terminalBench41CostPerSuccessfulTask: 0.02
  })

  assert.equal(getBenchmarkScore(candidate, 'deep-swe'), 70)
  assert.equal(getBenchmarkCostPerAttempt(candidate, 'deep-swe'), 0.2)
  assert.equal(getBenchmarkRankingMetric(candidate, 'deep-swe')?.value, 0.4)
})

test('AA Coding Agent ranking uses its own score and cost pair', () => {
  const candidate = model({
    aaCodingAgentIndex: 80,
    aaCodingAgentCostPerTask: 4,
    terminalBench41Score: 100,
    terminalBench41CostPerSuccessfulTask: 0.01
  })

  assert.deepEqual(getBenchmarkRankingMetric(candidate, 'aa-coding-agent'), {
    value: 20,
    direction: 'desc',
    kind: 'score-per-dollar',
    label: 'Coding Agent Index per dollar'
  })
})

test('AA Coding Agent ranking does not borrow a score or cost from another benchmark', () => {
  const candidate = model({
    terminalBench41Score: 80,
    terminalBench41CostPerSuccessfulTask: 0.1,
    benchLmCodingScore: 90,
    aaCodingAgentCostPerTask: 2
  })

  assert.equal(getBenchmarkRankingMetric(candidate, 'aa-coding-agent'), null)
})

test('BenchLM is a quality-only ranking and has no inferred cost', () => {
  const candidate = model({
    benchLmCodingScore: 85,
    benchLmEvidenceStatus: 'supported',
    benchLmMatchType: 'exact',
    terminalBench41CostPerSuccessfulTask: 0.2
  })

  assert.deepEqual(getBenchmarkRankingMetric(candidate, 'benchlm'), {
    value: 85,
    direction: 'desc',
    kind: 'score-only',
    label: 'BenchLM score (quality only)'
  })
  assert.equal(getBenchmarkCostPerAttempt(candidate, 'benchlm'), null)
  assert.equal(getBenchmarkCostPerSuccessfulTask(candidate, 'benchlm'), null)
})

test('BenchLM family matches are opt-in even when the source marks them supported', () => {
  const candidate = model({
    benchLmCodingScore: 82.1,
    benchLmEvidenceStatus: 'supported',
    benchLmMatchType: 'family'
  })

  assert.equal(getBenchmarkScore(candidate, 'benchlm'), null)
  assert.equal(getBenchmarkRankingMetric(candidate, 'benchlm'), null)
  assert.equal(getBenchmarkScore(candidate, 'benchlm', true), 82.1)
  assert.equal(getBenchmarkRankingMetric(candidate, 'benchlm', true)?.kind, 'score-only')
})

test('the estimated view combines an estimate with the intelligence index', () => {
  const candidate = model({
    intelligenceIndex: 60,
    estimatedCostPerTask: 0.5
  })

  assert.deepEqual(getBenchmarkRankingMetric(candidate, 'estimated'), {
    value: 120,
    direction: 'desc',
    kind: 'estimated-score-per-dollar',
    label: 'Intelligence points per estimated dollar'
  })
  assert.equal(getBenchmarkCostPerAttempt(candidate, 'estimated'), 0.5)
  assert.equal(getBenchmarkCostPerSuccessfulTask(candidate, 'estimated'), null)
})

test('every benchmark declares its own direction and metric kind', () => {
  for (const option of RANKING_BENCHMARKS) {
    assert.ok(['asc', 'desc'].includes(option.direction), option.value)
    assert.ok(option.metricKind.length > 0, option.value)
    assert.equal(getBenchmarkOption(option.value).value, option.value)
  }
})

test('estimated cost uses the token profile and the model prices', () => {
  const profile = {
    inputTokens: 1000,
    answerTokens: 100,
    reasoningTokens: 400,
    cacheableInputTokens: 800,
    cacheHitRate: 0.5
  }

  const cost = estimateCostPerTask(profile, {
    inputPricePerMillion: 2,
    outputPricePerMillion: 10,
    cacheHitPricePerMillion: 0.2,
    cacheWritePricePerMillion: 2
  })

  assert.ok(cost !== null)
  // 400 cache reads at 0.2, 600 cache writes at 2 and 500 output tokens at 10.
  assert.equal(Math.round(cost! * 1e6) / 1e6, 0.00628)
})

test('free models estimate to zero cost, not null', () => {
  const profile = {
    inputTokens: 1000,
    answerTokens: 100,
    reasoningTokens: 400,
    cacheableInputTokens: 0,
    cacheHitRate: 0
  }

  assert.equal(
    estimateCostPerTask(profile, { inputPricePerMillion: 0, outputPricePerMillion: 0 }),
    0
  )

  const row = rowToObject(
    buildModelRow(
      normalizeAAModel(rawModel({
        evaluations: { artificial_analysis_intelligence_index: 4 },
        pricing: {
          price_1m_blended_3_to_1: 0,
          price_1m_input_tokens: 0,
          price_1m_output_tokens: 0,
          price_1m_cache_hit_tokens: null,
          price_1m_cache_write_tokens: null
        }
      })),
      undefined,
      emptyRowInputs([['max', MAX_PROFILE]])
    )
  )
  assert.equal(row.estimated_cost_per_task, 0)
  assert.equal(row.category, 'budget')
})

test('estimated cost falls back to the input price when cache prices are missing', () => {
  const profile = {
    inputTokens: 1000,
    answerTokens: 0,
    reasoningTokens: 0,
    cacheableInputTokens: 0,
    cacheHitRate: 0
  }

  const cost = estimateCostPerTask(profile, {
    inputPricePerMillion: 2,
    outputPricePerMillion: 10
  })

  assert.equal(cost, 0.002)
})

test('coding agent rows are parsed from the embedded leaderboard payload', () => {
  const html = '\\"rows\\":[{\\"id\\":\\"1\\",\\"isDefault\\":true,\\"agentName\\":\\"Codex\\",\\"provider\\":\\"openai\\",\\"display\\":{\\"agent\\":\\"Codex\\",\\"model\\":\\"GPT-6.2 Astra (Max)\\"},\\"model\\":{\\"name\\":\\"GPT-6.2 Astra (Max)\\",\\"effort\\":{\\"slug\\":\\"max\\"}},\\"indexScore\\":0.534702278157923,\\"mean\\":{\\"costUsd\\":5.116919949371592}}]'

  const agents = parseCodingAgentRows(html)

  assert.equal(agents.length, 1)
  assert.equal(agents[0]?.agentName, 'Codex')
  assert.equal(agents[0]?.modelName, 'GPT-6.2 Astra (Max)')
  assert.equal(agents[0]?.effort, 'max')
  assert.equal(agents[0]?.indexScore, 53.470227815792306)
  assert.equal(agents[0]?.costPerTask, 5.116919949371592)
})

test('the best agent for a model is the highest score, cheapest on a tie', () => {
  const agents = parseCodingAgentRows(
    '\\"rows\\":[{\\"agentName\\":\\"A\\",\\"provider\\":\\"p\\",\\"display\\":{\\"agent\\":\\"A\\",\\"model\\":\\"M (Max)\\"},\\"indexScore\\":0.5,\\"mean\\":{\\"costUsd\\":2}},{\\"agentName\\":\\"B\\",\\"provider\\":\\"p\\",\\"display\\":{\\"agent\\":\\"B\\",\\"model\\":\\"M (Max)\\"},\\"indexScore\\":0.5,\\"mean\\":{\\"costUsd\\":1}}]'
  )

  const selection = selectBestAgentForModel(agents, 'M (Max)')

  assert.equal(selection?.benchmark.agentName, 'B')
  assert.equal(selection?.benchmark.costPerTask, 1)
})

function rawModel(overrides: Partial<AARawModel> = {}): AARawModel {
  return {
    id: 'raw-1',
    name: 'Catalog Model (Max)',
    slug: 'catalog-model',
    model_creator: { id: 'c1', name: 'Test Creator', slug: 'test-creator' },
    evaluations: { artificial_analysis_intelligence_index: 42 },
    pricing: {
      price_1m_blended_3_to_1: null,
      price_1m_input_tokens: 2,
      price_1m_output_tokens: 10,
      price_1m_cache_hit_tokens: null,
      price_1m_cache_write_tokens: null
    },
    ...overrides
  }
}

function emptyBenchmarkCosts(profiles: Array<[string, TokenProfile]> = []): CodingBenchmarkCosts {
  return {
    terminalBench: new Map(),
    deepSwe: new Map(),
    referenceProfiles: new Map(profiles as Array<[Parameters<Map<string, TokenProfile>['set']>[0], TokenProfile]>)
  }
}

function emptyRowInputs(profiles: Array<[string, TokenProfile]> = []): ModelRowInputs {
  return {
    benchmarkCosts: emptyBenchmarkCosts(profiles),
    codingAgents: []
  }
}

const MAX_PROFILE: TokenProfile = {
  inputTokens: 1_000_000,
  answerTokens: 8_000,
  reasoningTokens: 60_000,
  cacheableInputTokens: 900_000,
  cacheHitRate: 0.9
}

const EMPTY_COLUMNS = new Set([
  'terminal_bench_score',
  'terminal_bench_cost_per_task',
  'terminal_bench_cost_per_successful_task',
  'terminal_bench_41_score',
  'terminal_bench_41_cost_per_task',
  'terminal_bench_41_cost_per_successful_task',
  'deep_swe_score',
  'deep_swe_cost_per_task',
  'deep_swe_cost_per_successful_task',
  'benchlm_coding_score',
  'aa_intelligence_cost_per_task',
  'aa_coding_agent_index',
  'aa_coding_agent_cost_per_task'
])

// Column order of the row returned by buildModelRow, aligned with UPSERT_MODELS.
const ROW_COLUMNS = [
  'id', 'name', 'slug', 'provider', 'provider_logo',
  'intelligence_index', 'coding_index',
  'terminal_bench_score', 'terminal_bench_cost_per_task', 'terminal_bench_cost_per_successful_task',
  'terminal_bench_41_score', 'terminal_bench_41_cost_per_task', 'terminal_bench_41_cost_per_successful_task',
  'deep_swe_score', 'deep_swe_cost_per_task', 'deep_swe_cost_per_successful_task',
  'benchlm_coding_score', 'benchlm_evidence_status', 'benchlm_model_name', 'benchlm_match_type',
  'aa_coding_agent_index', 'aa_coding_agent_cost_per_task', 'aa_coding_agent_name',
  'aa_intelligence_cost_per_task', 'estimated_cost_per_task', 'cost_per_task',
  'input_price_per_m', 'output_price_per_m', 'category',
  'strengths', 'context_window', 'open_weights', 'speed', 'latency'
]

function rowToObject(row: unknown[]): Record<string, unknown> {
  return Object.fromEntries(ROW_COLUMNS.map((column, index) => [column, row[index]]))
}

test('the catalog imports models without an intelligence index as null, not zero', () => {
  const raw = rawModel({ evaluations: {} })
  const normalized = normalizeAAModel(raw)

  assert.equal(normalized.evaluations.artificial_analysis_intelligence_index, null)

  const row = rowToObject(buildModelRow(normalized, undefined, emptyRowInputs()))
  assert.equal(row.intelligence_index, null)
})

test('the catalog imports models without prices with null prices and no category', () => {
  const raw = rawModel({ pricing: null })
  const normalized = normalizeAAModel(raw)

  assert.equal(normalized.pricing.price_1m_input_tokens, null)
  assert.equal(normalized.pricing.price_1m_output_tokens, null)
  assert.equal(normalized.pricing.price_1m_blended_3_to_1, null)

  const row = rowToObject(buildModelRow(normalized, undefined, emptyRowInputs()))
  assert.equal(row.input_price_per_m, null)
  assert.equal(row.output_price_per_m, null)
  assert.equal(row.category, null)
  assert.equal(row.estimated_cost_per_task, null)
})

test('models with prices but no intelligence index still get an estimated cost', () => {
  const raw = rawModel({ evaluations: {} })
  const normalized = normalizeAAModel(raw)

  const row = rowToObject(
    buildModelRow(normalized, undefined, emptyRowInputs([['max', MAX_PROFILE]]))
  )
  assert.equal(row.intelligence_index, null)
  // The 'max' fallback profile still prices the tokens.
  assert.notEqual(row.estimated_cost_per_task, null)
  assert.equal(row.category, 'mid')
})

test('measured columns stay null for models outside the benchmarks', () => {
  const row = rowToObject(
    buildModelRow(normalizeAAModel(rawModel()), undefined, emptyRowInputs([['max', MAX_PROFILE]]))
  )
  for (const column of EMPTY_COLUMNS) {
    assert.equal(row[column], null, `${column} should be null without benchmark data`)
  }
})

test('model measurement keys use the release slug and the effort', () => {
  assert.equal(modelMeasurementKey('gpt-6-astra-low', 'GPT-6 Astra (Low)'), 'gpt-6-astra|low')
  assert.equal(modelMeasurementKey('kimi-k3-1-pro', 'Kimi K3.1 Pro'), 'kimi-k3-1-pro|max')
})
