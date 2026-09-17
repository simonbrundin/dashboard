import { query } from '../../utils/db'

interface ModelRow {
  id: string
  name: string
  slug: string
  provider: string
  provider_logo: string
  intelligence_index: number
  cost_per_task: number
  input_price_per_m: number | null
  output_price_per_m: number | null
  category: string
  strengths: string[]
  context_window: string
  open_weights: boolean
  speed: number
  latency: number
}

interface ApiModel {
  id: string
  name: string
  slug: string
  provider: string
  providerLogo: string
  intelligenceIndex: number
  costPerTask: number
  inputPricePerM: number | null
  outputPricePerM: number | null
  category: string
  strengths: string[]
  contextWindow: string
  openWeights: boolean
  speed: number
  latency: number
}

export default defineEventHandler(async () => {
  try {
    const rows = await query<ModelRow>(
      'SELECT * FROM models ORDER BY intelligence_index DESC'
    )

    const models: ApiModel[] = rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      provider: row.provider,
      providerLogo: row.provider_logo,
      intelligenceIndex: row.intelligence_index,
      costPerTask: parseFloat(String(row.cost_per_task)) || 0,
      inputPricePerM: parseFloat(String(row.input_price_per_m)) || null,
      outputPricePerM: parseFloat(String(row.output_price_per_m)) || null,
      category: row.category,
      strengths: row.strengths || [],
      contextWindow: row.context_window,
      openWeights: row.open_weights,
      speed: row.speed,
      latency: row.latency
    }))

    const latestUpdate = await query<{ updated_at: string }>(
      'SELECT updated_at FROM models ORDER BY updated_at DESC LIMIT 1'
    )

    return {
      source: 'artificialanalysis.ai',
      updatedAt: latestUpdate[0]?.updated_at || new Date().toISOString(),
      totalModels: models.length,
      models
    }
  } catch (error: any) {
    console.error('Failed to fetch models from database:', error)
    
    // Fallback to JSON file if database is not available
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
