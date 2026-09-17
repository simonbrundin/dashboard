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
  try {
    // Get all models from database
    const models = await query<{ slug: string; name: string }>(
      'SELECT slug, name FROM models'
    )

    console.log(`Refreshing prices for ${models.length} models...`)

    let updated = 0
    const total = models.length

    for (const model of models) {
      const costPerTask = await scrapeModelCostPerTask(model.slug)
      
      if (costPerTask !== null) {
        await query(
          'UPDATE models SET cost_per_task = $1, updated_at = CURRENT_TIMESTAMP WHERE slug = $2',
          [costPerTask, model.slug]
        )
        updated++
      }

      console.log(`[${updated}/${total}] ${model.slug}: $${costPerTask ?? 'FAILED'}/task`)
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1200))
    }

    console.log(`Refresh complete! Updated ${updated} models.`)

    return {
      success: true,
      updated,
      updatedAt: new Date().toISOString()
    }

  } catch (error: any) {
    console.error('Failed to refresh prices:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to refresh prices'
    })
  }
})
