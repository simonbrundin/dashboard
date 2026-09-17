import { chromium } from 'playwright'

/**
 * Scrapes the "Cost per Intelligence Index task" from an Artificial Analysis model page.
 * Returns the cost as a number, or null if the cost cannot be found.
 */
export async function scrapeModelCostPerTask(modelSlug: string): Promise<number | null> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(`https://artificialanalysis.ai/models/${modelSlug}`, {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    await page.waitForTimeout(2000)
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
  } catch (error) {
    console.error(`Error scraping ${modelSlug}:`, error)
    return null
  } finally {
    await browser.close()
  }
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

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    const cost = await scrapeModelCostPerTask(slug)
    results.set(slug, cost)

    onProgress?.(i + 1, total, slug, cost)

    // Rate limit between requests
    if (i < slugs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}
