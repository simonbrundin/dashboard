import type { ModelData } from '~/data/models'

export function useModels() {
  // State
  const modelsData = ref<ModelData[]>([])
  const metaData = ref<{ source: string; updatedAt: string; totalModels: number } | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed: models with price data
  const modelsWithCost = computed(() =>
    modelsData.value.filter(m => m.costPerTask != null && m.costPerTask > 0)
  )

  // Computed: models without price data
  const modelsWithoutCost = computed(() =>
    modelsData.value.filter(m => !m.costPerTask || m.costPerTask <= 0)
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
    totalInDb,
    fetchModels,
    getStats
  }
}
