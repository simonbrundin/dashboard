<script setup lang="ts">
import type { TalosNodeDetail } from '~/server/api/talos/node/[name].get'

const route = useRoute()
const nodeId = computed(() => route.params.id as string)

const { data, pending, refresh, error } = await useAsyncData<TalosNodeDetail>(
  `talos-node-${nodeId.value}`,
  () => $fetch(`/api/talos/node/${nodeId.value}`),
  {
    server: false,
  },
)

const isPerformingAction = ref(false)
const actionError = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)

const services = computed(() => data.value?.services || [])

const filteredServices = computed(() => {
  if (selectedService.value === 'all') return services.value
  return services.value.filter((s) => s.name === selectedService.value)
})

const isOnline = computed(() => data.value?.phase === 'running')

const phaseColor = computed(() => {
  switch (data.value?.phase) {
    case 'running':
      return 'success'
    case 'booting':
    case 'installing':
      return 'warning'
    case 'shutting_down':
    case 'resetting':
      return 'error'
    default:
      return 'neutral'
  }
})

const roleColor = computed(() => {
  return data.value?.machineType === 'controlplane' ? 'primary' : 'secondary'
})

async function handleReboot() {
  if (!confirm(`Reboot ${data.value?.hostname}?`)) return

  isPerformingAction.value = true
  actionError.value = null
  actionSuccess.value = null

  try {
    await $fetch(`/api/talos/reboot/${nodeId.value}`, { method: 'POST' })
    actionSuccess.value = 'Reboot initiated'
    setTimeout(() => refresh(), 2000)
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to reboot'
  } finally {
    isPerformingAction.value = false
  }
}

async function handleShutdown() {
  if (!confirm(`Shutdown ${data.value?.hostname}? This will power off the node.`)) return

  isPerformingAction.value = true
  actionError.value = null
  actionSuccess.value = null

  try {
    await $fetch(`/api/talos/shutdown/${nodeId.value}`, { method: 'POST' })
    actionSuccess.value = 'Shutdown initiated'
    setTimeout(() => refresh(), 2000)
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to shutdown'
  } finally {
    isPerformingAction.value = false
  }
}
</script>

<template>
  <ClientOnly>
    <UDashboardPanel id="talos-node-detail">
      <template #header>
        <UDashboardNavbar>
          <template #leading>
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-arrow-left"
              to="/talos"
            />
          </template>
          <template #title>
            <div class="flex items-center gap-3">
              <span>{{ data?.hostname || 'Loading...' }}</span>
              <UBadge
                v-if="data"
                :color="roleColor"
                variant="subtle"
                size="sm"
              >
                {{ data.machineType }}
              </UBadge>
              <UBadge
                v-if="data"
                :color="phaseColor"
                variant="subtle"
                size="sm"
              >
                {{ data.phase }}
              </UBadge>
            </div>
          </template>
          <template #trailing>
            <div class="flex items-center gap-2">
              <UButton
                v-if="data"
                variant="ghost"
                size="sm"
                icon="i-lucide-refresh-cw"
                :loading="pending"
                @click="refresh"
              />
              <UButton
                variant="secondary"
                size="sm"
                icon="i-lucide-rotate-cw"
                :loading="isPerformingAction"
                :disabled="!isOnline"
                @click="handleReboot"
              >
                Reboot
              </UButton>
              <UButton
                variant="secondary"
                size="sm"
                icon="i-lucide-power-off"
                :loading="isPerformingAction"
                :disabled="!isOnline"
                @click="handleShutdown"
              >
                Shutdown
              </UButton>
            </div>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <!-- Loading -->
        <div v-if="pending" class="flex items-center justify-center h-64">
          <UIcon name="i-lucide-loader" class="size-8 animate-spin text-primary" />
        </div>

        <!-- Error -->
        <div
          v-else-if="error"
          class="flex flex-col items-center justify-center h-64 gap-4"
        >
          <UIcon name="i-lucide-alert-circle" class="size-12 text-error" />
          <p class="text-lg font-medium">Failed to load node</p>
          <p class="text-muted">{{ error.message }}</p>
          <UButton to="/talos">
            <UIcon name="i-lucide-arrow-left" class="size-4 mr-2" />
            Back to Talos
          </UButton>
        </div>

        <!-- Content -->
        <div v-else-if="data" class="p-4 space-y-4">
          <!-- Messages -->
          <div v-if="actionError" class="p-3 rounded bg-error/10 text-error">
            {{ actionError }}
          </div>
          <div v-if="actionSuccess" class="p-3 rounded bg-success/10 text-success">
            {{ actionSuccess }}
          </div>

          <!-- Info cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <UCard>
              <template #header>
                <span class="text-sm text-muted">IP Address</span>
              </template>
              <span class="font-mono text-lg">{{ data.ip }}</span>
            </UCard>
            <UCard>
              <template #header>
                <span class="text-sm text-muted">Talos Version</span>
              </template>
              <span class="font-mono text-lg">v{{ data.version }}</span>
            </UCard>
            <UCard>
              <template #header>
                <span class="text-sm text-muted">Operating System</span>
              </template>
              <span>{{ data.operatingSystem }}</span>
            </UCard>
            <UCard>
              <template #header>
                <span class="text-sm text-muted">Node ID</span>
              </template>
              <span class="font-mono text-xs break-all">{{ data.nodeId || 'N/A' }}</span>
            </UCard>
          </div>

          <!-- Resource Usage Cards -->
          <div v-if="data.online" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-cpu" class="size-4" />
                  <span class="text-sm">CPU</span>
                </div>
              </template>
              <div class="text-center py-4">
                <div class="text-3xl font-bold">{{ data.resources?.cpuCores || 0 }}</div>
                <div class="text-sm text-muted">Cores</div>
              </div>
            </UCard>
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-memory-stick" class="size-4" />
                  <span class="text-sm">Memory</span>
                </div>
              </template>
              <div class="space-y-2">
                <div class="text-2xl font-bold">{{ data.resources?.memoryUsage || 0 }}%</div>
                <UProgress
                  :modelValue="data.resources?.memoryUsage || 0"
                  :max="100"
                  :color="(data.resources?.memoryUsage || 0) > 80 ? 'error' : (data.resources?.memoryUsage || 0) > 60 ? 'warning' : 'primary'"
                  size="sm"
                />
                <span class="text-xs text-muted">{{ data.resources?.memoryUsed || 0 }} / {{ data.resources?.memoryTotal || 0 }} GB</span>
              </div>
            </UCard>
            <UCard v-if="data.machineType === 'controlplane'">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-database" class="size-4" />
                  <span class="text-sm">etcd Health</span>
                </div>
              </template>
              <div class="space-y-2">
                <div v-if="data.etcdHealth" class="flex items-center gap-2">
                  <UIcon
                    :name="data.etcdHealth.healthy ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
                    :class="data.etcdHealth.healthy ? 'text-success' : 'text-error'"
                    class="size-6"
                  />
                  <span class="font-medium">{{ data.etcdHealth.healthy ? 'Healthy' : 'Unhealthy' }}</span>
                </div>
                <div v-else class="text-muted">
                  No etcd data
                </div>
              </div>
            </UCard>
          </div>

          <!-- Node Conditions -->
          <TalosNodeConditions :node-name="nodeId" />

          <!-- Hardware Info -->
          <TalosHardwareInfo :node-id="nodeId" />

          <!-- Live Metrics -->
          <TalosLiveMetrics :node-id="nodeId" />

          <!-- Kubernetes Pods -->
          <TalosPodsList :node-id="nodeId" />

          <!-- Services -->
          <UCard>
            <TalosServiceList :services="services" />
          </UCard>

          <!-- Logs -->
          <UCard>
            <TalosLogsViewer
              :node-id="nodeId"
              :service="selectedService === 'all' ? 'machined' : selectedService"
            />
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
