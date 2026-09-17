import { chromium } from 'playwright'

let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true })
  }
  return browser
}

export async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
  }
}

/**
 * Scrape the cost per Intelligence Index task for a single model
 * from its Artificial Analysis detail page.
 * 
 * The cost is found in HTML like:
 * <span>$0.08</span>
 * <div class="text-xs text-neutral-500 max-w-[20ch]">Cost per Intelligence Index task</div>
 */
export async function scrapeModelCostPerTask(modelSlug: string): Promise<number | null> {
  const b = await getBrowser()
  const page = await b.newPage()
  
  try {
    await page.goto(`https://artificialanalysis.ai/models/${modelSlug}`, {
      waitUntil: 'networkidle',
      timeout: 60000
    })
    
    await page.waitForTimeout(2000)
    
    const html = await page.content()
    
    // Look for pattern: <span>$X.XX</span> followed by "Cost per Intelligence Index task"
    const costMatch = html.match(/<span>\$([0-9.]+)<\/span>[\s\S]{0,500}?Cost per Intelligence Index task/i)
    
    if (costMatch && costMatch[1]) {
      return parseFloat(costMatch[1])
    }
    
    // Alternative: look for the text label and find preceding dollar value
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

/**
 * Batch scrape multiple models for their cost per task
 */
export async function scrapeMultipleModelCosts(
  modelSlugs: string[],
  onProgress?: (current: number, total: number, model: string, cost: number | null) => void
): Promise<Map<string, number>> {
  const results = new Map<string, number>()
  
  for (let i = 0; i < modelSlugs.length; i++) {
    const slug = modelSlugs[i]
    
    // Progress callback
    if (onProgress) {
      onProgress(i + 1, modelSlugs.length, slug, null)
    }
    
    const cost = await scrapeModelCostPerTask(slug)
    if (cost !== null) {
      results.set(slug, cost)
      console.log(`[${i + 1}/${modelSlugs.length}] ${slug}: $${cost}`)
    } else {
      console.log(`[${i + 1}/${modelSlugs.length}] ${slug}: NOT FOUND`)
    }
    
    // Small delay to be respectful to AA's servers
    if (i < modelSlugs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }
  
  return results
}

/**
 * Get model slugs from Artificial Analysis API
 */
export async function getModelSlugsFromAPI(): Promise<string[]> {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY
  
  if (!apiKey) {
    throw new Error('ARTIFICIAL_ANALYSIS_API_KEY not set')
  }
  
  const response = await fetch('https://artificialanalysis.ai/api/v2/data/llms/models', {
    headers: {
      'x-api-key': apiKey
    }
  })
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  
  const data = await response.json() as { data: Array<{ slug: string }> }
  return data.data.map(m => m.slug)
}
