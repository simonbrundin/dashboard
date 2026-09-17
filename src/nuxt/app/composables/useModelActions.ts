export function useModelActions(
  models: Ref<ModelData[]>,
  progress: ReturnType<typeof useProgress>,
  onSuccess?: () => void
) {
  const error = ref<string | null>(null)

  async function importModels() {
    error.value = null
    try {
      const result = await $fetch<{ success: boolean; total: number }>('/api/models/import', { method: 'POST' })
      if (result.success) {
        onSuccess?.()
      }
    } catch (e: any) {
      error.value = e.data?.message || e.message || 'Import failed'
    }
  }

  async function fetchMorePrices() {
    error.value = null
    try {
      const stats = await $fetch<{ needsPrices: number }>('/api/models/stats')
      const total = stats.needsPrices
      progress.start(total)

      const result = await $fetch<{ success: boolean; pricesAdded: number }>('/api/models/fetch-more', { method: 'POST' })
      if (result.success) {
        progress.stop()
        onSuccess?.()
      }
    } catch (e: any) {
      error.value = e.data?.message || e.message || 'Failed to fetch more'
      progress.stop()
    }
  }

  async function refreshPrices() {
    error.value = null
    try {
      const count = models.value.length
      progress.start(count)

      const result = await $fetch<{ success: boolean; updated: number }>('/api/models/refresh-prices', { method: 'POST' })
      if (result.success) {
        progress.stop()
        onSuccess?.()
      }
    } catch (e: any) {
      error.value = e.data?.message || e.message || 'Failed to refresh'
      progress.stop()
    }
  }

  return {
    progress,
    error,
    importModels,
    fetchMorePrices,
    refreshPrices
  }
}
