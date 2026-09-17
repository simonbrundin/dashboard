import { writeFile } from 'fs/promises'
import { join } from 'path'

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

function categorizeModel(intelligenceIndex: number, price: number): 'frontier' | 'high' | 'mid' | 'budget' {
  if (intelligenceIndex >= 50 && price > 1) return 'frontier'
  if (intelligenceIndex >= 40 && price > 0.2) return 'high'
  if (intelligenceIndex >= 30 || price <= 0.5) return 'mid'
  return 'budget'
}

function determineCategoryFromPrice(pricePerMillion: number): 'frontier' | 'high' | 'mid' | 'budget' {
  // Price is per million tokens
  if (pricePerMillion === 0) return 'budget' // Free models
  if (pricePerMillion > 50) return 'frontier'
  if (pricePerMillion > 10) return 'high'
  if (pricePerMillion > 1) return 'mid'
  return 'budget'
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  // Get API key from environment or config
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY || config.artificialAnalysisApiKey
  
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Artificial Analysis API key not configured. Set ARTIFICIAL_ANALYSIS_API_KEY in your .env file.'
    })
  }

  try {
    // Fetch data from Artificial Analysis API
    const response = await $fetch<AAAPIResponse>('https://artificialanalysis.ai/api/v2/data/llms/models', {
      headers: {
        'x-api-key': apiKey
      }
    })

    if (response.status !== 200) {
      throw createError({
        statusCode: response.status,
        message: 'Failed to fetch from Artificial Analysis API'
      })
    }

    // Transform data to our format
    const models = response.data
      .filter(m => m.evaluations?.artificial_analysis_intelligence_index && m.pricing?.price_1m_blended_3_to_1)
      .map(m => {
        const intelligenceIndex = Math.round(m.evaluations.artificial_analysis_intelligence_index)
        const pricePerMillion = m.pricing.price_1m_blended_3_to_1
        const costPerTask = pricePerMillion === 0 ? 0 : pricePerMillion / 1000 // Convert per million to per 1K tokens
        
        return {
          id: m.id,
          name: m.name,
          provider: m.model_creator.name,
          providerLogo: getProviderLogo(m.model_creator.slug),
          intelligenceIndex,
          costPerTask: Math.round(costPerTask * 10000) / 10000, // Round to 4 decimals
          inputPricePerM: m.pricing.price_1m_input_tokens,
          outputPricePerM: m.pricing.price_1m_output_tokens,
          category: determineCategoryFromPrice(pricePerMillion),
          strengths: extractStrengths(m.evaluations),
          contextWindow: 'N/A', // Not available in free API
          openWeights: isOpenWeights(m.name),
          speed: Math.round(m.median_output_tokens_per_second),
          latency: Math.round(m.median_time_to_first_token_seconds * 100) / 100
        }
      })
      .sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)

    // Save to file
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
      updatedAt: exportData.updatedAt
    }
  } catch (error: any) {
    console.error('Failed to refresh models:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to refresh models from Artificial Analysis'
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
