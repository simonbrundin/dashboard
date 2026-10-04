<script setup lang="ts">
interface UpgradeStatus {
  talos: {
    currentVersion: string
    latestVersion: string
    canUpgrade: boolean
    upgradeAvailable: boolean
    phase?: string
    step?: string
  } | null
  kubernetes: {
    currentVersion: string
    ready: boolean
    phase?: string
    step?: string
  } | null
  clusterReady: boolean
}

const { data, pending, refresh } = await useAsyncData<UpgradeStatus>(
  'talos-upgrade-status',
  () => $fetch('/api/talos/upgrade-status'),
  {
    server: false,
    default: () => ({
      talos: null,
      kubernetes: null,
      clusterReady: false,
    }),
  },
)

const hasUpgradeAvailable = computed(() => {
  return data.value?.talos?.upgradeAvailable
})

const isRefreshing = ref(false)
const isPerformingAction = ref(false)
const actionMessage = ref<string | null>(null)
const actionError = ref<string | null>(null)

async function refreshStatus() {
  isRefreshing.value = true
  try {
    await refresh()
  } finally {
    isRefreshing.value = false
  }
}

async function cancelTalosUpgrade() {
  if (!confirm('Cancel the current Talos upgrade?')) return

  isPerformingAction.value = true
  actionMessage.value = null
  actionError.value = null

  try {
    const result = await $fetch<{ success: boolean; message: string }>('/api/talos/upgrade-actions', {
      method: 'POST',
      body: { action: 'cancel-talos-upgrade' },
    })
    actionMessage.value = result.message
    await refresh()
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to cancel upgrade'
  } finally {
    isPerformingAction.value = false
  }
}

async function revertTalosUpgrade() {
  if (!confirm('Revert Talos to the previous version? This will reboot the node.')) return

  isPerformingAction.value = true
  actionMessage.value = null
  actionError.value = null

  try {
    const result = await $fetch<{ success: boolean; message: string }>('/api/talos/upgrade-actions', {
      method: 'POST',
      body: { action: 'revert-talos-upgrade' },
    })
    actionMessage.value = result.message
    await refresh()
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to revert upgrade'
  } finally {
    isPerformingAction.value = false
  }
}

async function startTalosUpgrade() {
  if (!confirm('Start Talos upgrade?')) return

  isPerformingAction.value = true
  actionMessage.value = null
  actionError.value = null

  try {
    const result = await $fetch<{ success: boolean; message: string }>('/api/talos/upgrade-actions', {
      method: 'POST',
      body: { action: 'apply-config', version: data.value?.talos?.latestVersion },
    })
    actionMessage.value = result.message
    await refresh()
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to start upgrade'
  } finally {
    isPerformingAction.value = false
  }
}

// Auto-refresh every 5 minutes
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  refreshInterval.value = setInterval(refreshStatus, 300000)
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<template>
  <div>
    <!-- Talos Upgrade Status -->
    <UCard v-if="data?.talos" class="mb-4">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-package" class="size-4" />
            <span class="font-medium">Talos Version</span>
          </div>
          <UButton
            variant="ghost"
            size="xs"
            square
            :loading="isRefreshing"
            @click="refreshStatus"
          >
            <UIcon name="i-lucide-refresh-cw" class="size-4" />
          </UButton>
        </div>
      </template>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div>
            <span class="text-xs text-muted">Current</span>
            <p class="font-mono font-medium">v{{ data.talos.currentVersion }}</p>
          </div>

          <UIcon
            v-if="data.talos.upgradeAvailable"
            name="i-lucide-arrow-right"
            class="size-4 text-muted"
          />

          <div v-if="data.talos.upgradeAvailable">
            <span class="text-xs text-muted">Available</span>
            <p class="font-mono font-medium text-primary">v{{ data.talos.latestVersion }}</p>
          </div>
        </div>

        <UBadge
          v-if="data.talos.upgradeAvailable"
          color="warning"
          variant="subtle"
        >
          <UIcon name="i-lucide-download" class="size-3 mr-1" />
          Upgrade Available
        </UBadge>
        <UBadge v-else color="success" variant="subtle">
          <UIcon name="i-lucide-check" class="size-3 mr-1" />
          Up to Date
        </UBadge>
      </div>

      <template v-if="data.talos.upgradeAvailable" #footer>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <UButton
              size="sm"
              :loading="isPerformingAction"
              @click="startTalosUpgrade"
            >
              <UIcon name="i-lucide-download" class="size-4 mr-2" />
              Upgrade Talos
            </UButton>
            <span class="text-xs text-muted">
              Upgrades are applied node-by-node with automatic rollback on failure
            </span>
          </div>
          <div v-if="actionMessage" class="p-2 rounded bg-success/10 text-success text-sm">
            {{ actionMessage }}
          </div>
          <div v-if="actionError" class="p-2 rounded bg-error/10 text-error text-sm">
            {{ actionError }}
          </div>
        </div>
      </template>

      <template v-if="data.talos.phase === 'upgrading'" #footer>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-loader" class="size-4 animate-spin text-warning" />
            <span class="text-sm">{{ data.talos.step || 'Upgrading...' }}</span>
          </div>
          <div class="flex gap-2">
            <UButton
              size="xs"
              variant="secondary"
              :loading="isPerformingAction"
              @click="cancelTalosUpgrade"
            >
              Cancel
            </UButton>
            <UButton
              size="xs"
              variant="secondary"
              :loading="isPerformingAction"
              @click="revertTalosUpgrade"
            >
              Revert
            </UButton>
          </div>
        </div>
      </template>
    </UCard>

    <!-- Kubernetes Upgrade Status -->
    <UCard v-if="data?.kubernetes">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-cloud" class="size-4" />
          <span class="font-medium">Kubernetes Version</span>
        </div>
      </template>

      <div class="flex items-center justify-between">
        <div>
          <span class="text-xs text-muted">Current</span>
          <p class="font-mono font-medium">
            {{ data.kubernetes.ready ? `v${data.kubernetes.currentVersion}` : 'N/A' }}
          </p>
        </div>

        <UBadge
          :color="data.kubernetes.ready ? 'success' : 'neutral'"
          variant="subtle"
        >
          {{ data.kubernetes.ready ? 'Connected' : 'Not Available' }}
        </UBadge>
      </div>
    </UCard>
  </div>
</template>
