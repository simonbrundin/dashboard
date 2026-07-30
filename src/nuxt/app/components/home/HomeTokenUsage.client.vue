<script setup lang="ts">
import { format, parseISO } from 'date-fns'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'

interface TokenUsageData {
  percentageRemaining: number
  remainingHours: number
  remainingMinutes: number
  intervalEnd: string | null
  modelName: string
}

interface DataPoint {
  time: string
  percentage: number
}

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

// State
const usageData = ref<TokenUsageData | null>(null)
const historicalData = ref<DataPoint[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Hämta data från API
const fetchTokenUsage = async () => {
  isLoading.value = true
  error.value = null

  try {
    const data = await $fetch<TokenUsageData>('/api/minimax-token-usage')
    usageData.value = data

    // Lägg till aktuell punkt i historiken
    const now = new Date()
    historicalData.value = [
      ...historicalData.value.slice(-11), // Behåll max 12 punkter
      {
        time: format(now, 'HH:mm'),
        percentage: data.percentageRemaining
      }
    ]
  } catch (e: unknown) {
    const err = e as { message?: string }
    error.value = err.message || 'Kunde inte hämta data'
    console.error('Failed to fetch token usage:', e)
  } finally {
    isLoading.value = false
  }
}

// Auto-refresh var 60:e sekund
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  fetchTokenUsage()
  refreshInterval.value = setInterval(fetchTokenUsage, 60 * 1000)
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})

// Beräkna procent
const currentPercentage = computed(() => {
  return usageData.value?.percentageRemaining ?? 0
})

// Formatera återstående tid
const formattedRemainingTime = computed(() => {
  if (!usageData.value) return '--'
  const { remainingHours, remainingMinutes } = usageData.value
  if (remainingHours >= 1) {
    return `${remainingHours}h ${remainingMinutes}m`
  }
  return `${remainingMinutes}m`
})

// Formatera slutet av intervall
const formattedIntervalEnd = computed(() => {
  if (!usageData.value?.intervalEnd) return null
  try {
    return format(parseISO(usageData.value.intervalEnd), 'HH:mm')
  } catch {
    return null
  }
})

// Färg baserat på procent
const progressColor = computed(() => {
  const pct = currentPercentage.value
  if (pct > 50) return 'var(--ui-primary)' // Grön
  if (pct > 20) return 'orange' // Orange
  return 'red' // Röd
})

// X/Y mappers för grafen
const x = (_: DataPoint, i: number) => i
const y = (d: DataPoint) => d.percentage

const xTicks = (i: number) => {
  if (i === 0 || i === historicalData.value.length - 1 || !historicalData.value[i]) {
    return ''
  }
  return historicalData.value[i].time
}

const template = (d: DataPoint) => `${d.time}: ${d.percentage.toFixed(1)}% kvar`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <div class="flex items-start justify-between">
        <div>
          <p class="text-xs text-muted uppercase mb-1.5">
            MinMax Token-användning
          </p>

          <template v-if="isLoading && !usageData">
            <p class="text-3xl text-highlighted font-semibold animate-pulse">
              ---
            </p>
          </template>
          <template v-else-if="error">
            <p class="text-3xl text-red-500 font-semibold">
              Fel
            </p>
            <p class="text-sm text-red-400/70 mt-1">
              {{ error }}
            </p>
          </template>
          <template v-else>
            <p class="text-3xl text-highlighted font-semibold">
              {{ currentPercentage }}%
            </p>
          </template>

          <p class="text-sm text-muted mt-1">
            {{ formattedRemainingTime }} kvar
          </p>
        </div>

        <div class="flex gap-2">
          <UTooltip :text="isLoading ? 'Laddar...' : 'Uppdatera'">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              square
              :icon="isLoading ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw'"
              :loading="isLoading"
              @click="fetchTokenUsage"
            />
          </UTooltip>
        </div>
      </div>

      <div v-if="formattedIntervalEnd" class="mt-3 flex items-center gap-4 text-xs text-muted">
        <div class="flex items-center gap-1.5">
          <UIcon name="i-lucide-clock" class="size-3.5" />
          <span>Intervall slut: {{ formattedIntervalEnd }}</span>
        </div>
        <div v-if="usageData?.modelName" class="flex items-center gap-1.5">
          <UIcon name="i-lucide-cpu" class="size-3.5" />
          <span>{{ usageData.modelName }}</span>
        </div>
      </div>
    </template>

    <!-- Graf -->
    <VisXYContainer
      v-if="historicalData.length > 0"
      :data="historicalData"
      :padding="{ top: 40 }"
      :margin="{ left: -5, right: -5 }"
      class="h-64"
      :width="width"
    >
      <VisLine
        :x="x"
        :y="y"
        :color="progressColor"
      />
      <VisArea
        :x="x"
        :y="y"
        :color="progressColor"
        :opacity="0.1"
      />

      <VisAxis
        type="x"
        :x="x"
        :tick-format="xTicks"
      />

      <VisAxis
        type="y"
        :tick-format="(v: number) => `${v}%`"
        :domain="[0, 100]"
      />

      <VisCrosshair
        :color="progressColor"
        :template="template"
      />

      <VisTooltip />
    </VisXYContainer>

    <!-- Tom state -->
    <div v-else class="h-64 flex items-center justify-center text-muted">
      <div v-if="isLoading" class="flex items-center gap-2">
        <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
        <span>Hämtar data...</span>
      </div>
      <div v-else-if="error" class="flex items-center gap-2 text-red-500">
        <UIcon name="i-lucide-alert-circle" class="size-5" />
        <span>Kunde inte ladda data</span>
      </div>
      <div v-else class="flex items-center gap-2">
        <UIcon name="i-lucide-info" class="size-5" />
        <span>Ingen data tillgänglig</span>
      </div>
    </div>

    <!-- Progress bar under grafen -->
    <div class="px-4 mt-2">
      <div class="flex justify-between text-xs text-muted mb-1">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      <div class="h-2 bg-muted rounded-full overflow-hidden">
        <div
          class="h-full transition-all duration-500"
          :style="{
            width: `${currentPercentage}%`,
            backgroundColor: progressColor
          }"
        />
      </div>
    </div>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);

  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
