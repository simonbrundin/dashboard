<script setup lang="ts">
import { format, parseISO } from 'date-fns'

interface TokenUsageData {
  percentageRemaining: number
  remainingHours: number
  remainingMinutes: number
  intervalEnd: string | null
  modelName: string
}

const _width = useElementSize(useTemplateRef<HTMLElement | null>('cardRef'))

// State
const usageData = ref<TokenUsageData | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

// Hämta data från API
const fetchTokenUsage = async () => {
  isLoading.value = true
  error.value = null

  try {
    const data = await $fetch<TokenUsageData>('/api/minimax-token-usage')
    usageData.value = data
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
  if (pct > 50) return 'var(--ui-primary)'
  if (pct > 20) return 'orange'
  return 'red'
})
</script>

<template>
  <div class="max-w-md">
    <UCard ref="cardRef">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon
              name="i-simple-icons-minimax"
              class="size-5 text-[#24c8a8]"
            />
            <div>
              <p class="text-xs text-muted">
                MinMax Tokens
              </p>
              <template v-if="isLoading && !usageData">
                <p class="text-lg font-semibold animate-pulse">
                  --
                </p>
              </template>
              <template v-else-if="error">
                <p class="text-lg font-semibold text-red-500">
                  Fel
                </p>
              </template>
              <template v-else>
                <p class="text-lg font-semibold">
                  {{ currentPercentage }}%
                </p>
              </template>
            </div>
          </div>

          <div class="text-right">
            <p class="text-xs text-muted">
              Kvar
            </p>
            <p class="font-medium">
              {{ formattedRemainingTime }}
            </p>
            <p
              v-if="formattedIntervalEnd"
              class="text-xs text-muted"
            >
              Intervall slut {{ formattedIntervalEnd }}
            </p>
          </div>
        </div>
      </template>

      <div v-if="isLoading && !usageData" class="py-2">
        <div class="h-2 bg-muted rounded-full animate-pulse" />
      </div>
      <div v-else-if="error" class="py-2 text-center text-sm text-red-500">
        {{ error }}
      </div>
      <div v-else>
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
  </div>
</template>
