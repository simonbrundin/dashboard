const SCRAPE_RATE_LIMIT_MS = 1200

export function pauseForRateLimit(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, SCRAPE_RATE_LIMIT_MS))
}
