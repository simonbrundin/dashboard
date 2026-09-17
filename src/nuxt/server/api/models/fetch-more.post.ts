import type { H3Event } from 'h3'
import { query } from '../../utils/db'
import { scrapeModelCostPerTask } from '../../utils/scraper'
import { pauseForRateLimit } from '../../utils/rateLimit'
import {
  INSERT_MODELS_COLUMNS,
  requireApiKey,
  fetchModelsFromAA,
  toModelRow
} from '../../utils/artificialAnalysis'
import type { AAModel } from '../../utils/artificialAnalysis'

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
      await query(INSERT_MODELS_COLUMNS, toModelRow(model))
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
