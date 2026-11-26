import type { ModelData } from '~/data/models'
import type { Category } from '~/utils/modelFormatters'
import { getReasoningEffort } from '~/utils/modelFormatters'
import {
  getBenchmarkCostPerAttempt,
  getBenchmarkOption,
  getBenchmarkRankingMetric,
  getBenchmarkScore,
  type RankingBenchmark,
  type RankingDirection
} from '~/utils/modelScoring'

export type SortColumn = 'ranking' | 'score' | 'intelligence' | 'cost' | 'speed'
export type EffortFilter = 'all' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'non-reasoning'

function compareNullable(
  a: number | null,
  b: number | null,
  direction: RankingDirection
): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  if (a === b) return 0
  const ascending = a < b ? -1 : 1
  return direction === 'asc' ? ascending : -ascending
}

export function useModelFilters(models: Ref<ModelData[]>) {
  const selectedCategory = ref<Category>('all')
  const selectedBenchmark = ref<RankingBenchmark>('deep-swe')
  const sortBy = ref<SortColumn>('ranking')
  const sortDirection = ref<RankingDirection>(getBenchmarkOption('deep-swe').direction)
  const showOnlyOpenWeights = ref(false)
  const showUnrankable = ref(false)
  const includeEstimatedScores = ref(false)
  const minBenchmarkScore = ref(0)
  // The reasoning effort is part of a measurement's identity: a "max" run
  // and a "low" run of the same model are not the same thing.
  const selectedEffort = ref<EffortFilter>('all')

  const maxBenchmarkScore = computed(() =>
    models.value.reduce((max, model) =>
      Math.max(max, getBenchmarkScore(model, selectedBenchmark.value, includeEstimatedScores.value) ?? 0), 0)
  )

  const modelsAboveThreshold = computed(() =>
    minBenchmarkScore.value > 0
      ? models.value.filter(model =>
          (getBenchmarkScore(model, selectedBenchmark.value, includeEstimatedScores.value) ?? -Infinity) >= minBenchmarkScore.value
        )
      : models.value
  )

  const rankableModels = computed(() =>
    modelsAboveThreshold.value.filter(model =>
      getBenchmarkRankingMetric(model, selectedBenchmark.value, includeEstimatedScores.value) !== null
    )
  )

  const categoryStats = computed(() => ({
    all: rankableModels.value.length,
    frontier: rankableModels.value.filter(model => model.category === 'frontier').length,
    high: rankableModels.value.filter(model => model.category === 'high').length,
    mid: rankableModels.value.filter(model => model.category === 'mid').length,
    budget: rankableModels.value.filter(model => model.category === 'budget').length,
    openWeights: rankableModels.value.filter(model => model.openWeights).length
  }))

  const effortStats = computed(() => {
    const counts: Record<string, number> = {}
    for (const model of rankableModels.value) {
      const effort = getReasoningEffort(model)
      counts[effort] = (counts[effort] ?? 0) + 1
    }
    return counts
  })

  const filteredModels = computed(() => {
    let result = showUnrankable.value ? modelsAboveThreshold.value : rankableModels.value

    if (selectedCategory.value !== 'all') {
      result = result.filter(model => model.category === selectedCategory.value)
    }

    if (selectedEffort.value !== 'all') {
      result = result.filter(model => getReasoningEffort(model) === selectedEffort.value)
    }

    if (showOnlyOpenWeights.value) {
      result = result.filter(model => model.openWeights)
    }

    return result
  })

  const sortedModels = computed(() => {
    const result = [...filteredModels.value]
    const benchmark = selectedBenchmark.value
    const includeEstimated = includeEstimatedScores.value

    switch (sortBy.value) {
      case 'ranking':
        return result.sort((a, b) => compareNullable(
          getBenchmarkRankingMetric(a, benchmark, includeEstimated)?.value ?? null,
          getBenchmarkRankingMetric(b, benchmark, includeEstimated)?.value ?? null,
          sortDirection.value
        ))

      case 'score':
        return result.sort((a, b) => compareNullable(
          getBenchmarkScore(a, benchmark, includeEstimated),
          getBenchmarkScore(b, benchmark, includeEstimated),
          sortDirection.value
        ))

      case 'intelligence':
        return result.sort((a, b) => compareNullable(
          a.intelligenceIndex,
          b.intelligenceIndex,
          sortDirection.value
        ))

      case 'cost': {
        const getCost = (model: ModelData): number | null =>
          getBenchmarkCostPerAttempt(model, benchmark)
        return result.sort((a, b) => compareNullable(getCost(a), getCost(b), sortDirection.value))
      }

      case 'speed':
        return result.sort((a, b) => compareNullable(a.speed ?? null, b.speed ?? null, sortDirection.value))
    }
  })

  function setSelectedBenchmark(benchmark: RankingBenchmark) {
    selectedBenchmark.value = benchmark
    if (sortBy.value === 'ranking') {
      sortDirection.value = getBenchmarkOption(benchmark).direction
    }
  }

  function handleSort(column: SortColumn) {
    if (sortBy.value === column) {
      sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
      return
    }

    sortBy.value = column
    sortDirection.value = column === 'ranking'
      ? getBenchmarkOption(selectedBenchmark.value).direction
      : column === 'cost'
        ? 'asc'
        : 'desc'
  }

  return {
    selectedCategory,
    selectedBenchmark,
    sortBy,
    sortDirection,
    showOnlyOpenWeights,
    showUnrankable,
    includeEstimatedScores,
    minBenchmarkScore,
    maxBenchmarkScore,
    selectedEffort,
    modelsAboveThreshold,
    categoryStats,
    effortStats,
    filteredModels,
    sortedModels,
    setSelectedBenchmark,
    handleSort
  }
}
