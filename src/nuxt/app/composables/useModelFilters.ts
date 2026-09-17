import type { ModelData } from '~/data/models'
import type { Category } from '~/utils/modelFormatters'

export type SortColumn = 'value' | 'intelligence' | 'cost' | 'speed'

export function useModelFilters(models: Ref<ModelData[]>) {
  // State
  const selectedCategory = ref<Category>('all')
  const sortBy = ref<SortColumn>('value')
  const sortDirection = ref<'asc' | 'desc'>('desc')
  const showOnlyOpenWeights = ref(false)
  const showWithoutPrice = ref(false)
  const minIntelligence = ref(0)

  // Max intelligence index in current data (slider upper bound)
  const maxIntelligence = computed(() =>
    models.value.reduce((max, m) => Math.max(max, m.intelligenceIndex), 0)
  )

  // Global page filter: only models at or above the intelligence threshold
  const modelsAboveThreshold = computed(() =>
    minIntelligence.value > 0
      ? models.value.filter((m) => m.intelligenceIndex >= minIntelligence.value)
      : models.value
  )

  // Category stats
  const categoryStats = computed(() => ({
    all: modelsAboveThreshold.value.length,
    frontier: modelsAboveThreshold.value.filter((m) => m.category === 'frontier').length,
    high: modelsAboveThreshold.value.filter((m) => m.category === 'high').length,
    mid: modelsAboveThreshold.value.filter((m) => m.category === 'mid').length,
    budget: modelsAboveThreshold.value.filter((m) => m.category === 'budget').length,
    openWeights: modelsAboveThreshold.value.filter((m) => m.openWeights).length
  }))

  // Filtered models
  const filteredModels = computed(() => {
    let result = modelsAboveThreshold.value

    if (selectedCategory.value !== 'all') {
      result = result.filter((m) => m.category === selectedCategory.value)
    }

    if (showOnlyOpenWeights.value) {
      result = result.filter((m) => m.openWeights)
    }

    if (!showWithoutPrice.value) {
      result = result.filter((m) => m.costPerTask != null && m.costPerTask > 0)
    }

    return result
  })

  // Sorted models
  const sortedModels = computed(() => {
    const result = [...filteredModels.value]
    const dir = sortDirection.value === 'desc' ? -1 : 1

    switch (sortBy.value) {
      case 'value':
        return result.sort((a, b) => {
          const aCost = a.costPerTask ?? 0
          const bCost = b.costPerTask ?? 0
          if (aCost === 0 && bCost === 0) return 0
          if (aCost === 0) return -1 * dir
          if (bCost === 0) return 1 * dir
          const aRatio = a.intelligenceIndex / aCost
          const bRatio = b.intelligenceIndex / bCost
          return (bRatio - aRatio) * dir
        })

      case 'intelligence':
        return result.sort((a, b) =>
          (b.intelligenceIndex - a.intelligenceIndex) * dir
        )

      case 'cost':
        return result.sort((a, b) => {
          const aCost = a.costPerTask ?? 0
          const bCost = b.costPerTask ?? 0
          return (aCost - bCost) * dir
        })

      case 'speed':
        return result.sort((a, b) =>
          ((b.speed || 0) - (a.speed || 0)) * dir
        )

      default:
        return result
    }
  })

  // Sort handler
  function handleSort(column: SortColumn) {
    if (sortBy.value === column) {
      sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
    } else {
      sortBy.value = column
      sortDirection.value = 'desc'
    }
  }

  return {
    // State
    selectedCategory,
    sortBy,
    sortDirection,
    showOnlyOpenWeights,
    showWithoutPrice,
    minIntelligence,
    // Computed
    maxIntelligence,
    modelsAboveThreshold,
    categoryStats,
    filteredModels,
    sortedModels,
    // Methods
    handleSort
  }
}
