import { query } from '../../utils/db'

interface AAModel {
  id: string
  name: string
  slug: string
  model_creator: { id: string; name: string; slug: string }
  evaluations: { artificial_analysis_intelligence_index: number }
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

function determineCategory(pricePerMillion: number): string {
  if (pricePerMillion === 0) return 'budget'
  if (pricePerMillion > 50) return 'frontier'
  if (pricePerMillion > 10) return 'high'
  if (pricePerMillion > 1) return 'mid'
  return 'budget'
}

function isOpenWeights(name: string): boolean {
  const patterns = ['llama', 'gemma', 'mistral', 'qwen', 'deepseek-r1', 'deepseek-v3', 'phi', 'granite', 'devstral', 'codestral']
  return patterns.some(p => name.toLowerCase().includes(p.toLowerCase()))
}

export default defineEventHandler(async () => {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY

  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'API key not configured.' })
  }

  try {
    // 1. Fetch from AA API
    const response = await $fetch<AAAPIResponse>('https://artificialanalysis.ai/api/v2/data/llms/models', {
      headers: { 'x-api-key': apiKey }
    })

    if (response.status !== 200) {
      throw createError({ statusCode: response.status, message: 'Failed to fetch from AA API' })
    }

    const allModels = response.data.filter(
      m => m.evaluations?.artificial_analysis_intelligence_index && m.pricing?.price_1m_blended_3_to_1 !== undefined
    )

    // 2. Upsert all models
    let imported = 0
    for (const model of allModels) {
      await query(`
        INSERT INTO models (id, name, slug, provider, provider_logo, intelligence_index,
          cost_per_task, input_price_per_m, output_price_per_m, category,
          strengths, context_window, open_weights, speed, latency)
        VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name, provider = EXCLUDED.provider,
          intelligence_index = EXCLUDED.intelligence_index,
          input_price_per_m = EXCLUDED.input_price_per_m,
          output_price_per_m = EXCLUDED.output_price_per_m,
          category = EXCLUDED.category,
          open_weights = EXCLUDED.open_weights,
          speed = EXCLUDED.speed, latency = EXCLUDED.latency,
          updated_at = CURRENT_TIMESTAMP
      `, [
        model.id, model.name, model.slug, model.model_creator.name, model.model_creator.slug,
        Math.round(model.evaluations.artificial_analysis_intelligence_index),
        model.pricing.price_1m_input_tokens, model.pricing.price_1m_output_tokens,
        determineCategory(model.pricing.price_1m_blended_3_to_1), [], 'N/A',
        isOpenWeights(model.name),
        Math.round(model.median_output_tokens_per_second),
        Math.round(model.median_time_to_first_token_seconds * 100) / 100
      ])
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
