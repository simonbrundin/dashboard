import type { ModelData } from '~/data/models'
import type { Category } from '~/utils/modelFormatters'
import {
  getCodingScore,
  getRankingCodingValue,
  getTaskCost,
  hasRankableCodingEvidence,
  hasTaskCost
} from '~/utils/modelScoring'

export type SortColumn = 'codingValue' | 'coding' | 'intelligence' | 'cost' | 'speed'

export function useModelFilters(models: Ref<ModelData[]>) {
  const selectedCategory = ref<Category>('all')
  const sortBy = ref<SortColumn>('codingValue')
  const sortDirection = ref<'asc' | 'desc'>('desc')
  const showOnlyOpenWeights = ref(false)
  const showWithoutPrice = ref(false)
  const includeEstimatedScores = ref(false)
  const minCodingIndex = ref(0)

  const maxCodingIndex = computed(() =>
    models.value.reduce((max, model) => Math.max(max, getCodingScore(model) ?? 0), 0)
  )

  // Models without a coding score remain visible at zero threshold, but are
  // excluded as soon as the user asks for a minimum coding score.
  const modelsAboveThreshold = computed(() =>
    minCodingIndex.value > 0
      ? models.value.filter(model => (getCodingScore(model) ?? -Infinity) >= minCodingIndex.value)
      : models.value
  )

  const categoryStats = computed(() => ({
    all: modelsAboveThreshold.value.length,
    frontier: modelsAboveThreshold.value.filter(model => model.category === 'frontier').length,
    high: modelsAboveThreshold.value.filter(model => model.category === 'high').length,
    mid: modelsAboveThreshold.value.filter(model => model.category === 'mid').length,
    budget: modelsAboveThreshold.value.filter(model => model.category === 'budget').length,
    openWeights: modelsAboveThreshold.value.filter(model => model.openWeights).length
  }))

  const filteredModels = computed(() => {
    let result = modelsAboveThreshold.value

    if (selectedCategory.value !== 'all') {
      result = result.filter(model => model.category === selectedCategory.value)
    }

    if (showOnlyOpenWeights.value) {
      result = result.filter(model => model.openWeights)
    }

    if (!showWithoutPrice.value) {
      result = result.filter(model => getCodingScore(model) !== null || hasTaskCost(model))
    }

    return result
  })

  const sortedModels = computed(() => {
    const result = [...filteredModels.value]
    const direction = sortDirection.value === 'desc' ? -1 : 1

    switch (sortBy.value) {
      case 'codingValue':
        return result.sort((a, b) => {
          const aValue = getRankingCodingValue(a, includeEstimatedScores.value)
          const bValue = getRankingCodingValue(b, includeEstimatedScores.value)
          if (aValue === null && bValue === null) return 0
          if (aValue === null) return 1
          if (bValue === null) return -1
          return (bValue - aValue) * direction
        })

      case 'coding':
        return result.sort((a, b) => {
          const aScore = hasRankableCodingEvidence(a, includeEstimatedScores.value) ? getCodingScore(a) : null
          const bScore = hasRankableCodingEvidence(b, includeEstimatedScores.value) ? getCodingScore(b) : null
          if (aScore === null && bScore === null) return 0
          if (aScore === null) return 1
          if (bScore === null) return -1
          return (bScore - aScore) * direction
        })

      case 'intelligence':
        return result.sort((a, b) => (b.intelligenceIndex - a.intelligenceIndex) * direction)

      case 'cost':
        return result.sort((a, b) => {
          const aCost = getTaskCost(a)
          const bCost = getTaskCost(b)
          if (aCost === null && bCost === null) return 0
          if (aCost === null) return 1
          if (bCost === null) return -1
          return (aCost - bCost) * direction
        })

      case 'speed':
        return result.sort((a, b) => ((b.speed ?? -Infinity) - (a.speed ?? -Infinity)) * direction)

      default:
        return result
    }
  })

  function handleSort(column: SortColumn) {
    if (sortBy.value === column) {
      sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
    } else {
      sortBy.value = column
      sortDirection.value = 'desc'
    }
  }

  return {
    selectedCategory,
    sortBy,
    sortDirection,
    showOnlyOpenWeights,
    showWithoutPrice,
    includeEstimatedScores,
    minCodingIndex,
    maxCodingIndex,
    modelsAboveThreshold,
    categoryStats,
    filteredModels,
    sortedModels,
    handleSort
  }
}
