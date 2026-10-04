<script setup lang="ts">
interface Pod {
  name: string
  namespace: string
  ready: string
  status: string
  restarts: number
  age: string
  nodeName: string
}

interface PodsResponse {
  nodeName: string
  pods: Pod[]
}

const props = defineProps<{
  nodeId: string
}>()

const { data, pending, refresh } = await useAsyncData<PodsResponse>(
  `talos-pods-${props.nodeId}`,
  () => $fetch(`/api/talos/pods?node=${props.nodeId}`),
  {
    server: false,
    default: () => ({ nodeName: '', pods: [] }),
  },
)

const sortedPods = computed(() => {
  return [...(data.value?.pods || [])].sort((a, b) => {
    // Sort by namespace, then by name
    if (a.namespace !== b.namespace) {
      return a.namespace.localeCompare(b.namespace)
    }
    return a.name.localeCompare(b.name)
  })
})

const podsByNamespace = computed(() => {
  const grouped = new Map<string, Pod[]>()
  for (const pod of sortedPods.value) {
    if (!grouped.has(pod.namespace)) {
      grouped.set(pod.namespace, [])
    }
    grouped.get(pod.namespace)!.push(pod)
  }
  return grouped
})

function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'Running':
      return 'success'
    case 'Pending':
    case 'ContainerCreating':
      return 'warning'
    case 'Terminating':
    case 'Failed':
      return 'error'
    default:
      return 'neutral'
  }
}

function getNamespaceColor(namespace: string): string {
  switch (namespace) {
    case 'kube-system':
      return 'primary'
    case 'kube-public':
      return 'info'
    default:
      return 'secondary'
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-box" class="size-4" />
          <span class="font-medium">Kubernetes Pods</span>
        </div>
        <div class="flex items-center gap-2">
          <UBadge size="sm" variant="subtle">
            {{ data?.pods?.length || 0 }} pods
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

    <div v-if="pending && !data?.pods?.length" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else-if="!data?.pods?.length" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-package-x" class="size-8 mb-2 mx-auto" />
      <p>No pods running on this node</p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="[namespace, pods] in podsByNamespace" :key="namespace" class="space-y-2">
        <!-- Namespace header -->
        <div class="flex items-center gap-2 sticky top-0 bg-elevated z-10 py-2">
          <UBadge :color="getNamespaceColor(namespace)" variant="subtle" size="sm">
            {{ namespace }}
          </UBadge>
          <span class="text-xs text-muted">{{ pods.length }} pods</span>
        </div>

        <!-- Pods list -->
        <div class="space-y-1">
          <div
            v-for="pod in pods"
            :key="pod.name"
            class="flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted transition-colors"
          >
            <div class="flex items-center gap-3 min-w-0">
              <UIcon
                :name="pod.status === 'Running' ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
                :class="pod.status === 'Running' ? 'text-success' : 'text-warning'"
                class="size-4 shrink-0"
              />
              <span class="font-mono text-sm truncate">{{ pod.name }}</span>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <span class="text-xs text-muted">
                {{ pod.ready }}
              </span>
              <UBadge
                :color="getStatusColor(pod.status)"
                variant="subtle"
                size="xs"
              >
                {{ pod.status }}
              </UBadge>
              <UBadge
                v-if="pod.restarts > 0"
                :color="pod.restarts > 5 ? 'error' : 'warning'"
                variant="subtle"
                size="xs"
              >
                {{ pod.restarts }} restart{{ pod.restarts > 1 ? 's' : '' }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
