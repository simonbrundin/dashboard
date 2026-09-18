import type { ModelData } from '~/data/models'

interface ProgressEvent {
  phase: string
  message: string
  progress: number
  total: number
  success?: boolean
  error?: string
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const details = error as { data?: { message?: string }; message?: string }
    return details.data?.message || details.message || fallback
  }

  return fallback
}

function parseSseLine(line: string): ProgressEvent | null {
  if (!line.startsWith('data: ')) return null
  try {
    return JSON.parse(line.slice(6))
  } catch {
    return null // partial JSON at chunk boundary
  }
}

async function* readSseEvents(response: Response): AsyncGenerator<ProgressEvent> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const event = parseSseLine(line)
      if (event) yield event
    }
  }
}

export function useModelActions(
  models: Ref<ModelData[]>,
  progress: ReturnType<typeof useProgress>,
  onSuccess?: () => void
) {
  const error = ref<string | null>(null)
  const statusMessage = ref<string>('')

  function handleProgressEvent(event: ProgressEvent): boolean {
    statusMessage.value = event.message

    if (event.total > 0) {
      progress.update(event.progress, event.total)
    }

    if (event.phase === 'error') {
      error.value = event.error || 'Misslyckades'
      return true
    }

    if (event.phase === 'done' || event.success) {
      onSuccess?.()
      return true
    }

    return false
  }

  async function importModels() {
    error.value = null
    try {
      const result = await $fetch<{ success: boolean; total: number }>('/api/models/import', { method: 'POST' })
      if (result.success) {
        onSuccess?.()
      }
    } catch (e: unknown) {
      error.value = extractErrorMessage(e, 'Import failed')
    }
  }

  async function fetchMorePrices() {
    error.value = null
    statusMessage.value = 'Startar...'
    progress.start(100)

    try {
      const response = await fetch('/api/models/fetch-more', { method: 'POST' })
      if (!response.ok) {
        throw new Error(`Failed to fetch model prices (${response.status})`)
      }

      for await (const event of readSseEvents(response)) {
        if (handleProgressEvent(event)) return
      }
    } catch (e: unknown) {
      error.value = extractErrorMessage(e, 'Misslyckades')
    } finally {
      progress.stop()
    }
  }

  async function refreshPrices() {
    error.value = null
    try {
      progress.start(models.value.length)

      const result = await $fetch<{ success: boolean; updated: number }>('/api/models/refresh-prices', { method: 'POST' })
      if (result.success) {
        onSuccess?.()
      }
    } catch (e: unknown) {
      error.value = extractErrorMessage(e, 'Failed to refresh')
    } finally {
      progress.stop()
    }
  }

  return {
    progress,
    statusMessage,
    error,
    importModels,
    fetchMorePrices,
    refreshPrices
  }
}
