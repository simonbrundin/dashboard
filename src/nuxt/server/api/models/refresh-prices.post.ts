import { query } from '../../utils/db'
import { scrapeModelCostPerTask } from '../../utils/scraper'
import { pauseForRateLimit } from '../../utils/rateLimit'
import { ensureModelsSchema } from '../../utils/artificialAnalysis'

export default defineEventHandler(async () => {
  try {
    await ensureModelsSchema()
    const models = await query<{ slug: string; name: string }>(
      "SELECT slug, name FROM models WHERE COALESCE(coding_agent_cost_per_task, aa_intelligence_cost_per_task, cost_per_task) > 0"
    )

    console.log(`Refreshing prices for ${models.length} models...`)

    let updated = 0

    for (const model of models) {
      const costPerTask = await scrapeModelCostPerTask(model.slug)

      if (costPerTask !== null && costPerTask > 0) {
        await query(
          'UPDATE models SET aa_intelligence_cost_per_task = $1, cost_per_task = $1, updated_at = CURRENT_TIMESTAMP WHERE slug = $2',
          [costPerTask, model.slug]
        )
        updated++
        console.log(`[${updated}/${models.length}] ${model.slug}: $${costPerTask}/task`)
      }

      await pauseForRateLimit()
    }

    return {
      success: true,
      updated,
      updatedAt: new Date().toISOString()
    }
  } catch (error: unknown) {
    console.error('Failed to refresh prices:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to refresh prices'
    })
  }
})
