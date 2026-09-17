export function useModelActions(
  models: Ref<ModelData[]>,
  progress: ReturnType<typeof useProgress>,
  onSuccess?: () => void
) {
  const error = ref<string | null>(null)
  const phase = ref<string>('')
  const statusMessage = ref<string>('')
  let abortController = new AbortController()

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
    phase.value = ''
    statusMessage.value = 'Startar...'
    progress.start(100)

    try {
      // Start the fetch-more process
      const response = await fetch('/api/models/fetch-more', { 
        method: 'POST',
        signal: abortController?.signal
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        // Process complete SSE messages
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              phase.value = data.phase
              statusMessage.value = data.message

              if (data.total > 0) {
                progress.update(data.progress, data.total)
              }

              if (data.phase === 'done' || data.success) {
                progress.stop()
                onSuccess?.()
                return
              }

              if (data.phase === 'error') {
                error.value = data.error || 'Misslyckades'
                progress.stop()
                return
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }

      progress.stop()
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return // Cancelled, not an error
      }
      console.error('Fetch error:', e)
      error.value = e.data?.message || e.message || 'Misslyckades'
      progress.stop()
    }
  }

  function cancelFetch() {
    abortController?.abort()
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
    phase,
    statusMessage,
    error,
    importModels,
    fetchMorePrices,
    refreshPrices,
    cancelFetch
  }
}
