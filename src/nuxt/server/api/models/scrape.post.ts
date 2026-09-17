import { query } from '../../utils/db'
import { chromium } from 'playwright'

// === Scraper functions ===

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

// === Types ===

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
    artificial_analysis_coding_index: number | null
    artificial_analysis_math_index: number | null
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

function getProviderLogo(slug: string): string {
  const logoMap: Record<string, string> = {
    'openai': 'openai',
    'anthropic': 'anthropic',
    'google': 'google',
    'deepseek': 'deepseek',
    'meta': 'meta',
    'mistral-ai': 'mistral',
    'cohere': 'cohere',
    'alibaba': 'qwen',
    'ibm': 'ibm',
  }
  return logoMap[slug] || 'generic'
}

function extractStrengths(evaluations: Record<string, number | null | undefined>): string[] {
  const strengths: string[] = []
  
  if (evaluations.artificial_analysis_coding_index && evaluations.artificial_analysis_coding_index > 50) {
    strengths.push('Coding')
  }
  if (evaluations.artificial_analysis_math_index && evaluations.artificial_analysis_math_index > 60) {
    strengths.push('Math')
  }
  if (evaluations.hle && evaluations.hle > 0.5) {
    strengths.push('Long horizon')
  }
  if (evaluations.livecodebench && evaluations.livecodebench > 0.6) {
    strengths.push('Live Code')
  }
  
  return strengths.length > 0 ? strengths : ['General']
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
    console.log('Starting full model scrape...')
    
    // Step 1: Fetch base data from API
    const response = await $fetch<AAAPIResponse>('https://artificialanalysis.ai/api/v2/data/llms/models', {
      headers: { 'x-api-key': apiKey }
    })

    if (response.status !== 200) {
      throw createError({
        statusCode: response.status,
        message: 'Failed to fetch from Artificial Analysis API'
      })
    }

    // Step 2: Filter to models with intelligence index and pricing
    const validModels = response.data.filter(
      m => m.evaluations?.artificial_analysis_intelligence_index && 
           m.pricing?.price_1m_blended_3_to_1 !== undefined
    )

    console.log(`Found ${validModels.length} valid models to scrape`)

    // Step 3: Scrape cost per task for all models
    let scraped = 0
    const total = validModels.length
    
    for (const model of validModels) {
      scraped++
      
      // Scrape cost per task
      const costPerTask = await scrapeModelCostPerTask(model.slug)
      
      if (costPerTask === null) {
        console.log(`[${scraped}/${total}] ${model.slug}: SCRAPE FAILED - skipping`)
        continue
      }

      // Prepare data
      const intelligenceIndex = Math.round(model.evaluations.artificial_analysis_intelligence_index)
      const pricePerMillion = model.pricing.price_1m_blended_3_to_1
      const openWeights = isOpenWeights(model.name)
      const strengths = extractStrengths(model.evaluations)

      // Upsert to database
      await query(`
        INSERT INTO models (
          id, name, slug, provider, provider_logo, intelligence_index,
          cost_per_task, input_price_per_m, output_price_per_m, category,
          strengths, context_window, open_weights, speed, latency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          provider = EXCLUDED.provider,
          intelligence_index = EXCLUDED.intelligence_index,
          cost_per_task = EXCLUDED.cost_per_task,
          input_price_per_m = EXCLUDED.input_price_per_m,
          output_price_per_m = EXCLUDED.output_price_per_m,
          category = EXCLUDED.category,
          strengths = EXCLUDED.strengths,
          open_weights = EXCLUDED.open_weights,
          speed = EXCLUDED.speed,
          latency = EXCLUDED.latency,
          updated_at = CURRENT_TIMESTAMP
      `, [
        model.id,
        model.name,
        model.slug,
        model.model_creator.name,
        getProviderLogo(model.model_creator.slug),
        intelligenceIndex,
        costPerTask,
        model.pricing.price_1m_input_tokens,
        model.pricing.price_1m_output_tokens,
        determineCategoryFromPrice(pricePerMillion),
        strengths,
        'N/A',
        openWeights,
        Math.round(model.median_output_tokens_per_second),
        Math.round(model.median_time_to_first_token_seconds * 100) / 100
      ])

      console.log(`[${scraped}/${total}] ${model.slug}: $${costPerTask}/task ✓`)
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1200))
    }

    // Get final count
    const countResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM models')
    const count = parseInt(countResult[0]?.count || '0')

    console.log(`Scraping complete! ${count} models in database.`)

    return {
      success: true,
      totalModels: count,
      scraped,
      updatedAt: new Date().toISOString()
    }
    
  } catch (error: any) {
    console.error('Failed to scrape models:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to scrape models'
    })
  }
})
