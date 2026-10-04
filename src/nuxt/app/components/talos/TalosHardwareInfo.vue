<script setup lang="ts">
interface Processor {
  model: string
  cores: number
  frequency: string
}

interface MemoryModule {
  size: string
  speed: string
  type: string
}

interface NetworkInterface {
  name: string
  mac: string
  ip: string
  status: string
}

interface Disk {
  name: string
  size: string
  type: string
  vendor: string
}

interface HardwareInfo {
  hostname: string
  hardware: {
    processors: Processor[]
    memory: {
      total: string
      modules: MemoryModule[]
    }
    network: {
      interfaces: NetworkInterface[]
    }
    disks: Disk[]
  }
}

const props = defineProps<{
  nodeId: string
}>()

const { data, pending, refresh } = await useAsyncData<HardwareInfo>(
  `talos-hardware-${props.nodeId}`,
  () => $fetch(`/api/talos/hardware?node=${props.nodeId}`),
  {
    server: false,
    default: () => ({
      hostname: '',
      hardware: {
        processors: [],
        memory: { total: 'N/A', modules: [] },
        network: { interfaces: [] },
        disks: [],
      },
    }),
  },
)

const hasHardwareData = computed(() => {
  return data.value &&
    (data.value.hardware.processors.length > 0 ||
      data.value.hardware.disks.length > 0 ||
      data.value.hardware.network.interfaces.length > 0)
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-cpu" class="size-4" />
          <span class="font-medium">Hardware Info</span>
        </div>
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
    </template>

    <div v-if="pending && !hasHardwareData" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else-if="!hasHardwareData" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-info" class="size-8 mb-2 mx-auto" />
      <p>No hardware information available</p>
      <p class="text-xs mt-1">Connect to node to retrieve hardware details</p>
    </div>

    <div v-else class="space-y-4">
      <!-- Processors -->
      <div v-if="data?.hardware.processors.length">
        <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
          <UIcon name="i-lucide-microchip" class="size-4" />
          Processors
        </h4>
        <div class="space-y-2">
          <div
            v-for="(cpu, index) in data.hardware.processors"
            :key="index"
            class="p-2 rounded bg-muted/50"
          >
            <div class="font-medium text-sm">{{ cpu.model }}</div>
            <div class="text-xs text-muted mt-1">
              <span v-if="cpu.cores">{{ cpu.cores }} cores</span>
              <span v-if="cpu.frequency"> · {{ cpu.frequency }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Memory -->
      <div v-if="data?.hardware.memory">
        <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
          <UIcon name="i-lucide-memory-stick" class="size-4" />
          Memory
        </h4>
        <div class="p-2 rounded bg-muted/50">
          <div class="flex items-center justify-between">
            <span class="text-sm">Total</span>
            <span class="font-medium">{{ data.hardware.memory.total }}</span>
          </div>
          <div v-if="data.hardware.memory.modules.length" class="mt-2 space-y-1">
            <div
              v-for="(mod, index) in data.hardware.memory.modules"
              :key="index"
              class="text-xs text-muted"
            >
              {{ mod.size }} {{ mod.type }} {{ mod.speed ? `(${mod.speed})` : '' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Network Interfaces -->
      <div v-if="data?.hardware.network.interfaces.length">
        <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
          <UIcon name="i-lucide-network" class="size-4" />
          Network
        </h4>
        <div class="space-y-2">
          <div
            v-for="(iface, index) in data.hardware.network.interfaces"
            :key="index"
            class="p-2 rounded bg-muted/50"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium text-sm flex items-center gap-2">
                {{ iface.name }}
                <UBadge
                  :color="iface.status === 'UP' ? 'success' : 'neutral'"
                  variant="subtle"
                  size="xs"
                >
                  {{ iface.status }}
                </UBadge>
              </span>
              <span class="text-xs font-mono">{{ iface.ip }}</span>
            </div>
            <div class="text-xs text-muted mt-1 font-mono">
              {{ iface.mac }}
            </div>
          </div>
        </div>
      </div>

      <!-- Disks -->
      <div v-if="data?.hardware.disks.length">
        <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
          <UIcon name="i-lucide-hard-drive" class="size-4" />
          Disks
        </h4>
        <div class="space-y-2">
          <div
            v-for="(disk, index) in data.hardware.disks"
            :key="index"
            class="p-2 rounded bg-muted/50"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium text-sm">{{ disk.name }}</span>
              <span class="text-sm">{{ disk.size }}</span>
            </div>
            <div class="text-xs text-muted mt-1">
              <span v-if="disk.vendor && disk.vendor !== 'Unknown'">{{ disk.vendor }}</span>
              <span v-if="disk.type && disk.type !== 'Unknown'"> · {{ disk.type }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
