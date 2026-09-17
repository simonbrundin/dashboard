export function useModelActions(
  models: Ref<ModelData[]>,
  onSuccess?: () => void
) {
  const progress = useProgress()
  const error = ref<string | null>(null)

  async function importModels() {
    error.value = null
    progress.start(0)
    try {
      const result = await $fetch<{ success: boolean; total: number }>('/api/models/import', { method: 'POST' })
      if (result.success) {
        progress.stop()
        onSuccess?.()
      }
    } catch (e: any) {
      error.value = e.data?.message || e.message || 'Import failed'
      progress.stop()
    }
  }

  async function fetchMorePrices() {
    error.value = null
    try {
      const stats = await $fetch<{ needsPrices: boolean }>('/api/models/stats')
      progress.start(stats.needsPrices ? 100 : 0)

      const result = await $fetch<{ success: boolean; totalWithPrices: number }>('/api/models/fetch-more', { method: 'POST' })
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
