import type { ModelData } from '~/data/models'
import {
  getCodingScore,
  getCodingValue,
  getMeasuredTaskCost
} from '~/utils/modelScoring'

function sortByValue(models: ModelData[]): ModelData[] {
  return [...models].sort((a, b) => {
    const aValue = getCodingValue(a) ?? -Infinity
    const bValue = getCodingValue(b) ?? -Infinity
    return bValue - aValue
  })
}

export function useModelStats(models: Ref<ModelData[]>) {
  const scoredModels = computed(() =>
    models.value.filter(model => getCodingScore(model) !== null)
  )

  const measuredCodingModels = computed(() =>
    scoredModels.value.filter(model => getMeasuredTaskCost(model) !== null)
  )

  const bestMeasuredCodingValueModels = computed(() =>
    sortByValue(measuredCodingModels.value).slice(0, 3)
  )

  const topCodingModels = computed(() =>
    [...scoredModels.value]
      .sort((a, b) => (getCodingScore(b) ?? -Infinity) - (getCodingScore(a) ?? -Infinity))
      .slice(0, 1)
  )

  const lowestMeasuredCostModels = computed(() =>
    [...measuredCodingModels.value]
      .sort((a, b) => (getMeasuredTaskCost(a) ?? Infinity) - (getMeasuredTaskCost(b) ?? Infinity))
      .slice(0, 1)
  )

  // Primary Pareto frontier: coding score and cost per successful task.
  const paretoOptimalModels = computed(() => {
    const candidates = measuredCodingModels.value
    const pareto: ModelData[] = []

    for (const model of candidates) {
      const modelCost = getMeasuredTaskCost(model) as number
      const modelCodingScore = getCodingScore(model) as number
      const isDominated = candidates.some(other => {
        const otherCost = getMeasuredTaskCost(other) as number
        const otherCodingScore = getCodingScore(other) as number
        return otherCost <= modelCost &&
          otherCodingScore >= modelCodingScore &&
          (otherCost < modelCost || otherCodingScore > modelCodingScore)
      })

      if (!isDominated) pareto.push(model)
    }

    return pareto
      .sort((a, b) => (getCodingScore(b) ?? -Infinity) - (getCodingScore(a) ?? -Infinity))
      .slice(0, 6)
  })

  return {
    bestMeasuredCodingValueModels,
    topCodingModels,
    lowestMeasuredCostModels,
    paretoOptimalModels
  }
}
