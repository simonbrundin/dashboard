import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY || config.artificialAnalysisApiKey
  
  try {
    // Get count from database
    const dbCountResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM models'
    )
    const dbCount = parseInt(dbCountResult[0]?.count || '0')
    
    // Get count with prices
    const withPricesResult = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM models WHERE cost_per_task > 0"
    )
    const withPricesCount = parseInt(withPricesResult[0]?.count || '0')
    
    // Get count from AA API
    let aaCount = 0
    if (apiKey) {
      try {
        const response = await $fetch<{ status: number; data: unknown[] }>(
          'https://artificialanalysis.ai/api/v2/data/llms/models',
          { headers: { 'x-api-key': apiKey } }
        )
        if (response.status === 200) {
          aaCount = response.data.length
        }
      } catch (error) {
        console.error('Failed to fetch AA count:', error)
      }
    }
    
    return {
      aaTotal: aaCount,
      dbTotal: dbCount,
      withPrices: withPricesCount,
      needsImport: aaCount > dbCount,
      needsPrices: dbCount - withPricesCount
    }
  } catch (error: unknown) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to get stats'
    })
  }
})
