import { query } from '../../utils/db'
import {
  UPSERT_MODELS,
  ensureModelsSchema,
  requireApiKey,
  fetchModelsFromAA,
  fetchBenchLMModels,
  findBenchLMMatch,
  toModelRow
} from '../../utils/artificialAnalysis'
import { fetchCodingBenchmarkCosts } from '../../utils/benchmarkCosts'
import { fetchCodingAgentBenchmarks } from '../../utils/fetchCodingAgents'

export default defineEventHandler(async () => {
  const apiKey = requireApiKey()

  try {
    await ensureModelsSchema()

    // Fetch all data sources in parallel
    const [allModels, benchModels, benchmarkCosts, codingAgentBenchmarks] = await Promise.all([
      fetchModelsFromAA(apiKey),
      fetchBenchLMModels(),
      fetchCodingBenchmarkCosts(),
      fetchCodingAgentBenchmarks()
    ])

    let imported = 0
    const batchSize = 100

    for (let i = 0; i < allModels.length; i += batchSize) {
      const batch = allModels.slice(i, i + batchSize)

      for (const model of batch) {
        const row = toModelRow(
          model,
          findBenchLMMatch(model, benchModels),
          benchmarkCosts,
          codingAgentBenchmarks
        )

        await query(UPSERT_MODELS, row)
        imported++
      }

      console.log(`Imported ${imported}/${allModels.length}...`)
    }

    // A full sync should not leave removed or renamed AA models in the local
    // ranking. Incremental fetch-more intentionally does not run this cleanup.
    const importedSlugs = allModels.map(model => model.slug)
    const removedRows = await query<{ slug: string }>(
      'DELETE FROM models WHERE NOT (slug = ANY($1::text[])) RETURNING slug',
      [importedSlugs]
    )

    const totalRows = await query<{ count: string }>('SELECT COUNT(*) FROM models')
    const total = parseInt(totalRows[0]?.count ?? '0')

    return {
      success: true,
      imported,
      removed: removedRows.length,
      total,
      updatedAt: new Date().toISOString()
    }
  } catch (error: unknown) {
    console.error('Failed to import:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to import'
    })
  }
})
