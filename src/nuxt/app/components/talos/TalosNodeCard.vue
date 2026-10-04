<script setup lang="ts">
import type { TalosNode } from '~/server/api/talos/nodes.get'

const props = defineProps<{
  node: TalosNode
}>()

const emit = defineEmits<{
  reboot: []
  shutdown: []
  refresh: []
  drain: [nodeId: string]
}>()

const isPerformingAction = ref(false)
const actionError = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)

const isOnline = computed(() => props.node.online && props.node.phase === 'running')

const phaseColor = computed(() => {
  if (!props.node.online) return 'error'
  switch (props.node.phase) {
    case 'running':
      return 'success'
    case 'booting':
    case 'installing':
      return 'warning'
    case 'shutting_down':
    case 'resetting':
      return 'error'
    case 'offline':
      return 'error'
    default:
      return 'neutral'
  }
})

const roleColor = computed(() => {
  return props.node.machineType === 'controlplane' ? 'primary' : 'secondary'
})

const talosVersion = computed(() => {
  if (!props.node.online) return 'N/A'
  const match = props.node.operatingSystem.match(/v?([\d.]+)/)
  return match ? match[1] : 'unknown'
})

async function handleReboot() {
  if (!confirm(`Reboot ${props.node.hostname}?`)) return

  isPerformingAction.value = true
  actionError.value = null
  actionSuccess.value = null

  try {
    await $fetch(`/api/talos/reboot/${props.node.id}`, { method: 'POST' })
    actionSuccess.value = `Reboot initiated for ${props.node.hostname}`
    emit('reboot')
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to reboot'
  } finally {
    isPerformingAction.value = false
  }
}

async function handleShutdown() {
  if (!confirm(`Shutdown ${props.node.hostname}? This will power off the node.`)) return

  isPerformingAction.value = true
  actionError.value = null
  actionSuccess.value = null

  try {
    await $fetch(`/api/talos/shutdown/${props.node.id}`, { method: 'POST' })
    actionSuccess.value = `Shutdown initiated for ${props.node.hostname}`
    emit('shutdown')
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to shutdown'
  } finally {
    isPerformingAction.value = false
  }
}

async function handleDrain() {
  if (!confirm(`Drain ${props.node.hostname}? This will evict all pods and mark the node as unschedulable.`)) return

  isPerformingAction.value = true
  actionError.value = null
  actionSuccess.value = null

  try {
    const result = await $fetch<{ success: boolean; message: string }>(`/api/talos/drain`, {
      method: 'POST',
      body: { nodeId: props.node.id, action: 'drain' },
    })
    actionSuccess.value = result.message || `Drain initiated for ${props.node.hostname}`
    emit('drain', props.node.id)
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to drain'
  } finally {
    isPerformingAction.value = false
  }
}

async function handleCordon() {
  if (!confirm(`Cordon ${props.node.hostname}? This will mark the node as unschedulable.`)) return

  isPerformingAction.value = true
  actionError.value = null
  actionSuccess.value = null

  try {
    const result = await $fetch<{ success: boolean; message: string }>(`/api/talos/drain`, {
      method: 'POST',
      body: { nodeId: props.node.id, action: 'cordon' },
    })
    actionSuccess.value = result.message || `${props.node.hostname} is now unschedulable`
    emit('drain', props.node.id)
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to cordon'
  } finally {
    isPerformingAction.value = false
  }
}

async function handleUncordon() {
  if (!confirm(`Uncordon ${props.node.hostname}? This will mark the node as schedulable again.`)) return

  isPerformingAction.value = true
  actionError.value = null
  actionSuccess.value = null

  try {
    const result = await $fetch<{ success: boolean; message: string }>(`/api/talos/drain`, {
      method: 'POST',
      body: { nodeId: props.node.id, action: 'uncordon' },
    })
    actionSuccess.value = result.message || `${props.node.hostname} is now schedulable`
    emit('drain', props.node.id)
  } catch (err: unknown) {
    actionError.value = (err as { message?: string })?.message || 'Failed to uncordon'
  } finally {
    isPerformingAction.value = false
  }
}

const isDrained = ref(false) // This would come from actual cluster state
</script>

<template>
  <UCard class="talos-node-card">
    <!-- Header -->
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon
            :name="isOnline ? 'i-lucide-server' : 'i-lucide-server-off'"
            :class="isOnline ? 'text-success' : 'text-muted'"
            class="size-5 flex-shrink-0"
          />
          <span class="font-medium truncate">{{ node.hostname }}</span>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <UBadge :color="roleColor" variant="subtle" size="sm">
            {{ node.machineType }}
          </UBadge>
          <UBadge :color="phaseColor" variant="subtle" size="sm">
            {{ node.phase }}
          </UBadge>
        </div>
      </div>
    </template>

    <!-- Body -->
    <div class="space-y-3">
      <!-- IP Address -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted flex items-center gap-1">
          <UIcon name="i-lucide-network" class="size-3" />
          IP
        </span>
        <span class="font-mono">{{ node.ip || 'N/A' }}</span>
      </div>

      <!-- Node ID -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted flex items-center gap-1">
          <UIcon name="i-lucide-fingerprint" class="size-3" />
          ID
        </span>
        <span class="font-mono text-xs truncate max-w-[140px]" :title="node.id">
          {{ node.id.slice(0, 12) }}...
        </span>
      </div>

      <!-- Talos Version -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted flex items-center gap-1">
          <UIcon name="i-lucide-tag" class="size-3" />
          Talos
        </span>
        <span class="font-mono">v{{ talosVersion }}</span>
      </div>

      <!-- etcd Health (for control planes) -->
      <div v-if="node.machineType === 'controlplane' && node.etcdHealth" class="flex items-center justify-between text-sm">
        <span class="text-muted flex items-center gap-1">
          <UIcon name="i-lucide-database" class="size-3" />
          etcd
        </span>
        <UBadge
          :color="node.etcdHealth.healthy && node.etcdHealth.memberHealthy ? 'success' : 'error'"
          variant="subtle"
          size="xs"
        >
          {{ node.etcdHealth.healthy && node.etcdHealth.memberHealthy ? 'Healthy' : 'Unhealthy' }}
        </UBadge>
      </div>

      <!-- Resource Usage -->
      <template v-if="node.online && node.resources">
        <!-- CPU Cores -->
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted flex items-center gap-1">
            <UIcon name="i-lucide-cpu" class="size-3" />
            CPU
          </span>
          <span class="font-medium">{{ node.resources.cpuCores }} cores</span>
        </div>

        <!-- Memory -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted">Memory</span>
            <span>{{ node.resources.memoryUsed }} / {{ node.resources.memoryTotal }} GB</span>
          </div>
          <UProgress
            :modelValue="node.resources.memoryUsage"
            :max="100"
            :color="node.resources.memoryUsage > 80 ? 'error' : node.resources.memoryUsage > 60 ? 'warning' : 'primary'"
            size="sm"
          />
        </div>
      </template>

      <!-- Messages -->
      <div v-if="actionError" class="p-2 rounded bg-error/10 text-error text-sm">
        {{ actionError }}
      </div>
      <div v-if="actionSuccess" class="p-2 rounded bg-success/10 text-success text-sm">
        {{ actionSuccess }}
      </div>
    </div>

    <!-- Footer with actions -->
    <template #footer>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          <!-- Drain/Cordon/Uncordon -->
          <UDropdown
            v-if="node.machineType === 'worker' && node.online"
            :items="[
              [{ label: 'Cordon', icon: 'i-lucide-ban', handler: handleCordon }],
              [{ label: 'Uncordon', icon: 'i-lucide-check-circle', handler: handleUncordon }],
              [{ label: 'Drain', icon: 'i-lucide-eject', handler: handleDrain }],
            ]"
          >
            <UButton
              variant="ghost"
              size="xs"
              square
              :loading="isPerformingAction"
              title="Drain/Cordon"
            >
              <UIcon name="i-lucide-grip-horizontal" class="size-4" />
            </UButton>
          </UDropdown>

          <UButton
            variant="ghost"
            size="xs"
            square
            :loading="isPerformingAction"
            title="Reboot"
            :disabled="!isOnline"
            @click="handleReboot"
          >
            <UIcon name="i-lucide-rotate-cw" class="size-4" />
          </UButton>
          <UButton
            variant="ghost"
            size="xs"
            square
            :loading="isPerformingAction"
            title="Shutdown"
            :disabled="!isOnline"
            @click="handleShutdown"
          >
            <UIcon name="i-lucide-power-off" class="size-4" />
          </UButton>
          <UButton
            variant="ghost"
            size="xs"
            square
            title="Details"
            :to="`/talos/${node.id}`"
          >
            <UIcon name="i-lucide-file-text" class="size-4" />
          </UButton>
        </div>

        <NuxtLink
          :to="`/talos/${node.id}`"
          class="text-sm text-primary hover:underline"
        >
          Details →
        </NuxtLink>
      </div>
    </template>
  </UCard>
</template>

<style scoped>
.talos-node-card {
  transition: transform 0.2s ease;
}

.talos-node-card:hover {
  transform: translateY(-2px);
}
</style>
