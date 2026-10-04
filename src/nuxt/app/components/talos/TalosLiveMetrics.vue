<script setup lang="ts">
interface MetricPoint {
  timestamp: number
  cpu: number
  memory: number
  memoryUsed: number
  memoryTotal: number
  diskRead: number
  diskWrite: number
  networkRx: number
  networkTx: number
}

interface NodeMetrics {
  nodeId: string
  hostname: string
  current: MetricPoint
  history: MetricPoint[]
}

interface MetricsResponse {
  timestamp: number
  nodes: NodeMetrics[]
}

const props = defineProps<{
  nodeId: string
}>()

const { data, pending, refresh } = await useAsyncData<MetricsResponse>(
  `talos-metrics-${props.nodeId}`,
  () => $fetch('/api/talos/metrics'),
  {
    server: false,
    default: () => ({ timestamp: 0, nodes: [] }),
  },
)

const selectedMetric = ref<'cpu' | 'memory' | 'disk' | 'network'>('cpu')

const nodeMetrics = computed(() => {
  return data.value?.nodes.find(n => n.nodeId === props.nodeId)
})

const history = computed(() => {
  return nodeMetrics.value?.history || []
})

const currentValues = computed(() => {
  const m = nodeMetrics.value?.current
  if (!m) return null

  return {
    cpu: m.cpu,
    memory: m.memory,
    memoryUsed: m.memoryUsed,
    memoryTotal: m.memoryTotal,
    diskRead: m.diskRead,
    diskWrite: m.diskWrite,
    networkRx: m.networkRx,
    networkTx: m.networkTx,
  }
})

// Chart dimensions
const CHART_HEIGHT = 120
const CHART_PADDING = { top: 10, right: 10, bottom: 20, left: 40 }

const chartPoints = computed(() => {
  if (history.value.length === 0) return []

  const width = 400 // Will be adjusted by CSS
  const chartWidth = width - CHART_PADDING.left - CHART_PADDING.right
  const chartHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom

  return history.value.map((point, index) => {
    const x = CHART_PADDING.left + (index / (history.value.length - 1 || 1)) * chartWidth
    let value = 0

    switch (selectedMetric.value) {
      case 'cpu':
        value = point.cpu
        break
      case 'memory':
        value = point.memory
        break
      case 'disk':
        value = Math.min(100, ((point.diskRead + point.diskWrite) / 2000) * 100)
        break
      case 'network':
        value = Math.min(100, ((point.networkRx + point.networkTx) / 200000) * 100)
        break
    }

    const y = CHART_PADDING.top + chartHeight - (value / 100) * chartHeight
    return { x, y, value: Math.round(value) }
  })
})

const areaPath = computed(() => {
  if (chartPoints.value.length === 0) return ''

  const width = 400
  const chartWidth = width - CHART_PADDING.left - CHART_PADDING.right
  const chartHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
  const bottom = CHART_HEIGHT - CHART_PADDING.bottom

  let path = `M ${CHART_PADDING.left} ${bottom}`

  for (const point of chartPoints.value) {
    path += ` L ${point.x} ${point.y}`
  }

  path += ` L ${CHART_PADDING.left + chartWidth} ${bottom} Z`
  return path
})

const linePath = computed(() => {
  if (chartPoints.value.length === 0) return ''

  let path = `M ${chartPoints.value[0].x} ${chartPoints.value[0].y}`

  for (let i = 1; i < chartPoints.value.length; i++) {
    path += ` L ${chartPoints.value[i].x} ${chartPoints.value[i].y}`
  }

  return path
})

const yAxisTicks = computed(() => {
  return [100, 75, 50, 25, 0].map(value => {
    const chartHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
    const y = CHART_PADDING.top + chartHeight - (value / 100) * chartHeight
    return { value, y }
  })
})

const metricColor = computed(() => {
  switch (selectedMetric.value) {
    case 'cpu': return 'var(--color-primary-500, #22c55e)'
    case 'memory': return 'var(--color-secondary-500, #3b82f6)'
    case 'disk': return 'var(--color-warning-500, #f59e0b)'
    case 'network': return 'var(--color-error-500, #ef4444)'
    default: return '#22c55e'
  }
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function getCurrentValue(): string {
  const v = currentValues.value
  if (!v) return 'N/A'

  switch (selectedMetric.value) {
    case 'cpu': return `${v.cpu}%`
    case 'memory': return `${v.memory}% (${v.memoryUsed.toFixed(1)} / ${v.memoryTotal.toFixed(1)} GB)`
    case 'disk': return `R: ${formatBytes(v.diskRead)}/s, W: ${formatBytes(v.diskWrite)}/s`
    case 'network': return `↓ ${formatBytes(v.networkRx)}/s, ↑ ${formatBytes(v.networkTx)}/s`
    default: return 'N/A'
  }
}

// Auto-refresh every 5 seconds
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  refreshInterval.value = setInterval(refresh, 5000)
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-activity" class="size-4" />
          <span class="font-medium">Live Metrics</span>
        </div>
        <div class="flex items-center gap-1">
          <USelect
            v-model="selectedMetric"
            :options="[
              { label: 'CPU', value: 'cpu' },
              { label: 'Memory', value: 'memory' },
              { label: 'Disk', value: 'disk' },
              { label: 'Network', value: 'network' },
            ]"
            size="xs"
            class="w-28"
          />
        </div>
      </div>
    </template>

    <div v-if="pending && !data?.nodes.length" class="flex items-center justify-center h-32">
      <UIcon name="i-lucide-loader" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else class="space-y-3">
      <!-- Current value -->
      <div class="text-center">
        <span class="text-2xl font-bold" :style="{ color: metricColor }">
          {{ getCurrentValue() }}
        </span>
      </div>

      <!-- Chart -->
      <div class="relative">
        <svg
          :viewBox="`0 0 400 ${CHART_HEIGHT}`"
          class="w-full h-32"
          preserveAspectRatio="none"
        >
          <!-- Grid lines -->
          <g class="stroke-muted/30" stroke-dasharray="4">
            <line
              v-for="tick in yAxisTicks"
              :key="tick.value"
              :x1="CHART_PADDING.left"
              :x2="400 - CHART_PADDING.right"
              :y1="tick.y"
              :y2="tick.y"
            />
          </g>

          <!-- Y-axis labels -->
          <g class="fill-muted text-xs font-medium">
            <text
              v-for="tick in yAxisTicks"
              :key="tick.value"
              :x="CHART_PADDING.left - 8"
              :y="tick.y"
              text-anchor="end"
              dominant-baseline="central"
            >
              {{ tick.value }}
            </text>
          </g>

          <!-- Area fill -->
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :style="{ stopColor: metricColor }" stop-opacity="0.4" />
              <stop offset="100%" :style="{ stopColor: metricColor }" stop-opacity="0.05" />
            </linearGradient>
          </defs>
          <path
            :d="areaPath"
            fill="url(#chartGradient)"
            class="transition-all duration-300"
          />

          <!-- Line -->
          <path
            :d="linePath"
            fill="none"
            :stroke="metricColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all duration-300"
          />
        </svg>

        <!-- Legend -->
        <div class="flex justify-center gap-4 mt-2 text-xs text-muted">
          <span>Last {{ history.length }} readings</span>
          <span>5s interval</span>
        </div>
      </div>
    </div>
  </UCard>
</template>
