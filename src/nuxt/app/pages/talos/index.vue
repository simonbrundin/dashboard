<script setup lang="ts">
import type { TalosNode, TalosClusterStatus } from '~/server/api/talos/nodes.get'

interface TalosNodesResponse {
  nodes: TalosNode[]
  cluster: TalosClusterStatus
}

const { data, pending, refresh, error } = await useAsyncData<TalosNodesResponse>(
  'talos-nodes',
  () => $fetch('/api/talos/nodes'),
  {
    server: false,
    default: () => ({
      nodes: [],
      cluster: {
        name: 'cluster1',
        totalNodes: 0,
        controlPlanes: 0,
        workers: 0,
        readyNodes: 0,
      },
    }),
  },
)

// Refresh every 30 seconds
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)
const lastFetched = ref<Date>(new Date())
const isRefreshing = ref(false)

async function refreshNodes() {
  isRefreshing.value = true
  try {
    await refresh()
    lastFetched.value = new Date()
  } catch (err) {
    console.error('Failed to refresh Talos nodes:', err)
  } finally {
    isRefreshing.value = false
  }
}

onMounted(() => {
  refreshInterval.value = setInterval(refreshNodes, 30000)
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})

const filter = ref<'all' | 'controlplane' | 'worker'>('all')
const search = ref('')

const filteredNodes = computed(() => {
  if (!data.value?.nodes) return []

  let nodes = data.value.nodes

  // Filter by role
  if (filter.value !== 'all') {
    nodes = nodes.filter((n) => n.machineType === filter.value)
  }

  // Filter by search
  if (search.value) {
    const searchLower = search.value.toLowerCase()
    nodes = nodes.filter(
      (n) =>
        n.hostname.toLowerCase().includes(searchLower) ||
        n.ip.toLowerCase().includes(searchLower) ||
        n.id.toLowerCase().includes(searchLower),
    )
  }

  return nodes
})

const allHealthy = computed(() => {
  if (!data.value?.cluster) return false
  return data.value.cluster.readyNodes === data.value.cluster.totalNodes
})

// Cluster resource stats
const clusterStats = computed(() => {
  if (!data.value?.nodes) return null

  const onlineNodes = data.value.nodes.filter((n) => n.online && n.resources)
  if (onlineNodes.length === 0) return null

  const totalMemoryUsed = onlineNodes.reduce((sum, n) => sum + (n.resources?.memoryUsed || 0), 0)
  const totalMemoryTotal = onlineNodes.reduce((sum, n) => sum + (n.resources?.memoryTotal || 0), 0)
  const totalCpuCores = onlineNodes.reduce((sum, n) => sum + (n.resources?.cpuCores || 0), 0)

  return {
    totalMemoryUsed: Math.round(totalMemoryUsed * 10) / 10,
    totalMemoryTotal: Math.round(totalMemoryTotal * 10) / 10,
    memoryUsage: totalMemoryTotal > 0 ? Math.round((totalMemoryUsed / totalMemoryTotal) * 100) : 0,
    totalCpuCores,
  }
})

const timeSinceLastFetch = computed(() => {
  const seconds = Math.floor((Date.now() - lastFetched.value.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m`
})

const updateInterval = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  updateInterval.value = setInterval(() => {
    lastFetched.value = new Date(lastFetched.value.getTime())
  }, 1000)
})

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value)
  }
})
</script>

<template>
  <ClientOnly>
    <UDashboardPanel id="talos">
      <template #header>
        <UDashboardNavbar title="Talos">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #trailing>
            <div class="flex items-center gap-2">
              <template v-if="allHealthy">
                <UBadge color="success" variant="subtle">
                  <UIcon name="i-lucide-check-circle" class="size-3 mr-1" />
                  All nodes ready
                </UBadge>
              </template>
              <template v-else-if="error">
                <UBadge color="error" variant="subtle">
                  <UIcon name="i-lucide-alert-circle" class="size-3 mr-1" />
                  Connection error
                </UBadge>
              </template>
              <template v-else>
                <UBadge color="neutral" variant="subtle">
                  <UIcon name="i-lucide-clock" class="size-3 mr-1" />
                  {{ timeSinceLastFetch }}
                </UBadge>
              </template>

              <UButton
                variant="ghost"
                size="sm"
                square
                :loading="isRefreshing"
                @click="refreshNodes"
              >
                <UIcon name="i-lucide-refresh-cw" class="size-4" />
              </UButton>
            </div>
          </template>
        </UDashboardNavbar>

        <!-- Filters -->
        <div class="flex items-center gap-4 px-4 py-3 border-b border-default">
          <USelect
            v-model="filter"
            :items="[
              { label: 'All nodes', value: 'all' },
              { label: 'Control planes', value: 'controlplane' },
              { label: 'Workers', value: 'worker' },
            ]"
            class="w-40"
          />

          <UInput
            v-model="search"
            placeholder="Search nodes..."
            icon="i-lucide-search"
            class="flex-1 max-w-xs"
          />

          <!-- Cluster stats -->
          <div class="flex items-center gap-4 ml-auto text-sm">
            <div class="flex items-center gap-1">
              <UIcon name="i-lucide-server" class="size-4 text-muted" />
              <span class="text-muted">Total:</span>
              <span class="font-medium">{{ data?.cluster.totalNodes || 0 }}</span>
            </div>
            <div class="flex items-center gap-1">
              <UIcon name="i-lucide-shield" class="size-4 text-primary" />
              <span class="text-muted">CP:</span>
              <span class="font-medium">{{ data?.cluster.controlPlanes || 0 }}</span>
            </div>
            <div class="flex items-center gap-1">
              <UIcon name="i-lucide-box" class="size-4 text-secondary" />
              <span class="text-muted">Workers:</span>
              <span class="font-medium">{{ data?.cluster.workers || 0 }}</span>
            </div>
            <div class="flex items-center gap-1">
              <UIcon
                :name="allHealthy ? 'i-lucide-check-circle' : 'i-lucide-alert-triangle'"
                :class="allHealthy ? 'text-success' : 'text-warning'"
                class="size-4"
              />
              <span class="text-muted">Ready:</span>
              <span class="font-medium">{{ data?.cluster.readyNodes || 0 }}</span>
            </div>

            <!-- Resource stats -->
            <template v-if="clusterStats">
              <div class="flex items-center gap-1">
                <UIcon name="i-lucide-cpu" class="size-4 text-muted" />
                <span class="text-muted">CPU:</span>
                <span class="font-medium">{{ clusterStats.totalCpuCores }} cores</span>
              </div>
              <div class="flex items-center gap-1">
                <UIcon name="i-lucide-memory-stick" class="size-4 text-muted" />
                <span class="text-muted">RAM:</span>
                <span
                  class="font-medium"
                  :class="clusterStats.memoryUsage > 80 ? 'text-error' : clusterStats.memoryUsage > 60 ? 'text-warning' : ''"
                >
                  {{ clusterStats.totalMemoryUsed }}/{{ clusterStats.totalMemoryTotal }} GB
                </span>
              </div>
            </template>
          </div>
        </div>
      </template>

      <template #body>
        <!-- Loading state -->
        <div v-if="pending" class="flex items-center justify-center h-64">
          <UIcon name="i-lucide-loader" class="size-8 animate-spin text-primary" />
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="flex flex-col items-center justify-center h-64 gap-4">
          <UIcon name="i-lucide-alert-circle" class="size-12 text-error" />
          <p class="text-lg font-medium">Failed to connect to Talos cluster</p>
          <p class="text-muted">{{ error.message }}</p>
          <UButton @click="refreshNodes">
            <UIcon name="i-lucide-refresh-cw" class="size-4 mr-2" />
            Retry
          </UButton>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="filteredNodes.length === 0"
          class="flex flex-col items-center justify-center h-64 gap-4"
        >
          <UIcon name="i-lucide-server-off" class="size-12 text-muted" />
          <p class="text-lg font-medium">No nodes found</p>
          <p class="text-muted">
            {{ search ? 'Try adjusting your search' : 'No Talos nodes discovered' }}
          </p>
        </div>

        <!-- Nodes grid -->
        <div v-else class="p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TalosNodeCard
              v-for="node in filteredNodes"
              :key="node.id"
              :node="node"
              @reboot="refreshNodes"
              @shutdown="refreshNodes"
              @refresh="refreshNodes"
            />
          </div>
        </div>
      </template>
    </UDashboardPanel>
    <template #fallback>
      <div class="flex items-center justify-center h-screen">
        <UIcon name="i-lucide-loader" class="size-8 animate-spin text-primary" />
      </div>
    </template>
  </ClientOnly>
</template>
