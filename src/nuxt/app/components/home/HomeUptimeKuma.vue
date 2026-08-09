<script setup lang="ts">
import type { UptimeKumaMonitor, UptimeKumaSummary } from '~/types'

interface UptimeKumaResponse {
  monitors: UptimeKumaMonitor[]
  summary: UptimeKumaSummary
}

const { data, status, refresh } = await useFetch<UptimeKumaResponse>('/api/uptime-kuma', {
  default: () => ({
    monitors: [],
    summary: { total: 0, up: 0, down: 0, maintenance: 0, pending: 0 }
  })
})

const summary = computed(() => data.value?.summary)
const monitors = computed(() => data.value?.monitors ?? [])

const downMonitors = computed(() =>
  monitors.value.filter(m => m.status === 0)
)

const maintenanceMonitors = computed(() =>
  monitors.value.filter(m => m.status === 3)
)

const hasIssues = computed(() =>
  summary.value && (summary.value.down > 0 || summary.value.maintenance > 0)
)

const operationalCount = computed(() =>
  summary.value?.up ?? 0
)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-activity" class="size-5 text-primary" />
          <span class="font-medium">System Status</span>
        </div>

        <div class="flex items-center gap-3">
          <!-- All operational -->
          <template v-if="!hasIssues">
            <UBadge color="success" variant="subtle">
              <UIcon name="i-lucide-check-circle" class="size-3 mr-1" />
              {{ operationalCount }} operational
            </UBadge>
          </template>

          <!-- Issues -->
          <template v-else>
            <!-- Down monitors -->
            <UBadge
              v-for="monitor in downMonitors"
              :key="monitor.id"
              color="error"
              variant="subtle"
            >
              <UIcon name="i-lucide-x-circle" class="size-3 mr-1" />
              {{ monitor.name }} down
            </UBadge>

            <!-- Maintenance monitors -->
            <UBadge
              v-for="monitor in maintenanceMonitors"
              :key="monitor.id"
              color="warning"
              variant="subtle"
            >
              <UIcon name="i-lucide-wrench" class="size-3 mr-1" />
              {{ monitor.name }} maintenance
            </UBadge>

            <!-- Operational count if some are up -->
            <UBadge
              v-if="operationalCount > 0"
              color="success"
              variant="subtle"
            >
              <UIcon name="i-lucide-check" class="size-3 mr-1" />
              {{ operationalCount }} up
            </UBadge>
          </template>

          <UButton
            variant="ghost"
            size="sm"
            square
            :loading="status === 'pending'"
            @click="refresh()"
          >
            <UIcon name="i-lucide-refresh-cw" class="size-4" />
          </UButton>
        </div>
      </div>
    </template>
  </UCard>
</template>
