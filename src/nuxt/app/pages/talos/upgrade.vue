<script setup lang="ts">
import type { TalosNode, TalosClusterStatus } from '~/server/api/talos/nodes.get'

interface TalosNodesResponse {
  nodes: TalosNode[]
  cluster: TalosClusterStatus
}

const { data, pending, refresh, error } = await useAsyncData<TalosNodesResponse>(
  'talos-nodes-upgrade',
  () => $fetch('/api/talos/nodes'),
  {
    server: false,
  },
)

interface UpgradeStatus {
  talos: {
    current: string
    latest: string
    canUpgrade: boolean
    upgradeAvailable: boolean
  }
  kubernetes: {
    current: string
    available: string[]
  }
}

const { data: upgradeStatus, refresh: refreshUpgradeStatus } = await useFetch<UpgradeStatus>('/api/talos/available-versions')

const selectedTalosVersion = ref('v1.14.1')
const selectedK8sVersion = ref('v1.35.0')
const isUpgrading = ref(false)
const upgradeMessage = ref('')
const showConfirmTalos = ref(false)
const showConfirmK8s = ref(false)

const talosVersions = [
  { label: 'v1.14.1 (latest)', value: 'v1.14.1' },
  { label: 'v1.14.0 (current)', value: 'v1.14.0' },
  { label: 'v1.13.2', value: 'v1.13.2' },
  { label: 'v1.13.1', value: 'v1.13.1' },
]

const k8sVersions = [
  { label: 'v1.35.0 (latest)', value: 'v1.35.0' },
  { label: 'v1.34.1', value: 'v1.34.1' },
  { label: 'v1.33.0', value: 'v1.33.0' },
  { label: 'v1.32.2', value: 'v1.32.2' },
]

const allNodes = computed(() => data.value?.nodes || [])
const onlineNodes = computed(() => allNodes.value.filter(n => n.online))
const offlineNodes = computed(() => allNodes.value.filter(n => !n.online))

const talosUpgradeAvailable = computed(() => {
  if (!upgradeStatus.value?.talos) return false
  return upgradeStatus.value.talos.current !== upgradeStatus.value.talos.latest
})

const talosUpgradeAction = computed(() => {
  if (!upgradeStatus.value?.talos) return 'Upgrade'
  const current = upgradeStatus.value.talos.current
  const latest = upgradeStatus.value.talos.latest
  const [cMajor, cMinor] = current.split('.').map(Number)
  const [lMajor, lMinor] = latest.split('.').map(Number)
  if (lMajor > cMajor || lMinor > cMinor) return 'Upgrade'
  if (lMajor < cMajor || lMinor < cMinor) return 'Downgrade'
  return 'Unchanged'
})

async function performUpgrade(type: 'talos' | 'kubernetes', version: string) {
  isUpgrading.value = true
  upgradeMessage.value = ''

  try {
    const action = type === 'talos' ? 'upgrade-talos' : 'upgrade-kubernetes'
    const response = await $fetch('/api/talos/upgrade', {
      method: 'POST',
      body: {
        action,
        version: type === 'talos' ? selectedTalosVersion.value : selectedK8sVersion.value
      }
    })

    upgradeMessage.value = response.message || `${type} upgrade initiated`
    await refreshUpgradeStatus()
  } catch (error: any) {
    upgradeMessage.value = `Error: ${error.data?.message || error.message}`
  } finally {
    isUpgrading.value = false
    showConfirmTalos.value = false
    showConfirmK8s.value = false
  }
}

async function cancelUpgrade() {
  try {
    const response = await $fetch('/api/talos/upgrade', {
      method: 'POST',
      body: { action: 'cancel-upgrade' }
    })
    upgradeMessage.value = response.message || 'Upgrade cancelled'
    await refreshUpgradeStatus()
  } catch (error: any) {
    upgradeMessage.value = `Error: ${error.data?.message || error.message}`
  }
}

const isRefreshing = ref(false)

async function refreshData() {
  isRefreshing.value = true
  try {
    await refresh()
    await refreshUpgradeStatus()
  } finally {
    isRefreshing.value = false
  }
}

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
    <UDashboardPanel id="talos-upgrade">
      <template #header>
        <UDashboardNavbar title="Upgrade Cluster">
          <template #leading>
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-arrow-left"
              to="/talos/cluster"
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
        <div class="p-6 space-y-6">
          <!-- Header -->
          <div class="flex items-center gap-4">
            <div class="p-3 rounded-lg bg-primary/10">
              <UIcon name="i-lucide-upload" class="size-8 text-primary" />
            </div>
            <div>
              <h1 class="text-2xl font-bold">Upgrade Cluster</h1>
              <p class="text-muted">Safely upgrade Talos and Kubernetes versions</p>
            </div>
          </div>

          <!-- Cluster Status Summary -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-info" class="size-4" />
                <span class="font-medium">Cluster Status</span>
              </div>
            </template>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="text-center p-3 rounded-lg bg-naturals-n2">
                <div class="text-2xl font-bold">{{ allNodes.length }}</div>
                <div class="text-xs text-muted">Total Nodes</div>
              </div>
              <div class="text-center p-3 rounded-lg bg-naturals-n2">
                <div class="text-2xl font-bold text-success">{{ onlineNodes.length }}</div>
                <div class="text-xs text-muted">Online</div>
              </div>
              <div class="text-center p-3 rounded-lg bg-naturals-n2">
                <div class="text-2xl font-bold text-error">{{ offlineNodes.length }}</div>
                <div class="text-xs text-muted">Offline</div>
              </div>
              <div class="text-center p-3 rounded-lg bg-naturals-n2">
                <div class="text-2xl font-bold text-primary">{{ upgradeStatus?.talos?.current || '...' }}</div>
                <div class="text-xs text-muted">Talos Version</div>
              </div>
            </div>
          </UCard>

          <!-- Messages -->
          <div v-if="upgradeMessage" 
               class="rounded-lg p-4"
               :class="upgradeMessage.includes('Error') ? 'bg-error/10 border border-error/20' : 'bg-primary/10 border border-primary/20'">
            <p class="text-sm" :class="upgradeMessage.includes('Error') ? 'text-error' : 'text-primary'">
              {{ upgradeMessage }}
            </p>
          </div>

          <!-- Talos Upgrade -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-server" class="size-5 text-primary" />
                  <span class="font-semibold">Talos Upgrade</span>
                </div>
                <UBadge v-if="talosUpgradeAvailable" color="green" variant="subtle">
                  Upgrade Available
                </UBadge>
                <UBadge v-else color="gray" variant="subtle">
                  Up to Date
                </UBadge>
              </div>
            </template>

            <div class="space-y-4">
              <div class="flex items-center justify-between p-4 rounded-lg bg-naturals-n2">
                <div>
                  <div class="text-sm text-muted">Current Version</div>
                  <div class="text-xl font-bold">v{{ upgradeStatus?.talos?.current || '...' }}</div>
                </div>
                <UIcon name="i-lucide-arrow-right" class="size-6 text-muted" />
                <div class="text-right">
                  <div class="text-sm text-muted">Target Version</div>
                  <div class="text-xl font-bold text-success">v{{ upgradeStatus?.talos?.latest }}</div>
                </div>
              </div>

              <div v-if="isUpgrading" class="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <div class="flex items-center gap-3">
                  <UIcon name="i-lucide-loader" class="size-5 animate-spin text-warning" />
                  <div>
                    <div class="font-medium">Upgrade in Progress</div>
                    <div class="text-sm text-muted">Please wait while the upgrade completes...</div>
                  </div>
                </div>
              </div>

              <div v-else class="space-y-3">
                <div>
                  <label class="text-sm font-medium mb-2 block">Select Version</label>
                  <USelect
                    v-model="selectedTalosVersion"
                    :items="talosVersions"
                    class="w-full"
                  />
                </div>

                <div v-if="!showConfirmTalos" class="flex gap-2">
                  <UButton
                    :disabled="!talosUpgradeAvailable"
                    color="primary"
                    @click="showConfirmTalos = true"
                  >
                    {{ talosUpgradeAction }} Talos
                  </UButton>
                  <UButton
                    variant="outline"
                    to="/talos/cluster"
                  >
                    Cancel
                  </UButton>
                </div>

                <div v-else class="p-4 rounded-lg bg-warning/10 border border-warning/20 space-y-3">
                  <div class="flex items-start gap-3">
                    <UIcon name="i-lucide-alert-triangle" class="size-5 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p class="font-medium">Confirm Upgrade</p>
                      <p class="text-sm text-muted">
                        This will upgrade Talos to {{ selectedTalosVersion }}. 
                        Nodes are upgraded sequentially. Control plane may experience brief downtime.
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <UButton color="red" @click="performUpgrade('talos', selectedTalosVersion)">
                      Confirm Upgrade
                    </UButton>
                    <UButton color="gray" variant="outline" @click="showConfirmTalos = false">
                      Cancel
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Kubernetes Upgrade -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-box" class="size-5 text-secondary" />
                <span class="font-semibold">Kubernetes Upgrade</span>
              </div>
            </template>

            <div class="space-y-4">
              <div class="flex items-center justify-between p-4 rounded-lg bg-naturals-n2">
                <div>
                  <div class="text-sm text-muted">Current Version</div>
                  <div class="text-xl font-bold">{{ upgradeStatus?.kubernetes?.current || 'v1.35.2' }}</div>
                </div>
                <UIcon name="i-lucide-arrow-right" class="size-6 text-muted" />
                <div class="text-right">
                  <div class="text-sm text-muted">Target Version</div>
                  <div class="text-xl font-bold text-success">v1.35.0</div>
                </div>
              </div>

              <div v-if="isUpgrading" class="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <div class="flex items-center gap-3">
                  <UIcon name="i-lucide-loader" class="size-5 animate-spin text-warning" />
                  <div>
                    <div class="font-medium">Kubernetes Upgrade in Progress</div>
                    <div class="text-sm text-muted">Control plane is being upgraded first...</div>
                  </div>
                </div>
              </div>

              <div v-else class="space-y-3">
                <div>
                  <label class="text-sm font-medium mb-2 block">Select Version</label>
                  <USelect
                    v-model="selectedK8sVersion"
                    :items="k8sVersions"
                    class="w-full"
                  />
                </div>

                <div v-if="!showConfirmK8s">
                  <UButton
                    color="primary"
                    @click="showConfirmK8s = true"
                  >
                    Upgrade Kubernetes
                  </UButton>
                </div>

                <div v-else class="p-4 rounded-lg bg-warning/10 border border-warning/20 space-y-3">
                  <div class="flex items-start gap-3">
                    <UIcon name="i-lucide-alert-triangle" class="size-5 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p class="font-medium">Confirm Kubernetes Upgrade</p>
                      <p class="text-sm text-muted">
                        This will upgrade Kubernetes to {{ selectedK8sVersion }}.
                        Control plane is upgraded first, then workers. 
                        You cannot skip minor versions.
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <UButton color="red" @click="performUpgrade('kubernetes', selectedK8sVersion)">
                      Confirm Upgrade
                    </UButton>
                    <UButton color="gray" variant="outline" @click="showConfirmK8s = false">
                      Cancel
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Cancel Upgrade Section -->
          <UCard v-if="isUpgrading" class="border-error/30 bg-error/5">
            <template #header>
              <div class="flex items-center gap-2 text-error">
                <UIcon name="i-lucide-alert-circle" class="size-4" />
                <span class="font-medium">Emergency Stop</span>
              </div>
            </template>

            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted">
                  If something goes wrong during the upgrade, you can cancel it.
                  Note: This may leave the cluster in an inconsistent state.
                </p>
              </div>
              <UButton color="error" variant="outline" @click="cancelUpgrade">
                Cancel Upgrade
              </UButton>
            </div>
          </UCard>

          <!-- Info Card -->
          <UCard class="border-primary/20 bg-primary/5">
            <template #header>
              <div class="flex items-center gap-2 text-primary">
                <UIcon name="i-lucide-lightbulb" class="size-4" />
                <span class="font-medium">Upgrade Information</span>
              </div>
            </template>
            <ul class="space-y-2 text-sm text-muted">
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-check" class="size-4 text-success shrink-0 mt-0.5" />
                Talos upgrades are performed sequentially to maintain cluster availability
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-check" class="size-4 text-success shrink-0 mt-0.5" />
                Control plane nodes are upgraded first, then worker nodes
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-check" class="size-4 text-success shrink-0 mt-0.5" />
                Kubernetes upgrades require compatible Talos version
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-check" class="size-4 text-success shrink-0 mt-0.5" />
                You can monitor the upgrade progress in the Ongoing Operations panel
              </li>
            </ul>
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
