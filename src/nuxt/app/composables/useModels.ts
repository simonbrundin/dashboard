import type { ModelData } from '~/data/models'
import { getMeasuredTaskCost, getTaskCost, hasAnyCodingScore } from '~/utils/modelScoring'

export function useModels() {
  // State
  const modelsData = ref<ModelData[]>([])
  const metaData = ref<{ source: string; updatedAt: string; totalModels: number } | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed: models with known task cost. Zero is a valid free price.
  const modelsWithCost = computed(() =>
    modelsData.value.filter(model => getTaskCost(model) != null)
  )

  // Computed: models without task cost. Free models are not missing a price.
  const modelsWithoutCost = computed(() =>
    modelsData.value.filter(model => getTaskCost(model) == null)
  )

  const modelsWithMeasuredCost = computed(() =>
    modelsData.value.filter(model => getMeasuredTaskCost(model) != null)
  )

  const modelsWithCodingScore = computed(() =>
    modelsData.value.filter(hasAnyCodingScore)
  )

  // Proxy task costs (AA Intelligence Index cost) exist only for models with
  // an index - those are the only ones the price scraper can fill in.
  const hasProxyTaskCost = (model: ModelData): boolean =>
    model.aaIntelligenceCostPerTask != null || model.costPerTask != null

  const modelsWithProxyCost = computed(() =>
    modelsData.value.filter(hasProxyTaskCost)
  )

  const modelsWithoutProxyCost = computed(() =>
    modelsData.value.filter(model => model.intelligenceIndex != null && !hasProxyTaskCost(model))
  )

  const modelsWithEstimatedCost = computed(() =>
    modelsData.value.filter(model => model.estimatedCostPerTask != null)
  )

  const modelsWithoutPrices = computed(() =>
    modelsData.value.filter(model => model.inputPricePerM == null && model.outputPricePerM == null)
  )

  // Computed: total in database
  const totalInDb = computed(() => modelsData.value.length)

  // Fetch models from API
  async function fetchModels() {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{
        source: string
        updatedAt: string
        totalModels: number
        models: ModelData[]
      }>('/api/models')

      if (!Array.isArray(data.models)) {
        throw new Error('Invalid models response')
      }

      modelsData.value = data.models
      metaData.value = {
        source: data.source || 'artificialanalysis.ai',
        updatedAt: data.updatedAt,
        totalModels: data.totalModels
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load models'
      console.error('Failed to fetch models:', e)
    } finally {
      isLoading.value = false
    }
  }

  // Get stats from API
  async function getStats() {
    return await $fetch<{
      aaTotal: number
      dbTotal: number
      withPrices: number
      withMeasuredCodingCost: number
      withProxyCost: number
      needsImport: boolean
    }>('/api/models/stats')
  }

  return {
    modelsData,
    metaData,
    isLoading,
    error,
    modelsWithCost,
    modelsWithoutCost,
    modelsWithMeasuredCost,
    modelsWithCodingScore,
    modelsWithProxyCost,
    modelsWithoutProxyCost,
    modelsWithEstimatedCost,
    modelsWithoutPrices,
    totalInDb,
    fetchModels,
    getStats
  }
}
