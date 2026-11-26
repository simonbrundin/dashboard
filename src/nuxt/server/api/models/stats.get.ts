import { query } from '../../utils/db'
import { fetchAAModelCount } from '../../utils/artificialAnalysis'
import { ensureModelsSchema } from '../../utils/modelRows'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY || config.artificialAnalysisApiKey
  
  try {
    await ensureModelsSchema()

    // Get count from database
    const dbCountResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM models'
    )
    const dbCount = parseInt(dbCountResult[0]?.count || '0')
    
    // Keep measured coding costs separate from the broader AA proxy cost.
    const withMeasuredCodingCostResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM models WHERE coding_agent_cost_per_successful_task IS NOT NULL'
    )
    const withMeasuredCodingCost = parseInt(withMeasuredCodingCostResult[0]?.count || '0')

    const withProxyCostResult = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM models WHERE coding_agent_cost_per_successful_task IS NULL AND COALESCE(aa_intelligence_cost_per_task, cost_per_task) IS NOT NULL"
    )
    const withProxyCost = parseInt(withProxyCostResult[0]?.count || '0')

    // With the full catalog imported, models without an Intelligence Index
    // cannot get a proxy task cost from scraping - only index models count
    // as fetchable.
    const needsPricesResult = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM models WHERE intelligence_index IS NOT NULL AND COALESCE(aa_intelligence_cost_per_task, cost_per_task) IS NULL"
    )
    const needsPrices = parseInt(needsPricesResult[0]?.count || '0')

    const withPricesCount = withMeasuredCodingCost + withProxyCost
    
    // Get count from AA API
    let aaCount = 0
    if (apiKey) {
      try {
        aaCount = await fetchAAModelCount(apiKey)
      } catch (error) {
        console.error('Failed to fetch AA count:', error)
      }
    }
    
    return {
      aaTotal: aaCount,
      dbTotal: dbCount,
      withPrices: withPricesCount,
      withMeasuredCodingCost,
      withProxyCost,
      needsImport: aaCount > dbCount,
      needsPrices
    }
  } catch (error: unknown) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to get stats'
    })
  }
})
