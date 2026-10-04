<script setup lang="ts">
interface ClusterStats {
  totalNodes: number
  onlineNodes: number
  offlineNodes: number
  controlPlanes: number
  workers: number
  totalCpu: number
  totalMemory: number
}

const { data, pending, refresh } = await useAsyncData<{ nodes: any[] }>(
  'talos-nodes-overview',
  () => $fetch('/api/talos/nodes'),
  {
    server: false,
  },
)

const stats = computed<ClusterStats>(() => {
  const nodes = data.value?.nodes || []
  const online = nodes.filter((n: any) => n.online)
  const offline = nodes.filter((n: any) => !n.online)
  const cpus = nodes.filter((n: any) => n.machineType === 'controlplane')
  const workers = nodes.filter((n: any) => n.machineType === 'worker')

  return {
    totalNodes: nodes.length,
    onlineNodes: online.length,
    offlineNodes: offline.length,
    controlPlanes: cpus.length,
    workers: workers.length,
    totalCpu: online.reduce((sum: number, n: any) => sum + (n.resources?.cpuCores || 0), 0),
    totalMemory: online.reduce((sum: number, n: any) => sum + (n.resources?.memoryTotal || 0), 0),
  }
})

const healthPercent = computed(() => {
  if (stats.value.totalNodes === 0) return 100
  return Math.round((stats.value.onlineNodes / stats.value.totalNodes) * 100)
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-server" class="size-4" />
          <span class="font-medium">Talos Cluster</span>
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

    <div v-if="pending" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else class="space-y-4">
      <!-- Health indicator -->
      <div class="text-center">
        <div class="relative inline-flex items-center justify-center">
          <svg class="w-24 h-24 transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              stroke-width="8"
              fill="none"
              class="text-muted/20"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              stroke-width="8"
              fill="none"
              :class="stats.offlineNodes > 0 ? 'text-warning' : 'text-success'"
              :stroke-dasharray="`${healthPercent * 2.51} 251`"
              stroke-linecap="round"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <span class="text-2xl font-bold">{{ healthPercent }}%</span>
              <div class="text-xs text-muted">Healthy</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats grid -->
      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 rounded bg-muted/50 text-center">
          <div class="text-2xl font-bold">{{ stats.totalNodes }}</div>
          <div class="text-xs text-muted">Total Nodes</div>
        </div>
        <div class="p-3 rounded bg-muted/50 text-center">
          <div class="text-2xl font-bold text-success">{{ stats.onlineNodes }}</div>
          <div class="text-xs text-muted">Online</div>
        </div>
        <div class="p-3 rounded bg-muted/50 text-center">
          <div class="text-2xl font-bold text-primary">{{ stats.controlPlanes }}</div>
          <div class="text-xs text-muted">Control Planes</div>
        </div>
        <div class="p-3 rounded bg-muted/50 text-center">
          <div class="text-2xl font-bold text-secondary">{{ stats.workers }}</div>
          <div class="text-xs text-muted">Workers</div>
        </div>
      </div>

      <!-- Resources -->
      <div class="space-y-2 pt-2 border-t">
        <div class="flex items-center justify-between text-sm">
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-cpu" class="size-4" />
            CPU Cores
          </span>
          <span class="font-medium">{{ stats.totalCpu }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-memory-stick" class="size-4" />
            Total Memory
          </span>
          <span class="font-medium">{{ stats.totalMemory.toFixed(1) }} GB</span>
        </div>
      </div>

      <!-- Offline nodes warning -->
      <div v-if="stats.offlineNodes > 0" class="p-3 rounded bg-warning/10 text-warning text-sm">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-alert-triangle" class="size-4" />
          <span>{{ stats.offlineNodes }} node{{ stats.offlineNodes > 1 ? 's' : '' }} offline</span>
        </div>
      </div>

      <!-- View cluster link -->
      <UButton to="/talos/cluster" variant="secondary" block>
        View Cluster
        <template #trailing>
          <UIcon name="i-lucide-arrow-right" class="size-4" />
        </template>
      </UButton>
    </div>
  </UCard>
</template>
