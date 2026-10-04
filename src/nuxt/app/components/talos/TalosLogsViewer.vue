<script setup lang="ts">
const props = defineProps<{
  nodeId: string
  service?: string
  autoRefresh?: boolean
}>()

const logs = ref<string[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const autoRefreshEnabled = ref(props.autoRefresh ?? false)
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)

async function loadLogs() {
  isLoading.value = true
  error.value = null
  
  try {
    let url = `/api/talos/logs/${props.nodeId}`
    if (props.service && props.service !== 'all') {
      url += `?service=${encodeURIComponent(props.service)}`
    }
    
    const response = await $fetch<{ logs: string[] }>(url)
    logs.value = response.logs || []
  } catch (e: unknown) {
    error.value = (e as { message?: string })?.message || 'Failed to load logs'
  } finally {
    isLoading.value = false
  }
}

function toggleAutoRefresh() {
  autoRefreshEnabled.value = !autoRefreshEnabled.value
  
  if (autoRefreshEnabled.value) {
    refreshInterval.value = setInterval(loadLogs, 5000)
  } else if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

function formatTimestamp(log: string): { time: string; message: string } {
  // Try to extract timestamp from log line
  const match = log.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*(.*)$/)
  if (match) {
    return {
      time: new Date(match[1]).toLocaleTimeString(),
      message: match[2]
    }
  }
  
  // Try common log formats
  const commonMatch = log.match(/^(\d{2}:\d{2}:\d{2})\s*(.*)$/)
  if (commonMatch) {
    return {
      time: commonMatch[1],
      message: commonMatch[2]
    }
  }
  
  return {
    time: '',
    message: log
  }
}

onMounted(() => {
  loadLogs()
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})

// Reload when service changes
watch(() => props.service, () => {
  loadLogs()
})
</script>

<template>
  <div class="talos-logs-viewer">
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-terminal" class="size-4" />
        <span class="text-sm font-medium">
          Logs{{ service && service !== 'all' ? ` - ${service}` : '' }}
        </span>
      </div>
      
      <div class="flex items-center gap-2">
        <UButton
          variant="ghost"
          size="xs"
          square
          :loading="isLoading"
          @click="loadLogs"
        >
          <UIcon name="i-lucide-refresh-cw" class="size-4" />
        </UButton>
        
        <UToggle
          v-model="autoRefreshEnabled"
          size="xs"
          @update:model-value="toggleAutoRefresh"
        />
        <span class="text-xs text-muted">Auto-refresh</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && logs.length === 0" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader" class="size-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-muted">Loading logs...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-3 rounded bg-error/10 text-error text-sm">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="logs.length === 0" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-file-text" class="size-8 mx-auto mb-2 opacity-50" />
      <p>No logs available</p>
    </div>

    <!-- Logs -->
    <div v-else class="logs-container">
      <div class="logs-scroll max-h-96 overflow-auto rounded border border-default bg-muted p-2 font-mono text-xs">
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="log-line py-0.5 hover:bg-muted/80"
        >
          <span class="log-time text-muted mr-2">{{ formatTimestamp(log).time }}</span>
          <span class="log-message whitespace-pre-wrap break-all">{{ formatTimestamp(log).message }}</span>
        </div>
      </div>
      
      <div class="mt-2 text-xs text-muted">
        {{ logs.length }} log entries
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-line {
  line-height: 1.4;
}

.log-time {
  flex-shrink: 0;
  min-width: 70px;
}
</style>
