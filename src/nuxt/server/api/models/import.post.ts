import { query } from '../../utils/db'
import {
  INSERT_MODELS_COLUMNS,
  requireApiKey,
  fetchModelsFromAA,
  toModelRow
} from '../../utils/artificialAnalysis'

const INSERT_MODELS_UPSERT = `${INSERT_MODELS_COLUMNS}
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, provider = EXCLUDED.provider,
    intelligence_index = EXCLUDED.intelligence_index,
    input_price_per_m = EXCLUDED.input_price_per_m,
    output_price_per_m = EXCLUDED.output_price_per_m,
    category = EXCLUDED.category,
    open_weights = EXCLUDED.open_weights,
    speed = EXCLUDED.speed, latency = EXCLUDED.latency,
    updated_at = CURRENT_TIMESTAMP
`

export default defineEventHandler(async () => {
  const apiKey = requireApiKey()

  try {
    const allModels = await fetchModelsFromAA(apiKey)

    let imported = 0
    for (const model of allModels) {
      await query(INSERT_MODELS_UPSERT, toModelRow(model))
      imported++
      if (imported % 50 === 0) console.log(`Imported ${imported}/${allModels.length}...`)
    }

    const [{ count: total }] = await query<{ count: string }>('SELECT COUNT(*) FROM models')

    return {
      success: true,
      imported,
      total: parseInt(total),
      updatedAt: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('Failed to import:', error)
    throw createError({ statusCode: 500, message: error.message || 'Failed to import' })
  }
})
