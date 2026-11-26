import type { ModelData } from '~/data/models'
import {
  getBenchmarkCostPerAttempt,
  getBenchmarkCostPerSuccessfulTask,
  getBenchmarkRankingMetric,
  getBenchmarkScore,
  type RankingBenchmark,
  type RankingDirection
} from '~/utils/modelScoring'

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

function getBenchmarkCost(model: ModelData, benchmark: RankingBenchmark): number | null {
  return getBenchmarkCostPerSuccessfulTask(model, benchmark) ??
    getBenchmarkCostPerAttempt(model, benchmark)
}

export function useModelStats(
  models: Ref<ModelData[]>,
  benchmark: Ref<RankingBenchmark>,
  includeEstimated: Ref<boolean>
) {
  const rankedModels = computed(() =>
    models.value.filter(model =>
      getBenchmarkRankingMetric(model, benchmark.value, includeEstimated.value) !== null
    )
  )

  const scoredModels = computed(() =>
    models.value.filter(model =>
      getBenchmarkScore(model, benchmark.value, includeEstimated.value) !== null
    )
  )

  const bestValueModels = computed(() => {
    const [firstRanked] = rankedModels.value
    if (!firstRanked) return []

    const direction = getBenchmarkRankingMetric(
      firstRanked,
      benchmark.value,
      includeEstimated.value
    )?.direction

    if (!direction) return []

    return [...rankedModels.value]
      .sort((a, b) => compareNullable(
        getBenchmarkRankingMetric(a, benchmark.value, includeEstimated.value)?.value ?? null,
        getBenchmarkRankingMetric(b, benchmark.value, includeEstimated.value)?.value ?? null,
        direction
      ))
      .slice(0, 3)
  })

  const topScoreModels = computed(() =>
    [...scoredModels.value]
      .sort((a, b) => compareNullable(
        getBenchmarkScore(a, benchmark.value, includeEstimated.value),
        getBenchmarkScore(b, benchmark.value, includeEstimated.value),
        'desc'
      ))
      .slice(0, 1)
  )

  const lowestCostModels = computed(() =>
    [...rankedModels.value]
      .sort((a, b) => compareNullable(
        getBenchmarkCostPerAttempt(a, benchmark.value),
        getBenchmarkCostPerAttempt(b, benchmark.value),
        'asc'
      ))
      .slice(0, 1)
  )

  const paretoOptimalModels = computed(() => {
    const candidates = rankedModels.value.filter(model =>
      getBenchmarkScore(model, benchmark.value, includeEstimated.value) !== null &&
      getBenchmarkCost(model, benchmark.value) !== null
    )
    const pareto = candidates.filter((model) => {
      const modelCost = getBenchmarkCost(model, benchmark.value) as number
      const modelScore = getBenchmarkScore(model, benchmark.value, includeEstimated.value) as number

      return !candidates.some((other) => {
        const otherCost = getBenchmarkCost(other, benchmark.value) as number
        const otherScore = getBenchmarkScore(other, benchmark.value, includeEstimated.value) as number
        return otherCost <= modelCost &&
          otherScore >= modelScore &&
          (otherCost < modelCost || otherScore > modelScore)
      })
    })

    return pareto
      .sort((a, b) => compareNullable(
        getBenchmarkScore(a, benchmark.value, includeEstimated.value),
        getBenchmarkScore(b, benchmark.value, includeEstimated.value),
        'desc'
      ))
      .slice(0, 6)
  })

  return {
    bestValueModels,
    topScoreModels,
    lowestCostModels,
    paretoOptimalModels
  }
}
