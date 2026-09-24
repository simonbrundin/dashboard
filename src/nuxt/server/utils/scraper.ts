import { execSync } from 'child_process'

/**
 * Scrapes the "Cost per Intelligence Index task" from an Artificial Analysis model page.
 * Uses curl for faster and more reliable scraping.
 * Returns the cost as a number, or null if the cost cannot be found.
 */
export async function scrapeModelCostPerTask(modelSlug: string): Promise<number | null> {
  try {
    const html = execSync(
      `curl -s -m 15 "https://artificialanalysis.ai/models/${modelSlug}" 2>/dev/null`,
      { encoding: 'utf8', timeout: 20000 }
    )

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
  delayMs: number = 800,
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
