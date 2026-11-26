import type { H3Event } from 'h3'
import { query } from '../../utils/db'
import { scrapeModelCostPerTask } from '../../utils/scraper'
import { pauseForRateLimit } from '../../utils/rateLimit'
import {
  requireApiKey,
  fetchModelsFromAA,
  fetchBenchLMModels,
  findBenchLMMatch
} from '../../utils/artificialAnalysis'
import type { AAModel } from '../../utils/artificialAnalysis'
import {
  buildModelRow,
  ensureModelsSchema,
  UPSERT_MODELS
} from '../../utils/modelRows'
import {
  fetchCodingBenchmarkCosts,
  type CodingBenchmarkCosts
} from '../../utils/benchmarkCosts'
import { fetchCodingAgentBenchmarks, type CodingAgentBenchmark } from '../../utils/fetchCodingAgents'

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
  codingAgents: CodingAgentBenchmark[],
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
      buildModelRow(model, findBenchLMMatch(model, benchModels), { benchmarkCosts, codingAgents })
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
  // The scraped proxy price is an Intelligence Index task cost, so it can
  // only be used by models that have an index. Catalog models without a
  // score would be scraped in vain.
  const modelsWithoutCost = await query<{ slug: string }>(
    'SELECT slug FROM models WHERE intelligence_index IS NOT NULL AND COALESCE(coding_agent_cost_per_task, aa_intelligence_cost_per_task, cost_per_task) IS NULL'
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
    // A user-triggered sync always bypasses the AA cache: the catalog changes
    // upstream and a cached list would leave removed or renamed models behind.
    const models = await fetchModelsFromAA(apiKey, { forceRefresh: true })
    const [benchModels, benchmarkCosts, codingAgents] = await Promise.all([
      fetchBenchLMModels(),
      fetchCodingBenchmarkCosts(),
      fetchCodingAgentBenchmarks()
    ])

    const newModelsAdded = await syncModels(models, benchModels, benchmarkCosts, codingAgents, stream)

    // A full sync should not leave removed or renamed AA models in the local
    // ranking.
    const importedSlugs = models.map(model => model.slug)
    const removedRows = await query<{ slug: string }>(
      'DELETE FROM models WHERE NOT (slug = ANY($1::text[])) RETURNING slug',
      [importedSlugs]
    )

    const { pricesAdded, total } = await scrapeMissingPrices(stream)

    const removedCount = removedRows.length
    const summary = `Synkat klart: ${models.length} modeller, ${newModelsAdded} nya, ${removedCount} borttagna, ${pricesAdded} priser hämtade`

    sendProgress(stream, {
      phase: 'done',
      message: summary,
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
