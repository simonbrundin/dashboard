<script setup lang="ts">
import { ref, computed } from 'vue'

interface UpgradeStatus {
  talos: {
    current: string
    latest: string
    canUpgrade: boolean
    upgradeAvailable: boolean
  }
  kubernetes: {
    current: string
    latest: string
    available: string[]
  }
}

const { data: upgradeStatus, refresh: refreshUpgradeStatus } = await useFetch<UpgradeStatus>('/api/talos/available-versions')

const selectedTalosVersion = ref('')
const selectedK8sVersion = ref('')
const isUpgrading = ref(false)
const upgradeMessage = ref('')
const showConfirmTalos = ref(false)
const showConfirmK8s = ref(false)

const talosVersions = ['v1.14.1', 'v1.14.0', 'v1.13.2', 'v1.13.1', 'v1.13.0']
const k8sVersions = computed(() => 
  (upgradeStatus.value?.kubernetes?.available || ['v1.35.2', 'v1.35.0', 'v1.34.1', 'v1.33.0', 'v1.32.2'])
    .map(v => `v${v}`)
    .reverse()
)

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
        version: type === 'talos' ? selectedTalosVersion.value || 'v1.14.1' : selectedK8sVersion.value || 'v1.35.0'
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
</script>

<template>
  <div class="space-y-6">
    <!-- Talos Upgrade -->
    <div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-white">Talos Upgrade</h3>
          <p class="text-sm text-gray-400">
            Current: <span class="text-white">{{ upgradeStatus?.talos?.current || 'Loading...' }}</span>
            <span v-if="upgradeStatus?.talos?.latest !== upgradeStatus?.talos?.current" class="ml-2">
              → Latest: <span class="text-green-400">{{ upgradeStatus?.talos?.latest }}</span>
            </span>
          </p>
        </div>
        <UBadge v-if="talosUpgradeAvailable" color="green" variant="subtle">
          Upgrade Available
        </UBadge>
        <UBadge v-else color="gray" variant="subtle">
          Up to Date
        </UBadge>
      </div>

      <div v-if="upgradeMessage" class="mb-4 rounded bg-blue-900/30 p-3 text-sm text-blue-300">
        {{ upgradeMessage }}
      </div>

      <div class="flex items-center gap-3">
        <USelect
          v-model="selectedTalosVersion"
          :items="talosVersions"
          placeholder="Select version"
          class="w-40"
        />
        <UButton
          v-if="!showConfirmTalos"
          :disabled="!talosUpgradeAvailable || isUpgrading"
          :loading="isUpgrading"
          color="primary"
          @click="showConfirmTalos = true"
        >
          {{ talosUpgradeAction }}
        </UButton>
        <template v-else>
          <UButton color="red" @click="performUpgrade('talos', selectedTalosVersion)">
            Confirm
          </UButton>
          <UButton color="gray" variant="outline" @click="showConfirmTalos = false">
            Cancel
          </UButton>
        </template>
      </div>

      <p class="mt-3 text-xs text-gray-500">
        ⚠️ Upgrading Talos may cause brief control plane downtime. Nodes are upgraded sequentially.
      </p>
    </div>

    <!-- Kubernetes Upgrade -->
    <div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-white">Kubernetes Upgrade</h3>
          <p class="text-sm text-gray-400">
            Current: <span class="text-white">v{{ upgradeStatus?.kubernetes?.current || '...' }}</span>
            <span v-if="upgradeStatus?.kubernetes?.current !== upgradeStatus?.kubernetes?.latest" class="ml-2">
              → Latest: <span class="text-green-400">v{{ upgradeStatus?.kubernetes?.latest }}</span>
            </span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <USelect
          v-model="selectedK8sVersion"
          :items="k8sVersions"
          placeholder="Select version"
          class="w-40"
        />
        <UButton
          v-if="!showConfirmK8s"
          :disabled="isUpgrading"
          :loading="isUpgrading"
          color="primary"
          @click="showConfirmK8s = true"
        >
          Upgrade
        </UButton>
        <template v-else>
          <UButton color="red" @click="performUpgrade('kubernetes', selectedK8sVersion)">
            Confirm
          </UButton>
          <UButton color="gray" variant="outline" @click="showConfirmK8s = false">
            Cancel
          </UButton>
        </template>
      </div>

      <p class="mt-3 text-xs text-gray-500">
        ⚠️ Kubernetes upgrades require compatible Talos version. Control plane is upgraded first.
      </p>
    </div>

    <!-- Cancel Button -->
    <div v-if="isUpgrading" class="rounded-lg border border-red-800 bg-red-900/20 p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-red-400">Upgrade in Progress</h3>
          <p class="text-sm text-gray-400">You can cancel the ongoing upgrade if needed.</p>
        </div>
        <UButton color="red" variant="outline" @click="cancelUpgrade">
          Cancel Upgrade
        </UButton>
      </div>
    </div>
  </div>
</template>
