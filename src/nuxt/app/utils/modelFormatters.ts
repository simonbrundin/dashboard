export type Category = 'all' | 'frontier' | 'high' | 'mid' | 'budget'

export function getCategoryColor(category: string): string {
  const colors: Record<Exclude<Category, 'all'>, string> = {
    frontier: 'text-purple-500 bg-purple-500/10',
    high: 'text-blue-500 bg-blue-500/10',
    mid: 'text-green-500 bg-green-500/10',
    budget: 'text-amber-500 bg-amber-500/10'
  }
  if (category === 'all') return 'text-gray-500 bg-gray-500/10'
  return colors[category as Exclude<Category, 'all'>] || 'text-gray-500 bg-gray-500/10'
}

export interface ValueRating {
  stars: number
  label: string
}

export function getValueRating(ratio: number | null | undefined): ValueRating {
  if (ratio == null || Number.isNaN(ratio)) {
    return { stars: 0, label: 'Unavailable' }
  }
  if (!isFinite(ratio)) {
    return { stars: 5, label: 'Free' }
  }
  if (ratio >= 200) return { stars: 5, label: 'Excellent' }
  if (ratio >= 100) return { stars: 4, label: 'Great' }
  if (ratio >= 50) return { stars: 3, label: 'Good' }
  if (ratio >= 25) return { stars: 2, label: 'Fair' }
  return { stars: 1, label: 'Basic' }
}

export function formatCodingValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (!isFinite(value)) return 'Free'
  return `${value.toFixed(0)} pts/$`
}

export function formatCost(cost: number | string | null | undefined): string {
  if (cost == null) return '—'
  const numCost = typeof cost === 'string' ? parseFloat(cost) : cost
  if (isNaN(numCost)) return '—'
  if (!isFinite(numCost)) return '∞'
  if (numCost === 0) return 'Free'
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
