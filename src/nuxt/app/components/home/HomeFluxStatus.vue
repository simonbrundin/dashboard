<script setup lang="ts">
import type { FluxStatus } from '~/types'

const { data, status, refresh } = await useFetch<FluxStatus>('/api/flux-status', {
  default: () => ({
    controllers: [],
    sources: [],
    kustomizations: [],
    helmReleases: [],
    summary: {
      controllersReady: 0,
      controllersTotal: 0,
      sourcesReady: 0,
      sourcesTotal: 0,
      kustomizationsReady: 0,
      kustomizationsTotal: 0,
      helmReleasesReady: 0,
      helmReleasesTotal: 0
    }
  })
})

const summary = computed(() => data.value?.summary)

interface Issue {
  name: string
  namespace: string
  kind: string
  status: 'Ready' | 'NotReady' | 'Progressing' | 'Unknown'
  message?: string
}

const issues = computed<Issue[]>(() => {
  const items: Issue[] = []

  for (const controller of data.value?.controllers ?? []) {
    // Only show NotReady and Progressing, not Unknown
    if (controller.status === 'NotReady' || controller.status === 'Progressing') {
      items.push({
        name: controller.name,
        namespace: controller.namespace,
        kind: 'Pod',
        status: controller.status as Issue['status'],
        message: controller.message
      })
    }
  }

  for (const source of data.value?.sources ?? []) {
    // Only show NotReady and Progressing, not Unknown
    if (source.status === 'NotReady' || source.status === 'Progressing') {
      items.push({
        name: source.name,
        namespace: source.namespace,
        kind: source.kind,
        status: source.status as Issue['status'],
        message: source.message
      })
    }
  }

  for (const kustomization of data.value?.kustomizations ?? []) {
    // Only show NotReady and Progressing, not Unknown
    if (kustomization.status === 'NotReady' || kustomization.status === 'Progressing') {
      items.push({
        name: kustomization.name,
        namespace: kustomization.namespace,
        kind: 'Kustomization',
        status: kustomization.status as Issue['status'],
        message: kustomization.error
      })
    }
  }

  for (const release of data.value?.helmReleases ?? []) {
    // Only show NotReady and Progressing, not Unknown
    if (release.status === 'NotReady' || release.status === 'Progressing') {
      items.push({
        name: release.name,
        namespace: release.namespace,
        kind: 'HelmRelease',
        status: release.status as Issue['status'],
        message: release.message
      })
    }
  }

  return items
})

const hasIssues = computed(() => issues.value.length > 0)
const hasErrors = computed(() => issues.value.some(i => i.status === 'NotReady'))

const allHealthy = computed(() => {
  if (!summary.value) return false
  return (
    summary.value.controllersReady === summary.value.controllersTotal
    && summary.value.sourcesReady === summary.value.sourcesTotal
    && summary.value.kustomizationsReady === summary.value.kustomizationsTotal
    && summary.value.helmReleasesReady === summary.value.helmReleasesTotal
  )
})

const isLoading = computed(() => status.value === 'pending')
const isMockData = computed(() => {
  if (!data.value) return false
  const mockPattern = ['source-controller', 'kustomize-controller', 'helm-controller', 'notification-controller']
  const controllersMatch = (data.value.controllers ?? []).length === 4
    && (data.value.controllers ?? []).every(c => mockPattern.includes(c.name))
  const hasDefaultSources = (data.value.sources ?? []).some(s => s.url.includes('github.com/simonbrundin/infrastructure'))
  return controllersMatch && hasDefaultSources
})
</script>

<template>
  <UCard class="mb-4 flux-status-card">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-default">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-git-fork" class="size-5 text-primary" />
        <span class="font-medium">Flux GitOps</span>
      </div>

      <div class="flex items-center gap-3">
        <template v-if="allHealthy">
          <UBadge color="success" variant="subtle">
            <UIcon name="i-lucide-check-circle" class="size-3 mr-1" />
            All synced
          </UBadge>
        </template>

        <template v-else-if="hasErrors">
          <UBadge color="error" variant="subtle">
            <UIcon name="i-lucide-alert-circle" class="size-3 mr-1" />
            {{ issues.length }} issue{{ issues.length === 1 ? '' : 's' }}
          </UBadge>
        </template>

        <template v-else-if="hasIssues">
          <UBadge color="info" variant="subtle">
            <UIcon name="i-lucide-loader" class="size-3 mr-1 animate-spin" />
            {{ issues.length }} progressing
          </UBadge>
        </template>

        <template v-else-if="isLoading">
          <UBadge color="neutral" variant="subtle">
            <UIcon name="i-lucide-loader" class="size-3 mr-1 animate-spin" />
            Loading...
          </UBadge>
        </template>

        <template v-else-if="isMockData">
          <UBadge color="warning" variant="subtle">
            <UIcon name="i-lucide-database" class="size-3 mr-1" />
            Demo data
          </UBadge>
        </template>

        <UButton
          variant="ghost"
          size="sm"
          square
          :loading="isLoading"
          @click="refresh()"
        >
          <UIcon name="i-lucide-refresh-cw" class="size-4" />
        </UButton>
      </div>
    </div>

    <!-- Issues List -->
    <div v-if="hasIssues" class="border-t border-default">
      <div class="divide-y divide-default">
        <div
          v-for="(issue, index) in issues"
          :key="`${issue.kind}-${issue.name}-${issue.namespace}-${index}`"
          :class="issue.status === 'NotReady' ? 'bg-error/5' : 'bg-info/5'"
        >
          <div class="flex items-start justify-between gap-4 p-4">
            <div class="flex items-start gap-3">
              <UIcon
                :name="issue.status === 'NotReady' ? 'i-lucide-alert-triangle' : 'i-lucide-loader'"
                :class="issue.status === 'NotReady' ? 'text-error' : 'text-info animate-spin'"
                class="size-5 mt-0.5"
              />
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-mono font-medium">{{ issue.name }}</span>
                  <UBadge
                    :color="issue.status === 'NotReady' ? 'error' : 'info'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ issue.kind }}
                  </UBadge>
                </div>
                <div class="text-sm text-muted mt-1">
                  {{ issue.namespace }}
                </div>
                <div v-if="issue.message" :class="issue.status === 'NotReady' ? 'text-sm text-error mt-1' : 'text-sm text-info mt-1'">
                  {{ issue.message }}
                </div>
              </div>
            </div>
            <UBadge
              :color="issue.status === 'NotReady' ? 'error' : 'info'"
              variant="subtle"
            >
              {{ issue.status }}
            </UBadge>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!isLoading && !isMockData" class="p-8 text-center">
      <UIcon name="i-lucide-check-circle-2" class="size-8 text-success mx-auto mb-2" />
      <p class="text-muted">
        All Flux resources are healthy
      </p>
    </div>
  </UCard>
</template>

<style scoped>
.flux-status-card :deep(.flex-1) {
  flex: auto !important;
  min-height: 0 !important;
}

.flux-status-card > :deep(div) {
  overflow: visible !important;
  max-height: none !important;
}
</style>
