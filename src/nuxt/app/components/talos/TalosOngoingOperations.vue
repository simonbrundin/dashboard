<script setup lang="ts">
interface Operation {
  id: string
  type: 'upgrade' | 'backup' | 'config' | 'drain' | 'other'
  status: 'in_progress' | 'completed' | 'failed' | 'pending'
  nodeName: string
  description: string
  startedAt: string
  completedAt?: string
  progress?: number
}

interface OperationsResponse {
  operations: Operation[]
  hasOngoing: boolean
}

const { data, pending, refresh } = await useAsyncData<OperationsResponse>(
  'talos-operations',
  () => $fetch('/api/talos/operations'),
  {
    server: false,
    default: () => ({
      operations: [],
      hasOngoing: false
    }),
  },
)

function getOperationIcon(type: string) {
  switch (type) {
    case 'upgrade': return 'i-lucide-arrow-up-circle'
    case 'backup': return 'i-lucide-save'
    case 'config': return 'i-lucide-settings'
    case 'drain': return 'i-lucide-eject'
    default: return 'i-lucide-activity'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'in_progress': return 'i-lucide-loader'
    case 'completed': return 'i-lucide-check-circle'
    case 'failed': return 'i-lucide-alert-circle'
    case 'pending': return 'i-lucide-clock'
    default: return 'i-lucide-help-circle'
  }
}

function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'in_progress': return 'warning'
    case 'completed': return 'success'
    case 'failed': return 'error'
    case 'pending': return 'neutral'
    default: return 'neutral'
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString()
}

// Auto-refresh every 10 seconds when there are ongoing operations
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)

watch(() => data.value?.hasOngoing, (hasOngoing) => {
  if (hasOngoing) {
    refreshInterval.value = setInterval(refresh, 10000)
  } else if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}, { immediate: true })

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-activity" class="size-4" />
          <span class="font-medium">Ongoing Operations</span>
        </div>
        <UButton
          variant="ghost"
          size="xs"
          square
          :loading="pending"
          @click="refresh"
        >
          <UIcon name="i-lucide-refresh-cw" class="size-4" />
        </UButton>
      </div>
    </template>

    <div v-if="pending && !data?.operations?.length" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else-if="!data?.operations?.length" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-check-circle" class="size-8 mb-2 mx-auto text-success" />
      <p>No ongoing operations</p>
      <p class="text-xs mt-1">All systems are operational</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="operation in data?.operations"
        :key="operation.id"
        class="p-3 rounded bg-muted/50 space-y-2"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon
              :name="getOperationIcon(operation.type)"
              class="size-4"
            />
            <span class="font-medium text-sm">{{ operation.description }}</span>
          </div>
          <UBadge :color="getStatusColor(operation.status)" variant="subtle" size="xs">
            {{ operation.status }}
          </UBadge>
        </div>

        <div class="flex items-center justify-between text-xs text-muted">
          <span>{{ operation.nodeName }}</span>
          <span>Started {{ formatTime(operation.startedAt) }}</span>
        </div>

        <UProgress
          v-if="operation.status === 'in_progress' && operation.progress !== undefined"
          :modelValue="operation.progress"
          :max="100"
          color="primary"
          size="sm"
        />
      </div>
    </div>
  </UCard>
</template>
