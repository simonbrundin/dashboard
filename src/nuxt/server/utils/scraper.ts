import { chromium } from 'playwright'

/**
 * Scrapes the "Cost per Intelligence Index task" from an Artificial Analysis model page.
 * Returns the cost as a number, or null if the cost cannot be found.
 */
export async function scrapeModelCostPerTask(modelSlug: string): Promise<number | null> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const browser = await chromium.launch({ 
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-accelerated-2d-canvas',
          '--disable-translate',
          '--disable-extensions',
          '--disable-background-networking',
          '--safebrowsing-disable-auto-update',
          '--disable-sync',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--disable-features=IsolateOrigins,site-per-process',
        ]
      })
      
      try {
        const page = await browser.newPage()
        
        await page.goto(`https://artificialanalysis.ai/models/${modelSlug}`, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        })

        await page.waitForTimeout(1000)
        const html = await page.content()

        // Look for the cost near "Cost per Intelligence Index task" text
        const costMatch = html.match(/<span>\$([0-9.]+)<\/span>[\s\S]{0,500}?Cost per Intelligence Index task/i)

        if (costMatch && costMatch[1]) {
          return parseFloat(costMatch[1])
        }

        // Fallback: search backwards from the text
        const taskIndex = html.indexOf('Cost per Intelligence Index task')
        if (taskIndex > -1) {
          const beforeText = html.substring(Math.max(0, taskIndex - 300), taskIndex)
          const dollarMatch = beforeText.match(/\$([0-9.]+)/)
          if (dollarMatch && dollarMatch[1]) {
            return parseFloat(dollarMatch[1])
          }
        }

        return null
      } finally {
        await browser.close()
      }
    } catch (error) {
      lastError = error as Error
      console.error(`Error scraping ${modelSlug} (attempt ${attempt + 1}):`, lastError.message)
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  console.error(`Failed to scrape ${modelSlug} after 3 attempts:`, lastError?.message)
  return null
}

/**
 * Scrapes costs for multiple models with rate limiting.
 * Returns a map of slug -> cost.
 */
export async function scrapeModelCosts(
  slugs: string[],
  delayMs: number = 1200,
  onProgress?: (current: number, total: number, slug: string, cost: number | null) => void
): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>()
  const total = slugs.length

  for (const [index, slug] of slugs.entries()) {
    const cost = await scrapeModelCostPerTask(slug)
    results.set(slug, cost)

    onProgress?.(index + 1, total, slug, cost)

    // Rate limit between requests
    if (index < slugs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}
