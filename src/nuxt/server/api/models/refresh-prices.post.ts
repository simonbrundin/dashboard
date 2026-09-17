import { query } from '../../utils/db'
import { scrapeModelCostPerTask } from '../../utils/scraper'

export default defineEventHandler(async () => {
  try {
    const models = await query<{ slug: string; name: string }>(
      "SELECT slug, name FROM models WHERE cost_per_task > 0"
    )

    console.log(`Refreshing prices for ${models.length} models...`)

    let updated = 0

    for (const model of models) {
      const costPerTask = await scrapeModelCostPerTask(model.slug)

      if (costPerTask !== null && costPerTask > 0) {
        await query(
          'UPDATE models SET cost_per_task = $1, updated_at = CURRENT_TIMESTAMP WHERE slug = $2',
          [costPerTask, model.slug]
        )
        updated++
        console.log(`[${updated}/${models.length}] ${model.slug}: $${costPerTask}/task`)
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1200))
    }

    return {
      success: true,
      updated,
      updatedAt: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('Failed to refresh prices:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to refresh prices'
    })
  }
})
