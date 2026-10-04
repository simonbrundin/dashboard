<script setup lang="ts">
interface Manifest {
  name: string
  namespace: string
  state: 'Applied' | 'Pending' | 'Error'
  status: string
}

interface ManifestsResponse {
  manifests: Manifest[]
  summary: {
    total: number
    applied: number
    pending: number
    error: number
  }
}

const { data, pending, refresh } = await useAsyncData<ManifestsResponse>(
  'talos-manifests',
  () => $fetch('/api/talos/manifests'),
  {
    server: false,
    default: () => ({
      manifests: [],
      summary: { total: 0, applied: 0, pending: 0, error: 0 }
    }),
  },
)

function getStateIcon(state: string) {
  switch (state) {
    case 'Applied': return 'i-lucide-check-circle'
    case 'Pending': return 'i-lucide-clock'
    case 'Error': return 'i-lucide-alert-circle'
    default: return 'i-lucide-help-circle'
  }
}

function getStateColor(state: string): 'success' | 'warning' | 'error' {
  switch (state) {
    case 'Applied': return 'success'
    case 'Pending': return 'warning'
    case 'Error': return 'error'
    default: return 'warning'
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-file-code" class="size-4" />
          <span class="font-medium">Cluster Manifests</span>
        </div>
        <div class="flex items-center gap-2">
          <UBadge v-if="data?.summary" size="sm" variant="subtle">
            {{ data.summary.total }} total
          </UBadge>
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
      </div>
    </template>

    <!-- Summary -->
    <div v-if="data?.summary" class="flex items-center gap-4 mb-4">
      <div class="flex items-center gap-1">
        <UIcon name="i-lucide-check-circle" class="size-4 text-success" />
        <span class="text-sm">{{ data.summary.applied }} Applied</span>
      </div>
      <div v-if="data.summary.pending > 0" class="flex items-center gap-1">
        <UIcon name="i-lucide-clock" class="size-4 text-warning" />
        <span class="text-sm">{{ data.summary.pending }} Pending</span>
      </div>
      <div v-if="data.summary.error > 0" class="flex items-center gap-1">
        <UIcon name="i-lucide-alert-circle" class="size-4 text-error" />
        <span class="text-sm">{{ data.summary.error }} Error</span>
      </div>
    </div>

    <div v-if="pending && !data?.manifests?.length" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else-if="!data?.manifests?.length" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-file-x" class="size-8 mb-2 mx-auto" />
      <p>No manifests found</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="manifest in data?.manifests"
        :key="`${manifest.namespace}-${manifest.name}`"
        class="flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted transition-colors"
      >
        <div class="flex items-center gap-3 min-w-0">
          <UIcon
            :name="getStateIcon(manifest.state)"
            :class="manifest.state === 'Applied' ? 'text-success' : manifest.state === 'Pending' ? 'text-warning' : 'text-error'"
            class="size-4 shrink-0"
          />
          <div class="min-w-0">
            <span class="font-mono text-sm block truncate">{{ manifest.name }}</span>
            <span class="text-xs text-muted">{{ manifest.namespace }}</span>
          </div>
        </div>
        <UBadge :color="getStateColor(manifest.state)" variant="subtle" size="xs">
          {{ manifest.state }}
        </UBadge>
      </div>
    </div>
  </UCard>
</template>
