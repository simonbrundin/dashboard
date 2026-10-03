import { query } from '../../utils/db'

interface ModelRow {
  id: string
  name: string
  slug: string
  provider: string
  provider_logo: string
  intelligence_index: number
  coding_index?: number | string | null
  terminal_bench_score?: number | string | null
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
  cost_per_task?: number | string | null
  input_price_per_m?: number | string | null
  output_price_per_m?: number | string | null
  category: string
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
  intelligenceIndex: number
  codingIndex: number | null
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
  costPerTask: number | null
  costSource: 'measured-coding' | 'proxy' | 'unknown'
  inputPricePerM: number | null
  outputPricePerM: number | null
  category: string
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
        benchLmCodingScore: parseNullableNumber(row.benchlm_coding_score),
        benchLmEvidenceStatus: row.benchlm_evidence_status ?? null,
        benchLmModelName: row.benchlm_model_name ?? null,
        benchLmMatchType: row.benchlm_match_type === 'exact' || row.benchlm_match_type === 'family'
          ? row.benchlm_match_type
          : null,
        aaIntelligenceCostPerTask: aaIntelligenceCost ?? legacyCost,
        terminalBenchCostPerTask: terminalBenchCost,
        deepSweCostPerTask: deepSweCost,
        codingAgentCostPerTask: codingAgentCost,
        terminalBenchCostPerSuccessfulTask: terminalBenchSuccessfulCost,
        deepSweCostPerSuccessfulTask: deepSweSuccessfulCost,
        codingAgentCostPerSuccessfulTask: codingAgentSuccessfulCost,
        aaCodingAgentIndex: parseNullableNumber(row.aa_coding_agent_index),
        aaCodingAgentCostPerTask: parseNullableNumber(row.aa_coding_agent_cost_per_task),
        costPerTask,
        costSource,
        inputPricePerM: parseNullableNumber(row.input_price_per_m),
        outputPricePerM: parseNullableNumber(row.output_price_per_m),
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
