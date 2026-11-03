<script setup lang="ts">
import type { PxeStatus } from '~/types'

const { data, pending, refresh } = await useAsyncData<PxeStatus>('pxe-status', () => $fetch('/api/pxe-status'), {
  server: false,
  default: () => ({
    host: '',
    ok: false,
    checkedAt: '',
    checks: []
  })
})

const isRefreshing = ref(false)
const now = ref(new Date())

async function refreshStatus() {
  isRefreshing.value = true

  try {
    await refresh()
  } catch (error) {
    console.error('Failed to refresh PXE status:', error)
  } finally {
    isRefreshing.value = false
  }
}

const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)
const clockInterval = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  refreshInterval.value = setInterval(refreshStatus, 30000)
  clockInterval.value = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (refreshInterval.value) clearInterval(refreshInterval.value)
  if (clockInterval.value) clearInterval(clockInterval.value)
})

const status = computed(() => data.value)
const checks = computed(() => status.value?.checks ?? [])
const failedChecks = computed(() => checks.value.filter(check => check.status === 'fail'))
const unknownChecks = computed(() => checks.value.filter(check => check.status === 'unknown'))

const timeSinceCheck = computed(() => {
  if (!status.value?.checkedAt) return '-'

  const seconds = Math.floor((now.value.getTime() - new Date(status.value.checkedAt).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h`
})

function iconFor(status: string) {
  if (status === 'ok') return 'i-lucide-check-circle-2'
  if (status === 'fail') return 'i-lucide-alert-circle'
  return 'i-lucide-help-circle'
}

function colorFor(status: string) {
  if (status === 'ok') return 'text-success'
  if (status === 'fail') return 'text-error'
  return 'text-muted'
}
</script>

<template>
  <UCard class="mb-4 pxe-status-card">
    <div class="flex items-center justify-between p-4 border-b border-default">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-server-cog" class="size-5 text-primary" />
        <span class="font-medium">PXE-server</span>
        <span v-if="status?.host" class="text-sm text-muted font-mono">
          {{ status.host }}
        </span>
      </div>

      <div class="flex items-center gap-3">
        <template v-if="pending && !checks.length">
          <UBadge color="neutral" variant="subtle">
            <UIcon name="i-lucide-loader" class="size-3 mr-1 animate-spin" />
            Loading...
          </UBadge>
        </template>

        <template v-else-if="failedChecks.length">
          <UBadge color="error" variant="subtle">
            <UIcon name="i-lucide-x-circle" class="size-3 mr-1" />
            Nere
          </UBadge>
        </template>

        <template v-else>
          <UBadge color="success" variant="subtle">
            <UIcon name="i-lucide-check-circle" class="size-3 mr-1" />
            Fungerar
          </UBadge>
        </template>

        <UBadge color="neutral" variant="subtle">
          <UIcon name="i-lucide-clock" class="size-3 mr-1" />
          {{ timeSinceCheck }}
        </UBadge>

        <UButton
          variant="ghost"
          size="sm"
          square
          :loading="isRefreshing"
          @click="refreshStatus"
        >
          <UIcon name="i-lucide-refresh-cw" class="size-4" />
        </UButton>
      </div>
    </div>

    <div v-if="checks.length" class="divide-y divide-default">
      <div
        v-for="check in checks"
        :key="check.label"
        class="flex items-center justify-between gap-4 p-3 px-4"
      >
        <div class="flex items-center gap-3 min-w-0">
          <UIcon
            :name="iconFor(check.status)"
            :class="colorFor(check.status)"
            class="size-4 shrink-0"
          />
          <span class="text-sm truncate">{{ check.label }}</span>
          <span v-if="check.detail" class="text-xs text-muted truncate">
            {{ check.detail }}
          </span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <UBadge
            v-if="check.httpStatus"
            :color="check.status === 'ok' ? 'success' : 'error'"
            variant="subtle"
            size="sm"
          >
            HTTP {{ check.httpStatus }}
          </UBadge>
          <UBadge
            v-else-if="check.status === 'unknown'"
            color="neutral"
            variant="subtle"
            size="sm"
          >
            Okänd
          </UBadge>
          <span class="text-xs text-muted font-mono w-16 text-right">
            {{ check.latencyMs }} ms
          </span>
        </div>
      </div>
    </div>

    <div v-else-if="!pending" class="p-8 text-center">
      <UIcon name="i-lucide-plug-zap" class="size-8 text-error mx-auto mb-2" />
      <p class="text-muted">
        Kunde inte nå PXE-servern
      </p>
    </div>

    <div v-if="unknownChecks.length" class="px-4 pb-4">
      <p class="text-xs text-muted">
        {{ unknownChecks.map(check => check.label).join(', ') }} kunde inte
        kontrolleras från dashboardens nätverk - UDP blockeras i pod-nätet.
        Matchbox (HTTP) är den del som avgör om noderna kan boota.
      </p>
    </div>
  </UCard>
</template>

<style scoped>
.pxe-status-card :deep(.flex-1) {
  flex: auto !important;
  min-height: 0 !important;
}

.pxe-status-card > :deep(div) {
  overflow: visible !important;
  max-height: none !important;
}
</style>
