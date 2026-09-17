import { query } from '../../utils/db'

interface AAModel {
  id: string
  name: string
  slug: string
  model_creator: {
    id: string
    name: string
    slug: string
  }
  evaluations: {
    artificial_analysis_intelligence_index: number
    [key: string]: number | null | undefined
  }
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

function determineCategoryFromPrice(pricePerMillion: number): string {
  if (pricePerMillion === 0) return 'budget'
  if (pricePerMillion > 50) return 'frontier'
  if (pricePerMillion > 10) return 'high'
  if (pricePerMillion > 1) return 'mid'
  return 'budget'
}

function isOpenWeights(name: string): boolean {
  const openWeightPatterns = [
    'llama', 'gemma', 'mistral', 'qwen', 'deepseek-r1', 'deepseek-v3',
    'phi', 'granite', 'devstral', 'codestral', 'WizardCoder', 'CodeLlama'
  ]
  const lowerName = name.toLowerCase()
  return openWeightPatterns.some(pattern => lowerName.includes(pattern.toLowerCase()))
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY || config.artificialAnalysisApiKey
  
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Artificial Analysis API key not configured.'
    })
  }

  try {
    // Fetch all models from AA API
    console.log('Fetching models from Artificial Analysis API...')
    const response = await $fetch<AAAPIResponse>('https://artificialanalysis.ai/api/v2/data/llms/models', {
      headers: { 'x-api-key': apiKey }
    })

    if (response.status !== 200) {
      throw createError({
        statusCode: response.status,
        message: 'Failed to fetch from Artificial Analysis API'
      })
    }

    // Filter to models with intelligence index
    const allModels = response.data.filter(
      m => m.evaluations?.artificial_analysis_intelligence_index && 
           m.pricing?.price_1m_blended_3_to_1 !== undefined
    )

    console.log(`Found ${allModels.length} models in AA API`)

    // Insert/update all models
    let imported = 0
    for (const model of allModels) {
      const intelligenceIndex = Math.round(model.evaluations.artificial_analysis_intelligence_index)
      const pricePerMillion = model.pricing.price_1m_blended_3_to_1
      const openWeights = isOpenWeights(model.name)
      
      // Try to insert, or update if exists
      await query(`
        INSERT INTO models (
          id, name, slug, provider, provider_logo, intelligence_index,
          cost_per_task, input_price_per_m, output_price_per_m, category,
          strengths, context_window, open_weights, speed, latency
        ) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          provider = EXCLUDED.provider,
          provider_logo = EXCLUDED.provider_logo,
          intelligence_index = EXCLUDED.intelligence_index,
          input_price_per_m = EXCLUDED.input_price_per_m,
          output_price_per_m = EXCLUDED.output_price_per_m,
          category = EXCLUDED.category,
          open_weights = EXCLUDED.open_weights,
          speed = EXCLUDED.speed,
          latency = EXCLUDED.latency,
          updated_at = CURRENT_TIMESTAMP
      `, [
        model.id,
        model.name,
        model.slug,
        model.model_creator.name,
        model.model_creator.slug,
        intelligenceIndex,
        model.pricing.price_1m_input_tokens,
        model.pricing.price_1m_output_tokens,
        determineCategoryFromPrice(pricePerMillion),
        [],
        'N/A',
        openWeights,
        Math.round(model.median_output_tokens_per_second),
        Math.round(model.median_time_to_first_token_seconds * 100) / 100
      ])
      
      imported++
      
      if (imported % 50 === 0) {
        console.log(`Imported ${imported}/${allModels.length} models...`)
      }
    }

    // Get final count
    const countResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM models')
    const total = parseInt(countResult[0]?.count || '0')

    console.log(`Import complete! ${imported} models processed, ${total} total in database.`)

    return {
      success: true,
      imported,
      total,
      updatedAt: new Date().toISOString()
    }

  } catch (error: any) {
    console.error('Failed to import models:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to import models'
    })
  }
})
