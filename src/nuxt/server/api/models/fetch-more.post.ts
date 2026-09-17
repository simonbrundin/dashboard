import { query } from '../../utils/db'
import { chromium } from 'playwright'

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

async function scrapeModelCostPerTask(modelSlug: string): Promise<number | null> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  try {
    await page.goto(`https://artificialanalysis.ai/models/${modelSlug}`, {
      waitUntil: 'networkidle',
      timeout: 60000
    })
    
    await page.waitForTimeout(2000)
    const html = await page.content()
    
    const costMatch = html.match(/<span>\$([0-9.]+)<\/span>[\s\S]{0,500}?Cost per Intelligence Index task/i)
    
    if (costMatch && costMatch[1]) {
      return parseFloat(costMatch[1])
    }
    
    const taskIndex = html.indexOf('Cost per Intelligence Index task')
    if (taskIndex > -1) {
      const beforeText = html.substring(Math.max(0, taskIndex - 300), taskIndex)
      const dollarMatch = beforeText.match(/\$([0-9.]+)/)
      if (dollarMatch && dollarMatch[1]) {
        return parseFloat(dollarMatch[1])
      }
    }
    
    return null
    
  } catch (error) {
    console.error(`Error scraping ${modelSlug}:`, error)
    return null
  } finally {
    await browser.close()
  }
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
    // Step 1: Fetch all models from AA API
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

    // Step 2: Insert new models that don't exist in database
    let newModelsAdded = 0
    for (const model of allModels) {
      const existing = await query<{ slug: string }>(
        'SELECT slug FROM models WHERE slug = $1',
        [model.slug]
      )
      
      if (existing.length === 0) {
        const intelligenceIndex = Math.round(model.evaluations.artificial_analysis_intelligence_index)
        const pricePerMillion = model.pricing.price_1m_blended_3_to_1
        const openWeights = isOpenWeights(model.name)
        
        await query(`
          INSERT INTO models (
            id, name, slug, provider, provider_logo, intelligence_index,
            cost_per_task, input_price_per_m, output_price_per_m, category,
            strengths, context_window, open_weights, speed, latency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          model.id,
          model.name,
          model.slug,
          model.model_creator.name,
          model.model_creator.slug,
          intelligenceIndex,
          0, // cost_per_task - will be scraped
          model.pricing.price_1m_input_tokens,
          model.pricing.price_1m_output_tokens,
          determineCategoryFromPrice(pricePerMillion),
          [],
          'N/A',
          openWeights,
          Math.round(model.median_output_tokens_per_second),
          Math.round(model.median_time_to_first_token_seconds * 100) / 100
        ])
        
        newModelsAdded++
      }
    }

    console.log(`Added ${newModelsAdded} new models to database`)

        // Step 3: Get models that need price scraping (limit to 20 for faster initial import)
    const modelsWithoutCost = await query<{ slug: string; name: string }>(
      'SELECT slug, name FROM models WHERE cost_per_task = 0 LIMIT 20'
    )

    console.log(`Scraping prices for ${modelsWithoutCost.length} models...`)

    let pricesAdded = 0
    const total = modelsWithoutCost.length

    for (const model of modelsWithoutCost) {
      const costPerTask = await scrapeModelCostPerTask(model.slug)
      
      if (costPerTask !== null) {
        await query(
          'UPDATE models SET cost_per_task = $1, updated_at = CURRENT_TIMESTAMP WHERE slug = $2',
          [costPerTask, model.slug]
        )
        pricesAdded++
        console.log(`[${pricesAdded}/${total}] ${model.slug}: $${costPerTask}/task ✓`)
      } else {
        console.log(`[${pricesAdded}/${total}] ${model.slug}: FAILED`)
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1200))
    }

    // Get final counts
    const withCost = await query<{ count: string }>('SELECT COUNT(*) as count FROM models WHERE cost_per_task > 0')
    const totalModels = await query<{ count: string }>('SELECT COUNT(*) as count FROM models')
    const stillNeedPrices = await query<{ count: string }>('SELECT COUNT(*) as count FROM models WHERE cost_per_task = 0')

    console.log(`Complete! ${pricesAdded} new prices scraped.`)

    return {
      success: true,
      newModelsAdded,
      pricesAdded,
      totalModels: parseInt(totalModels[0]?.count || '0'),
      totalWithPrices: parseInt(withCost[0]?.count || '0'),
      stillNeedPrices: parseInt(stillNeedPrices[0]?.count || '0'),
      totalToScrape: parseInt(stillNeedPrices[0]?.count || '0') + pricesAdded,
      scraped: pricesAdded,
      updatedAt: new Date().toISOString()
    }

  } catch (error: any) {
    console.error('Failed to fetch more:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch more models and prices'
    })
  }
})
