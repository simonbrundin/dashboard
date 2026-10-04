<script setup lang="ts">
interface EtcdBackup {
  id: string
  createdAt: string
  size: string
  completed: boolean
  nodeName: string
}

interface EtcdBackupsResponse {
  enabled: boolean
  interval: string
  lastBackup?: string
  backups: EtcdBackup[]
  nextScheduled?: string
}

const { data, pending, refresh } = await useAsyncData<EtcdBackupsResponse>(
  'talos-etcd-backups',
  () => $fetch('/api/talos/etcd-backups'),
  {
    server: false,
    default: () => ({
      enabled: false,
      interval: '1h',
      backups: [],
    }),
  },
)

function formatDate(isoString?: string): string {
  if (!isoString) return 'Never'
  const date = new Date(isoString)
  return date.toLocaleString()
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / 1000 / 60 / 60)
  
  if (diffHours < 1) return 'Less than an hour ago'
  if (diffHours < 24) return `${diffHours} hours ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} days ago`
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-database" class="size-4" />
          <span class="font-medium">etcd Backups</span>
        </div>
        <div class="flex items-center gap-2">
          <UBadge
            :color="data?.enabled ? 'success' : 'neutral'"
            variant="subtle"
            size="sm"
          >
            {{ data?.enabled ? 'Enabled' : 'Disabled' }}
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

    <!-- Backup info -->
    <div class="space-y-3 mb-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted">Backup Interval</span>
        <span class="text-sm font-medium">{{ data?.interval || '1h' }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted">Last Backup</span>
        <span class="text-sm">
          {{ data?.lastBackup ? formatRelativeTime(data.lastBackup) : 'Never' }}
        </span>
      </div>
      <div v-if="data?.nextScheduled && data.enabled" class="flex items-center justify-between">
        <span class="text-sm text-muted">Next Scheduled</span>
        <span class="text-sm">{{ formatDate(data.nextScheduled) }}</span>
      </div>
    </div>

    <!-- Backup list -->
    <div v-if="pending && !data?.backups?.length" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else-if="!data?.backups?.length" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-database-zap" class="size-8 mb-2 mx-auto" />
      <p>No backups found</p>
      <p class="text-xs mt-1">Backups will appear here when available</p>
    </div>

    <div v-else class="space-y-2">
      <div class="text-xs text-muted mb-2">
        {{ data?.backups?.length || 0 }} recent backups
      </div>
      <div
        v-for="backup in data?.backups"
        :key="backup.id"
        class="flex items-center justify-between p-2 rounded bg-muted/50"
      >
        <div class="flex items-center gap-2">
          <UIcon
            :name="backup.completed ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
            :class="backup.completed ? 'text-success' : 'text-warning'"
            class="size-4"
          />
          <div>
            <span class="text-sm">{{ formatDate(backup.createdAt) }}</span>
            <span class="text-xs text-muted ml-2">{{ formatRelativeTime(backup.createdAt) }}</span>
          </div>
        </div>
        <span class="text-xs font-mono">{{ backup.size }}</span>
      </div>
    </div>
  </UCard>
</template>
