export type Category = 'frontier' | 'high' | 'mid' | 'budget'

export function getCategoryColor(category: string): string {
  const colors: Record<Category, string> = {
    frontier: 'text-purple-500 bg-purple-500/10',
    high: 'text-blue-500 bg-blue-500/10',
    mid: 'text-green-500 bg-green-500/10',
    budget: 'text-amber-500 bg-amber-500/10'
  }
  return colors[category as Category] || 'text-gray-500 bg-gray-500/10'
}

export interface ValueRating {
  stars: number
  label: string
}

export function getValueRating(ratio: number | undefined): ValueRating {
  if (ratio === undefined || !isFinite(ratio)) {
    return { stars: 5, label: 'Free' }
  }
  if (ratio >= 200) return { stars: 5, label: 'Excellent' }
  if (ratio >= 100) return { stars: 4, label: 'Great' }
  if (ratio >= 50) return { stars: 3, label: 'Good' }
  if (ratio >= 25) return { stars: 2, label: 'Fair' }
  return { stars: 1, label: 'Basic' }
}

export function formatCost(cost: number | string | null | undefined): string {
  if (cost == null) return '—'
  const numCost = typeof cost === 'string' ? parseFloat(cost) : cost
  if (isNaN(numCost) || numCost === 0) return 'Free'
  if (numCost < 0.01) return `$${numCost.toFixed(3)}/task`
  if (numCost < 0.1) return `$${numCost.toFixed(2)}/task`
  if (numCost < 1) return `$${numCost.toFixed(2)}/task`
  if (numCost < 10) return `$${numCost.toFixed(1)}/task`
  return `$${numCost.toFixed(0)}/task`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleString()
}
