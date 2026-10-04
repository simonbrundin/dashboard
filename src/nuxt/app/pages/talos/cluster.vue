<script setup lang="ts">
import type { TalosNode, TalosClusterStatus } from '~/server/api/talos/nodes.get'

interface TalosNodesResponse {
  nodes: TalosNode[]
  cluster: TalosClusterStatus
}

const { data, pending, refresh, error } = await useAsyncData<TalosNodesResponse>(
  'talos-cluster',
  () => $fetch('/api/talos/nodes'),
  {
    server: false,
  },
)

const allNodes = computed(() => data.value?.nodes || [])
const cluster = computed(() => data.value?.cluster)

const onlineNodes = computed(() => allNodes.value.filter(n => n.online))
const offlineNodes = computed(() => allNodes.value.filter(n => !n.online))

const controlPlanes = computed(() => allNodes.value.filter(n => n.machineType === 'controlplane'))
const workers = computed(() => allNodes.value.filter(n => n.machineType === 'worker'))

const clusterStats = computed(() => {
  const online = onlineNodes.value
  if (online.length === 0) return null

  const totalMemory = online.reduce((sum, n) => sum + (n.resources?.memoryTotal || 0), 0)
  const usedMemory = online.reduce((sum, n) => sum + (n.resources?.memoryUsed || 0), 0)
  const totalCpuCores = online.reduce((sum, n) => sum + (n.resources?.cpuCores || 0), 0)

  return {
    totalMemory: Math.round(totalMemory * 10) / 10,
    usedMemory: Math.round(usedMemory * 10) / 10,
    memoryUsage: Math.round((usedMemory / totalMemory) * 100) || 0,
    totalCpuCores,
  }
})

const allHealthy = computed(() => {
  if (!cluster.value) return false
  return cluster.value.readyNodes === cluster.value.totalNodes
})

const isRefreshing = ref(false)

async function refreshData() {
  isRefreshing.value = true
  try {
    await refresh()
  } finally {
    isRefreshing.value = false
  }
}

// Refresh every 30 seconds
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  refreshInterval.value = setInterval(refreshData, 30000)
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<template>
  <ClientOnly>
    <UDashboardPanel id="talos-cluster">
      <template #header>
        <UDashboardNavbar title="Cluster Overview">
          <template #leading>
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-arrow-left"
              to="/talos"
            />
          </template>
          <template #trailing>
            <UButton
              variant="ghost"
              size="sm"
              square
              :loading="isRefreshing"
              @click="refreshData"
            >
              <UIcon name="i-lucide-refresh-cw" class="size-4" />
            </UButton>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <!-- Loading -->
        <div v-if="pending" class="flex items-center justify-center h-64">
          <UIcon name="i-lucide-loader" class="size-8 animate-spin text-primary" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="flex flex-col items-center justify-center h-64 gap-4">
          <UIcon name="i-lucide-alert-circle" class="size-12 text-error" />
          <p class="text-lg font-medium">Failed to load cluster data</p>
          <p class="text-muted">{{ error.message }}</p>
          <UButton @click="refreshData">
            <UIcon name="i-lucide-refresh-cw" class="size-4 mr-2" />
            Retry
          </UButton>
        </div>

        <!-- Content -->
        <div v-else-if="cluster" class="p-4 space-y-6">
          <!-- Cluster Status Banner -->
          <div
            class="flex items-center justify-between p-4 rounded-lg border"
            :class="allHealthy ? 'bg-success/10 border-success/20' : 'bg-warning/10 border-warning/20'"
          >
            <div class="flex items-center gap-3">
              <UIcon
                :name="allHealthy ? 'i-lucide-check-circle' : 'i-lucide-alert-triangle'"
                :class="allHealthy ? 'text-success size-8' : 'text-warning size-8'"
              />
              <div>
                <h2 class="text-lg font-medium">
                  {{ allHealthy ? 'Cluster Healthy' : 'Cluster Issues Detected' }}
                </h2>
                <p class="text-sm text-muted">
                  {{ cluster.readyNodes }} of {{ cluster.totalNodes }} nodes ready
                </p>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="text-right">
                <div class="text-2xl font-bold">{{ cluster.totalNodes }}</div>
                <div class="text-xs text-muted">Total Nodes</div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-bold">{{ cluster.controlPlanes }}</div>
                <div class="text-xs text-muted">Control Planes</div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-bold">{{ cluster.workers }}</div>
                <div class="text-xs text-muted">Workers</div>
              </div>
            </div>
          </div>

          <!-- Upgrade Status -->
          <TalosUpgradeStatus />

          <!-- Upgrade Panel (Talos & Kubernetes) -->
          <TalosUpgradePanel />

          <!-- Ongoing Operations -->
          <TalosOngoingOperations />

          <!-- etcd Backups -->
          <TalosEtcdBackups />

          <!-- Cluster Manifests Status -->
          <TalosClusterManifests />

          <!-- Resource Overview -->
          <div v-if="clusterStats" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-cpu" class="size-4" />
                  <span class="text-sm font-medium">CPU Resources</span>
                </div>
              </template>
              <div class="text-center py-4">
                <div class="text-3xl font-bold">{{ clusterStats.totalCpuCores }}</div>
                <div class="text-sm text-muted">Total Cores</div>
              </div>
            </UCard>
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-memory-stick" class="size-4" />
                  <span class="text-sm font-medium">Memory Resources</span>
                </div>
              </template>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-muted">Total</span>
                  <span class="font-medium">{{ clusterStats.totalMemory }} GB</span>
                </div>
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-muted">Usage</span>
                    <span>{{ clusterStats.memoryUsage }}% ({{ clusterStats.usedMemory }} GB)</span>
                  </div>
                  <UProgress
                    :modelValue="clusterStats.memoryUsage"
                    :max="100"
                    :color="clusterStats.memoryUsage > 80 ? 'error' : clusterStats.memoryUsage > 60 ? 'warning' : 'primary'"
                    size="sm"
                  />
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-server" class="size-4" />
                  <span class="text-sm font-medium">Node Status</span>
                </div>
              </template>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-muted">Online</span>
                  <UBadge color="success" variant="subtle" size="sm">
                    {{ onlineNodes.length }}
                  </UBadge>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted">Offline</span>
                  <UBadge v-if="offlineNodes.length > 0" color="error" variant="subtle" size="sm">
                    {{ offlineNodes.length }}
                  </UBadge>
                  <UBadge v-else color="neutral" variant="subtle" size="sm">
                    0
                  </UBadge>
                </div>
              </div>
            </UCard>
          </div>

          <!-- Node Groups -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Control Planes -->
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-shield" class="size-4 text-primary" />
                  <span class="font-medium">Control Planes ({{ controlPlanes.length }})</span>
                </div>
              </template>

              <div class="space-y-3">
                <div
                  v-for="node in controlPlanes"
                  :key="node.id"
                  class="flex items-center justify-between p-3 rounded-lg bg-naturals-n2 hover:bg-naturals-n3 transition-colors"
                >
                  <div class="flex items-center gap-3">
                    <UIcon
                      :name="node.online ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                      :class="node.online ? 'text-success' : 'text-error'"
                      class="size-5"
                    />
                    <div>
                      <NuxtLink
                        :to="`/talos/${node.id}`"
                        class="font-medium hover:text-primary"
                      >
                        {{ node.hostname }}
                      </NuxtLink>
                      <p class="text-xs text-muted">{{ node.ip }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <UBadge
                      :color="node.online ? 'success' : 'error'"
                      variant="subtle"
                      size="sm"
                    >
                      {{ node.online ? 'Online' : 'Offline' }}
                    </UBadge>
                    <UBadge
                      v-if="node.etcdHealth"
                      :color="node.etcdHealth.healthy ? 'success' : 'error'"
                      variant="subtle"
                      size="sm"
                    >
                      etcd {{ node.etcdHealth.healthy ? 'OK' : 'Error' }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </UCard>

            <!-- Workers -->
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-box" class="size-4 text-secondary" />
                  <span class="font-medium">Workers ({{ workers.length }})</span>
                </div>
              </template>

              <div class="space-y-3">
                <div
                  v-for="node in workers"
                  :key="node.id"
                  class="flex items-center justify-between p-3 rounded-lg bg-naturals-n2 hover:bg-naturals-n3 transition-colors"
                >
                  <div class="flex items-center gap-3">
                    <UIcon
                      :name="node.online ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                      :class="node.online ? 'text-success' : 'text-error'"
                      class="size-5"
                    />
                    <div>
                      <NuxtLink
                        :to="`/talos/${node.id}`"
                        class="font-medium hover:text-primary"
                      >
                        {{ node.hostname }}
                      </NuxtLink>
                      <p class="text-xs text-muted">{{ node.ip }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <UBadge
                      :color="node.online ? 'success' : 'error'"
                      variant="subtle"
                      size="sm"
                    >
                      {{ node.online ? 'Online' : 'Offline' }}
                    </UBadge>
                    <NuxtLink :to="`/talos/${node.id}`">
                      <UButton variant="ghost" size="xs" icon="i-lucide-external-link" />
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </UCard>
          </div>

          <!-- Offline Nodes Warning -->
          <UCard v-if="offlineNodes.length > 0" class="border-error/20">
            <template #header>
              <div class="flex items-center gap-2 text-error">
                <UIcon name="i-lucide-alert-triangle" class="size-4" />
                <span class="font-medium">Offline Nodes ({{ offlineNodes.length }})</span>
              </div>
            </template>

            <div class="space-y-2">
              <div
                v-for="node in offlineNodes"
                :key="node.id"
                class="flex items-center justify-between p-2 rounded bg-error/5"
              >
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-x-circle" class="text-error size-4" />
                  <span>{{ node.hostname }}</span>
                  <span class="text-xs text-muted">({{ node.ip }})</span>
                </div>
                <NuxtLink :to="`/talos/${node.id}`">
                  <UButton variant="ghost" size="xs">View Details</UButton>
                </NuxtLink>
              </div>
            </div>
          </UCard>
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
