<script setup lang="ts">
interface NodeCondition {
  type: string
  status: 'True' | 'False' | 'Unknown'
  reason: string
  message: string
  lastTransition: string
}

interface NodeConditionsResponse {
  nodes: {
    name: string
    conditions: NodeCondition[]
  }[]
}

const props = defineProps<{
  nodeName: string
}>()

const { data, pending, refresh } = await useAsyncData<NodeConditionsResponse>(
  `talos-node-conditions-${props.nodeName}`,
  () => $fetch('/api/talos/node-conditions'),
  {
    server: false,
    default: () => ({ nodes: [] }),
  },
)

const nodeConditions = computed(() => {
  const node = data.value?.nodes.find(n => n.name === props.nodeName)
  return node?.conditions || []
})

const isReady = computed(() => {
  const ready = nodeConditions.value.find(c => c.type === 'Ready')
  return ready?.status === 'True'
})

const hasIssues = computed(() => {
  // Check for real issues: Ready/NetworkReady/EtcdReady being False, or Pressure being True
  return nodeConditions.value.some(c => {
    // For Ready, NetworkReady, EtcdReady - False is bad
    if (['Ready', 'NetworkReady', 'EtcdReady'].includes(c.type)) {
      return c.status === 'False'
    }
    // For Pressure conditions - True is bad
    if (c.type.includes('Pressure')) {
      return c.status === 'True'
    }
    return false
  })
})

function getConditionIcon(type: string, status: string) {
  // Ready conditions: True = good, False = bad
  if (type === 'Ready' || type === 'NetworkReady' || type === 'EtcdReady') {
    if (status === 'True') return 'i-lucide-check-circle'
    if (status === 'False') return 'i-lucide-x-circle'
    return 'i-lucide-help-circle'
  }
  // Pressure conditions: False = good (no pressure), True = bad
  if (type.includes('Pressure')) {
    if (status === 'False') return 'i-lucide-check-circle'
    if (status === 'True') return 'i-lucide-alert-triangle'
    return 'i-lucide-help-circle'
  }
  return 'i-lucide-help-circle'
}

function getConditionColor(status: string, type: string) {
  // Ready conditions
  if (type === 'Ready' || type === 'NetworkReady' || type === 'EtcdReady') {
    if (status === 'True') return 'success'
    if (status === 'False') return 'error'
    return 'warning'
  }
  // Pressure conditions
  if (type.includes('Pressure')) {
    if (status === 'False') return 'success'
    if (status === 'True') return 'warning'
    return 'warning'
  }
  return 'neutral'
}

function formatConditionType(type: string): string {
  const labels: Record<string, string> = {
    'Ready': 'Ready',
    'MemoryPressure': 'Memory Pressure',
    'DiskPressure': 'Disk Pressure',
    'PIDPressure': 'PID Pressure',
    'NetworkReady': 'Network Ready',
    'EtcdReady': 'Etcd Member',
  }
  return labels[type] || type
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon
            :name="isReady ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
            :class="isReady ? 'text-success' : 'text-warning'"
            class="size-5"
          />
          <span class="font-medium">Node Conditions</span>
        </div>
        <UBadge
          :color="isReady ? 'success' : 'warning'"
          variant="subtle"
          size="sm"
        >
          {{ isReady ? 'Healthy' : 'Issues Detected' }}
        </UBadge>
      </div>
    </template>

    <div class="space-y-3">
      <div
        v-for="condition in nodeConditions"
        :key="condition.type"
        class="flex items-start gap-3 p-2 rounded-lg bg-muted/50"
      >
        <UIcon
          :name="getConditionIcon(condition.type, condition.status)"
          :class="{
            'text-success': getConditionColor(condition.status, condition.type) === 'success',
            'text-error': getConditionColor(condition.status, condition.type) === 'error',
            'text-warning': getConditionColor(condition.status, condition.type) === 'warning',
          }"
          class="size-5 mt-0.5 shrink-0"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm">{{ formatConditionType(condition.type) }}</span>
            <UBadge
              v-if="condition.status === 'True'"
              :color="getConditionColor(condition.status, condition.type)"
              variant="subtle"
              size="xs"
            >
              True
            </UBadge>
            <UBadge
              v-else-if="condition.status === 'False'"
              :color="getConditionColor(condition.status, condition.type)"
              variant="subtle"
              size="xs"
            >
              False
            </UBadge>
            <UBadge
              v-else
              color="warning"
              variant="subtle"
              size="xs"
            >
              Unknown
            </UBadge>
          </div>
          <p class="text-xs text-muted mt-0.5">
            {{ condition.reason }}
          </p>
          <p v-if="condition.message" class="text-xs text-muted mt-0.5 truncate">
            {{ condition.message }}
          </p>
        </div>
      </div>

      <div v-if="nodeConditions.length === 0" class="text-center py-4 text-muted">
        <UIcon name="i-lucide-info" class="size-8 mb-2" />
        <p>No condition data available</p>
      </div>
    </div>

    <template v-if="hasIssues" #footer>
      <div class="flex items-center gap-2 text-sm text-warning">
        <UIcon name="i-lucide-alert-triangle" class="size-4" />
        <span>Some conditions require attention</span>
      </div>
    </template>
  </UCard>
</template>
