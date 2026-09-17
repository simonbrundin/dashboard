import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { chromium } from 'playwright'

// === Scraper functions (inlined to avoid import issues) ===

let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true })
  }
  return browser
}

async function scrapeModelCostPerTask(modelSlug: string): Promise<number | null> {
  const b = await getBrowser()
  const page = await b.newPage()
  
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
    await page.close()
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
    [key: string]: number | undefined
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

interface CachedData {
  source: string
  updatedAt: string
  totalModels: number
  costPerTaskCache: Record<string, number>
}

function determineCategoryFromPrice(pricePerMillion: number): 'frontier' | 'high' | 'mid' | 'budget' {
  if (pricePerMillion === 0) return 'budget'
  if (pricePerMillion > 50) return 'frontier'
  if (pricePerMillion > 10) return 'high'
  if (pricePerMillion > 1) return 'mid'
  return 'budget'
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
    // Step 1: Fetch base data from API (fast)
    const response = await $fetch<AAAPIResponse>('https://artificialanalysis.ai/api/v2/data/llms/models', {
      headers: { 'x-api-key': apiKey }
    })

    if (response.status !== 200) {
      throw createError({
        statusCode: response.status,
        message: 'Failed to fetch from Artificial Analysis API'
      })
    }

    // Step 2: Load existing cost/task cache if exists
    const cachePath = join(process.cwd(), 'app', 'data', 'models-cache.json')
    let costCache: Record<string, number> = {}
    
    try {
      const cachedData = await readFile(cachePath, 'utf-8')
      const parsed = JSON.parse(cachedData) as CachedData
      costCache = parsed.costPerTaskCache || {}
      console.log(`Loaded ${Object.keys(costCache).length} cached cost/task values`)
    } catch {
      console.log('No existing cache, starting fresh')
    }

    // Step 3: Scrape cost per task for models that don't have it cached
    const modelsNeedingScrape = response.data
      .filter(m => m.evaluations?.artificial_analysis_intelligence_index && m.pricing?.price_1m_blended_3_to_1)
      .filter(m => !costCache[m.slug])
      .map(m => m.slug)

    console.log(`Need to scrape ${modelsNeedingScrape.length} models for cost/task`)

    if (modelsNeedingScrape.length > 0) {
      let scraped = 0
      for (const slug of modelsNeedingScrape) {
        scraped++
        if (scraped % 10 === 0) {
          console.log(`Scraping progress: ${scraped}/${modelsNeedingScrape.length}`)
        }
        
        const cost = await scrapeModelCostPerTask(slug)
        if (cost !== null) {
          costCache[slug] = cost
        }
        
        await new Promise(resolve => setTimeout(resolve, 1200))
      }
      
      // Save updated cache
      const cacheData: CachedData = {
        source: 'artificialanalysis.ai',
        updatedAt: new Date().toISOString(),
        totalModels: Object.keys(costCache).length,
        costPerTaskCache: costCache
      }
      await writeFile(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8')
      console.log(`Saved cache with ${Object.keys(costCache).length} cost/task values`)
    }

    // Step 4: Transform data using scraped cost/task
    const models = response.data
      .filter(m => m.evaluations?.artificial_analysis_intelligence_index && m.pricing?.price_1m_blended_3_to_1)
      .map(m => {
        const intelligenceIndex = Math.round(m.evaluations.artificial_analysis_intelligence_index)
        const pricePerMillion = m.pricing.price_1m_blended_3_to_1
        const costPerTask = costCache[m.slug] ?? pricePerMillion
        
        return {
          id: m.id,
          name: m.name,
          slug: m.slug,
          provider: m.model_creator.name,
          providerLogo: getProviderLogo(m.model_creator.slug),
          intelligenceIndex,
          costPerTask,
          inputPricePerM: m.pricing.price_1m_input_tokens,
          outputPricePerM: m.pricing.price_1m_output_tokens,
          category: determineCategoryFromPrice(pricePerMillion),
          strengths: extractStrengths(m.evaluations),
          contextWindow: 'N/A',
          openWeights: isOpenWeights(m.name),
          speed: Math.round(m.median_output_tokens_per_second),
          latency: Math.round(m.median_time_to_first_token_seconds * 100) / 100
        }
      })
      .filter(m => m.costPerTask > 0) // Only include models with cost data
      .sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)

    // Step 5: Save to file
    const dataPath = join(process.cwd(), 'app', 'data', 'models-live.json')
    const exportData = {
      source: 'artificialanalysis.ai',
      updatedAt: new Date().toISOString(),
      totalModels: models.length,
      models
    }
    
    await writeFile(dataPath, JSON.stringify(exportData, null, 2), 'utf-8')

    return {
      success: true,
      totalModels: models.length,
      cachedCostTasks: Object.keys(costCache).length,
      scrapedNew: modelsNeedingScrape.length,
      updatedAt: exportData.updatedAt
    }
  } catch (error: any) {
    console.error('Failed to refresh models:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to refresh models'
    })
  }
})

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

function extractStrengths(evaluations: Record<string, number | undefined>): string[] {
  const strengths: string[] = []
  
  if (evaluations.artificial_analysis_coding_index > 50) {
    strengths.push('Coding')
  }
  if (evaluations.artificial_analysis_math_index > 60) {
    strengths.push('Math')
  }
  if (evaluations.hle > 0.5) {
    strengths.push('Long horizon')
  }
  if (evaluations.livecodebench > 0.6) {
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
