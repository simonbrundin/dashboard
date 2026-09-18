export interface AAModel {
  id: string
  name: string
  slug: string
  model_creator: { id: string; name: string; slug: string }
  evaluations: { artificial_analysis_intelligence_index: number; [key: string]: number | null | undefined }
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

export const INSERT_MODELS_COLUMNS = `
  INSERT INTO models (id, name, slug, provider, provider_logo, intelligence_index,
    cost_per_task, input_price_per_m, output_price_per_m, category,
    strengths, context_window, open_weights, speed, latency)
  VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, $11, $12, $13, $14)
  ON CONFLICT (id) DO NOTHING
`

export function requireApiKey(): string {
  const config = useRuntimeConfig()
  const apiKey = config.artificialAnalysisApiKey
  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'API key not configured.' })
  }
  return apiKey
}

export async function fetchModelsFromAA(apiKey: string): Promise<AAModel[]> {
  const response = await $fetch<AAAPIResponse>('https://artificialanalysis.ai/api/v2/data/llms/models', {
    headers: { 'x-api-key': apiKey }
  })

  if (response.status !== 200) {
    throw createError({ statusCode: response.status, message: 'Failed to fetch from AA API' })
  }

  return response.data.filter(
    m => m.evaluations?.artificial_analysis_intelligence_index && m.pricing?.price_1m_blended_3_to_1 !== undefined
  )
}

export function determineCategory(pricePerMillion: number): string {
  if (pricePerMillion === 0) return 'budget'
  if (pricePerMillion > 50) return 'frontier'
  if (pricePerMillion > 10) return 'high'
  if (pricePerMillion > 1) return 'mid'
  return 'budget'
}

export function isOpenWeights(name: string): boolean {
  const patterns = ['llama', 'gemma', 'mistral', 'qwen', 'deepseek-r1', 'deepseek-v3', 'phi', 'granite', 'devstral', 'codestral']
  const lower = name.toLowerCase()
  return patterns.some(p => lower.includes(p.toLowerCase()))
}

export function toModelRow(model: AAModel): unknown[] {
  return [
    model.id, model.name, model.slug, model.model_creator.name, model.model_creator.slug,
    Math.round(model.evaluations.artificial_analysis_intelligence_index),
    model.pricing.price_1m_input_tokens, model.pricing.price_1m_output_tokens,
    determineCategory(model.pricing.price_1m_blended_3_to_1), [], 'N/A',
    isOpenWeights(model.name),
    Math.round(model.median_output_tokens_per_second),
    Math.round(model.median_time_to_first_token_seconds * 100) / 100
  ]
}
