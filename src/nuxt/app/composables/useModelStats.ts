import type { ModelData } from '~/data/models'

export function useModelStats(models: Ref<ModelData[]>) {
  // Best value models (top 3)
  const bestValueModels = computed(() => {
    return [...models.value]
      .filter(m => (m.costPerTask ?? 0) > 0)
      .sort((a, b) => {
        const aRatio = a.intelligenceIndex / (a.costPerTask ?? 1)
        const bRatio = b.intelligenceIndex / (b.costPerTask ?? 1)
        return bRatio - aRatio
      })
      .slice(0, 3)
  })

  // Top intelligence models
  const topIntelligenceModels = computed(() => {
    return [...models.value]
      .sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)
      .slice(0, 1)
  })

  // Lowest cost models
  const lowestCostModels = computed(() => {
    return [...models.value]
      .filter(m => (m.costPerTask ?? 0) > 0)
      .sort((a, b) =>
        (a.costPerTask ?? 0) - (b.costPerTask ?? 0)
      )
      .slice(0, 1)
  })

  // Pareto optimal models (best in each category)
  const paretoOptimalModels = computed(() => {
    const pareto: ModelData[] = []

    for (const model of models.value) {
      const modelCost = model.costPerTask ?? 0
      const isDominated = models.value.some(other => {
        const otherCost = other.costPerTask ?? 0
        return otherCost <= modelCost &&
               other.intelligenceIndex >= model.intelligenceIndex &&
               (otherCost < modelCost || other.intelligenceIndex > model.intelligenceIndex)
      })
      if (!isDominated) {
        pareto.push(model)
      }
    }

    return pareto
      .sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)
      .slice(0, 6)
  })

  return {
    bestValueModels,
    topIntelligenceModels,
    lowestCostModels,
    paretoOptimalModels
  }
}
