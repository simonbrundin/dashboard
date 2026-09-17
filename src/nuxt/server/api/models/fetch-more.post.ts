import { query } from '../../utils/db'
import { chromium } from 'playwright'

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
    // Get models from database that don't have cost data
    const modelsWithoutCost = await query<{ slug: string; name: string }>(
      "SELECT slug, name FROM models WHERE cost_per_task = 0 OR cost_per_task IS NULL"
    )

    console.log(`Fetching prices for ${modelsWithoutCost.length} models without cost data...`)

    let added = 0
    const total = modelsWithoutCost.length

    for (const model of modelsWithoutCost) {
      const costPerTask = await scrapeModelCostPerTask(model.slug)
      
      if (costPerTask !== null) {
        await query(
          'UPDATE models SET cost_per_task = $1, updated_at = CURRENT_TIMESTAMP WHERE slug = $2',
          [costPerTask, model.slug]
        )
        added++
        console.log(`[${added}/${total}] ${model.slug}: $${costPerTask}/task ✓`)
      } else {
        console.log(`[${added}/${total}] ${model.slug}: FAILED`)
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1200))
    }

    // Get total count
    const countResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM models WHERE cost_per_task > 0')
    const totalWithCost = parseInt(countResult[0]?.count || '0')

    console.log(`Fetch complete! Added prices for ${added} models.`)

    return {
      success: true,
      added,
      total: totalWithCost,
      updatedAt: new Date().toISOString()
    }

  } catch (error: any) {
    console.error('Failed to fetch more prices:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch more prices'
    })
  }
})
