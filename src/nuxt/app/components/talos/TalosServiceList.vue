<script setup lang="ts">
import type { TalosService } from '~/server/api/talos/nodes.get'

defineProps<{
  services: TalosService[]
  loading?: boolean
}>()

const serviceHealthColor = (health: string) => {
  switch (health) {
    case 'OK':
      return 'success'
    case 'Warning':
      return 'warning'
    case 'Error':
      return 'error'
    default:
      return 'neutral'
  }
}

const serviceStateColor = (state: string) => {
  switch (state) {
    case 'Running':
      return 'success'
    case 'Stopping':
      return 'warning'
    case 'Finished':
      return 'info'
    case 'Failed':
      return 'error'
    default:
      return 'neutral'
  }
}

const criticalServices = ['apid', 'etcd', 'kubelet', 'kube-proxy', 'trustd']
const isCritical = (name: string) => criticalServices.some(s => name.includes(s))
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium">Services</h3>
      <span class="text-xs text-muted">{{ services.length }} services</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-4">
      <UIcon name="i-lucide-loader" class="size-5 animate-spin text-primary" />
    </div>

    <!-- Services table -->
    <div v-else-if="services.length > 0" class="overflow-x-auto">
      <table class="min-w-full divide-y divide-default">
        <thead class="bg-muted/50">
          <tr>
            <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">Service</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">State</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">Health</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">Last Change</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="service in services" :key="service.name" class="hover:bg-muted/30">
            <td class="px-3 py-2 whitespace-nowrap">
              <div class="flex items-center gap-2">
                <span
                  v-if="isCritical(service.name)"
                  class="size-1.5 rounded-full bg-warning shrink-0"
                  title="Critical service"
                />
                <span class="font-mono text-sm">{{ service.name }}</span>
              </div>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <UBadge :color="serviceStateColor(service.state)" variant="subtle" size="xs">
                {{ service.state }}
              </UBadge>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <UBadge :color="serviceHealthColor(service.health)" variant="subtle" size="xs">
                {{ service.health }}
              </UBadge>
            </td>
            <td class="px-3 py-2 whitespace-nowrap text-xs text-muted">
              {{ service.lastChange }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No data -->
    <div v-else class="text-center py-8 text-muted">
      <UIcon name="i-lucide-database" class="size-8 mb-2 mx-auto" />
      <p>No services available</p>
    </div>
  </div>
</template>
