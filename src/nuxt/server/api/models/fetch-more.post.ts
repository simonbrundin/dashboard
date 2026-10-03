import type { H3Event } from 'h3'
import { query } from '../../utils/db'
import { scrapeModelCostPerTask } from '../../utils/scraper'
import { pauseForRateLimit } from '../../utils/rateLimit'
import {
  UPSERT_MODELS,
  ensureModelsSchema,
  requireApiKey,
  fetchModelsFromAA,
  fetchBenchLMModels,
  findBenchLMMatch,
  toModelRow
} from '../../utils/artificialAnalysis'
import type { AAModel } from '../../utils/artificialAnalysis'
import {
  fetchCodingBenchmarkCosts,
  type CodingBenchmarkCosts
} from '../../utils/benchmarkCosts'

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

async function syncModels(
  models: AAModel[],
  benchModels: Awaited<ReturnType<typeof fetchBenchLMModels>>,
  benchmarkCosts: CodingBenchmarkCosts,
  stream: ProgressStream
): Promise<number> {
  sendProgress(stream, {
    phase: 'adding_models',
    message: 'Lägger till och uppdaterar modeller...',
    progress: 0,
    total: models.length
  })

  let added = 0
  for (const [index, model] of models.entries()) {
    const exists = await query<{ slug: string }>('SELECT slug FROM models WHERE slug = $1', [model.slug])
    await query(
      UPSERT_MODELS,
      toModelRow(model, findBenchLMMatch(model, benchModels), benchmarkCosts)
    )
    if (exists.length === 0) added++

    sendProgress(stream, {
      phase: 'adding_models',
      message: `Synkar: ${model.name.substring(0, 30)}...`,
      progress: index + 1,
      total: models.length,
      modelsAdded: added
    })
  }
  return added
}

async function scrapeMissingPrices(stream: ProgressStream): Promise<{ pricesAdded: number; total: number }> {
  const modelsWithoutCost = await query<{ slug: string }>(
    'SELECT slug FROM models WHERE COALESCE(coding_agent_cost_per_task, aa_intelligence_cost_per_task, cost_per_task) IS NULL'
  )
  const total = modelsWithoutCost.length

  sendProgress(stream, {
    phase: 'scraping_prices',
    message: `Hämtar priser för ${total} modeller...`,
    progress: 0,
    total
  })

  let pricesAdded = 0
  for (const [index, model] of modelsWithoutCost.entries()) {
    const cost = await scrapeModelCostPerTask(model.slug)
    if (cost !== null && cost > 0) {
      await query(
        'UPDATE models SET aa_intelligence_cost_per_task = $1, cost_per_task = $1 WHERE slug = $2',
        [cost, model.slug]
      )
      pricesAdded++
      console.log(`[${index + 1}/${total}] ${model.slug}: $${cost}/task ✓`)
    }

    const costMessage = cost === null ? 'ingen träff' : `$${cost.toFixed(2)}/task`
    sendProgress(stream, {
      phase: 'scraping_prices',
      message: `Pris för ${model.slug}: ${costMessage}`,
      progress: index + 1,
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
    await ensureModelsSchema()

    sendProgress(stream, { phase: 'fetching', message: 'Hämtar modeller från Artificial Analysis...', progress: 0, total: 0 })
    const models = await fetchModelsFromAA(apiKey)
    const [benchModels, benchmarkCosts] = await Promise.all([
      fetchBenchLMModels(),
      fetchCodingBenchmarkCosts()
    ])

    const newModelsAdded = await syncModels(models, benchModels, benchmarkCosts, stream)
    const { pricesAdded, total } = await scrapeMissingPrices(stream)

    sendProgress(stream, {
      phase: 'done',
      message: 'Klart!',
      progress: total,
      total,
      success: true,
      modelsAdded: newModelsAdded,
      pricesAdded
    })
  } catch (error: unknown) {
    console.error('Failed to fetch more:', error)
    const errorMessage = error instanceof Error ? error.message : 'Misslyckades'
    sendProgress(stream, {
      phase: 'error',
      message: errorMessage,
      progress: 0,
      total: 0,
      success: false,
      error: errorMessage
    })
  } finally {
    event.node.res.end()
  }
})
