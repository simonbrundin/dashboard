/**
 * Scrapes the "Cost per Intelligence Index task" from an Artificial Analysis model page.
 * Uses native fetch for fast and reliable scraping.
 * Returns the cost as a number, or null if the cost cannot be found.
 */
export async function scrapeModelCostPerTask(modelSlug: string): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    
    const response = await fetch(
      `https://artificialanalysis.ai/models/${modelSlug}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DashboardBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal
      }
    )
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      console.error(`HTTP ${response.status} for ${modelSlug}`)
      return null
    }
    
    const html = await response.text()

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
    console.error(`Error scraping ${modelSlug}:`, (error as Error).message)
    return null
  }
}

/**
 * Scrapes costs for multiple models with rate limiting.
 * Returns a map of slug -> cost.
 */
export async function scrapeModelCosts(
  slugs: string[],
  delayMs: number = 600,
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
