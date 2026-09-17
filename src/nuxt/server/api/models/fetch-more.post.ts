import type { H3Event } from 'h3'
import { query } from '../../utils/db'
import { scrapeModelCostPerTask } from '../../utils/scraper'

interface AAModel {
  id: string
  name: string
  slug: string
  model_creator: { id: string; name: string; slug: string }
  evaluations: { artificial_analysis_intelligence_index: number; [key: string]: number | null | undefined }
  pricing: {
    price_1m_blended_3_to_1: number
    price_1m_input_tokens: number
    price_1m_output_tokens: number
  }
  median_output_tokens_per_second: number
  median_time_to_first_token_seconds: number
}

interface AAAPIResponse {
  status: number
  data: AAModel[]
}

interface ProgressPayload {
  phase: 'fetching' | 'adding_models' | 'scraping_prices' | 'done' | 'error'
  message: string
  progress: number
  total: number
  success?: boolean
  error?: string
  modelsAdded?: number
  pricesAdded?: number
}

interface ProgressStream {
  send: (payload: string) => void
}

function determineCategory(pricePerMillion: number): string {
  if (pricePerMillion === 0) return 'budget'
  if (pricePerMillion > 50) return 'frontier'
  if (pricePerMillion > 10) return 'high'
  if (pricePerMillion > 1) return 'mid'
  return 'budget'
}

function isOpenWeights(name: string): boolean {
  const patterns = ['llama', 'gemma', 'mistral', 'qwen', 'deepseek-r1', 'deepseek-v3', 'phi', 'granite', 'devstral', 'codestral']
  const lower = name.toLowerCase()
  return patterns.some(p => lower.includes(p.toLowerCase()))
}

function createProgressStream(event: H3Event): ProgressStream {
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  return {
    send: (payload: string) => event.node.res.write(payload)
  }
}

function sendProgress(stream: ProgressStream, payload: ProgressPayload) {
  stream.send(`data: ${JSON.stringify(payload)}\n\n`)
}

function requireApiKey(): string {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'API key not configured.' })
  }
  return apiKey
}

async function fetchModelsFromAA(apiKey: string): Promise<AAModel[]> {
  const response = await $fetch<AAAPIResponse>('https://artificialanalysis.ai/api/v2/data/llms/models', {
    headers: { 'x-api-key': apiKey }
  })

  if (response.status !== 200) {
    throw createError({ statusCode: response.status, message: 'Failed to fetch from AA API' })
  }

  return response.data.filter(
    m => m.evaluations?.artificial_analysis_intelligence_index && m.pricing?.price_1m_blended_3_to_1 !== undefined
  )
}

function toModelRow(model: AAModel): unknown[] {
  return [
    model.id, model.name, model.slug, model.model_creator.name, model.model_creator.slug,
    Math.round(model.evaluations.artificial_analysis_intelligence_index),
    model.pricing.price_1m_input_tokens, model.pricing.price_1m_output_tokens,
    determineCategory(model.pricing.price_1m_blended_3_to_1), [], 'N/A',
    isOpenWeights(model.name),
    Math.round(model.median_output_tokens_per_second),
    Math.round(model.median_time_to_first_token_seconds * 100) / 100
  ]
}

async function insertMissingModels(models: AAModel[], stream: ProgressStream): Promise<number> {
  sendProgress(stream, {
    phase: 'adding_models',
    message: 'Lägger till nya modeller...',
    progress: 0,
    total: models.length
  })

  let added = 0
  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    const exists = await query<{ slug: string }>('SELECT slug FROM models WHERE slug = $1', [model.slug])
    if (exists.length === 0) {
      await query(`
        INSERT INTO models (id, name, slug, provider, provider_logo, intelligence_index,
          cost_per_task, input_price_per_m, output_price_per_m, category,
          strengths, context_window, open_weights, speed, latency)
        VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, $11, $12, $13, $14)
      `, toModelRow(model))
      added++
    }
    sendProgress(stream, {
      phase: 'adding_models',
      message: `Lägger till: ${model.name.substring(0, 30)}...`,
      progress: i + 1,
      total: models.length,
      modelsAdded: added
    })
  }
  return added
}

async function scrapeMissingPrices(stream: ProgressStream): Promise<{ pricesAdded: number; total: number }> {
  const modelsWithoutCost = await query<{ slug: string }>('SELECT slug FROM models WHERE cost_per_task IS NULL')
  const total = modelsWithoutCost.length

  sendProgress(stream, {
    phase: 'scraping_prices',
    message: `Hämtar priser för ${total} modeller...`,
    progress: 0,
    total
  })

  let pricesAdded = 0
  for (let i = 0; i < total; i++) {
    const { slug } = modelsWithoutCost[i]
    const cost = await scrapeModelCostPerTask(slug)
    if (cost !== null && cost > 0) {
      await query('UPDATE models SET cost_per_task = $1 WHERE slug = $2', [cost, slug])
      pricesAdded++
      console.log(`[${i + 1}/${total}] ${slug}: $${cost}/task ✓`)
    }

    const costMessage = cost === null ? 'ingen träff' : `$${cost.toFixed(2)}/task`
    sendProgress(stream, {
      phase: 'scraping_prices',
      message: `Pris för ${slug}: ${costMessage}`,
      progress: i + 1,
      total,
      pricesAdded
    })
    await pauseForRateLimit()
  }
  return { pricesAdded, total }
}

function pauseForRateLimit(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 1200))
}

export default defineEventHandler(async (event) => {
  const stream = createProgressStream(event)

  try {
    const apiKey = requireApiKey()

    sendProgress(stream, { phase: 'fetching', message: 'Hämtar modeller från Artificial Analysis...', progress: 0, total: 0 })
    const models = await fetchModelsFromAA(apiKey)

    const newModelsAdded = await insertMissingModels(models, stream)
    const { pricesAdded, total } = await scrapeMissingPrices(stream)

    sendProgress(stream, {
      phase: 'done',
      message: 'Klart!',
      progress: total,
      total,
      success: true,
      newModelsAdded,
      pricesAdded
    })
  } catch (error: any) {
    console.error('Failed to fetch more:', error)
    sendProgress(stream, {
      phase: 'error',
      message: error.message || 'Misslyckades',
      progress: 0,
      total: 0,
      success: false,
      error: error.message
    })
  } finally {
    event.node.res.end()
  }
})
