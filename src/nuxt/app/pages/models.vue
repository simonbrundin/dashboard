<script setup lang="ts">
import type { ModelData } from '~/data/models'

// State
const selectedCategory = ref<'all' | 'frontier' | 'high' | 'mid' | 'budget'>('all')
const sortBy = ref<'value' | 'intelligence' | 'cost' | 'speed'>('value')
const sortDirection = ref<'asc' | 'desc'>('desc')
const showOnlyOpenWeights = ref(false)
const isRefreshing = ref(false)
const lastError = ref<string | null>(null)

// Composables
const { modelsData, metaData, fetchModels, getStats, modelsWithCost, modelsWithoutCost, totalInDb } = useModels()
const progress = useProgress()
const actions = useModelActions(modelsData, fetchModels)

// Computed
const filteredModels = computed(() => {
  let models = modelsData.value

  if (selectedCategory.value !== 'all') {
    models = models.filter((m) => m.category === selectedCategory.value)
  }

  if (showOnlyOpenWeights.value) {
    models = models.filter((m) => m.openWeights)
  }

  return models
})

const sortedModels = computed(() => {
  const models = [...filteredModels.value]
  const dir = sortDirection.value === 'desc' ? -1 : 1

  switch (sortBy.value) {
    case 'value':
      return models.sort((a, b) => {
        const aCost = a.costPerTask ?? 0
        const bCost = b.costPerTask ?? 0
        if (aCost === 0 && bCost === 0) return 0
        if (aCost === 0) return -1 * dir
        if (bCost === 0) return 1 * dir
        const aRatio = a.intelligenceIndex / aCost
        const bRatio = b.intelligenceIndex / bCost
        return (bRatio - aRatio) * dir
      })
    case 'intelligence':
      return models.sort((a, b) => (b.intelligenceIndex - a.intelligenceIndex) * dir)
    case 'cost':
      return models.sort((a, b) => {
        const aCost = a.costPerTask ?? 0
        const bCost = b.costPerTask ?? 0
        return (aCost - bCost) * dir
      })
    case 'speed':
      return models.sort((a, b) => ((b.speed || 0) - (a.speed || 0)) * dir)
    default:
      return models
  }
})

function handleSort(column: 'value' | 'intelligence' | 'cost' | 'speed') {
  if (sortBy.value === column) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortBy.value = column
    sortDirection.value = 'desc'
  }
}

const categoryStats = computed(() => ({
  all: modelsData.value.length,
  frontier: modelsData.value.filter((m) => m.category === 'frontier').length,
  high: modelsData.value.filter((m) => m.category === 'high').length,
  mid: modelsData.value.filter((m) => m.category === 'mid').length,
  budget: modelsData.value.filter((m) => m.category === 'budget').length,
  openWeights: modelsData.value.filter((m) => m.openWeights).length
}))

// Best value models (top 3)
const bestValueModels = computed(() => {
  return [...modelsData.value]
    .filter(m => {
      const cost = m.costPerTask ?? 0
      return cost > 0
    })
    .sort((a, b) => {
      const aCost = a.costPerTask ?? 0
      const bCost = b.costPerTask ?? 0
      const aRatio = a.intelligenceIndex / aCost
      const bRatio = b.intelligenceIndex / bCost
      return bRatio - aRatio
    })
    .slice(0, 3)
})

// Top intelligence models
const topIntelligenceModels = computed(() => {
  return [...modelsData.value]
    .sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)
    .slice(0, 1)
})

// Lowest cost models
const lowestCostModels = computed(() => {
  return [...modelsData.value]
    .filter(m => {
      const cost = m.costPerTask ?? 0
      return cost > 0
    })
    .sort((a, b) => {
      const aCost = a.costPerTask ?? 0
      const bCost = b.costPerTask ?? 0
      return aCost - bCost
    })
    .slice(0, 1)
})

// Pareto optimal models (best in each category)
const paretoOptimalModels = computed(() => {
  const pareto: ModelData[] = []
  
  for (const model of modelsData.value) {
    const modelCost = model.costPerTask ?? 0
    const isDominated = modelsData.value.some(other => {
      const otherCost = other.costPerTask ?? 0
      return otherCost <= modelCost &&
             other.intelligenceIndex >= model.intelligenceIndex &&
             (otherCost < modelCost || other.intelligenceIndex > model.intelligenceIndex)
    })
    if (!isDominated) {
      pareto.push(model)
    }
  }
  
  return pareto
    .sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)
    .slice(0, 6)
})

// Methods
function getCategoryColor(category: string) {
  const colors = {
    frontier: 'text-purple-500 bg-purple-500/10',
    high: 'text-blue-500 bg-blue-500/10',
    mid: 'text-green-500 bg-green-500/10',
    budget: 'text-amber-500 bg-amber-500/10'
  }
  return colors[category as keyof typeof colors] || 'text-gray-500 bg-gray-500/10'
}

function getValueRating(ratio: number | undefined): { stars: number; label: string } {
  if (ratio === undefined || !isFinite(ratio)) return { stars: 5, label: 'Free' }
  if (ratio >= 200) return { stars: 5, label: 'Excellent' }
  if (ratio >= 100) return { stars: 4, label: 'Great' }
  if (ratio >= 50) return { stars: 3, label: 'Good' }
  if (ratio >= 25) return { stars: 2, label: 'Fair' }
  return { stars: 1, label: 'Basic' }
}

function formatCost(cost: number | string): string {
  const numCost = typeof cost === 'string' ? parseFloat(cost) : cost
  if (isNaN(numCost) || numCost === 0) return 'Free'
  if (numCost < 0.01) return `$${numCost.toFixed(3)}/task`
  if (numCost < 0.1) return `$${numCost.toFixed(2)}/task`
  if (numCost < 1) return `$${numCost.toFixed(2)}/task`
  if (numCost < 10) return `$${numCost.toFixed(1)}/task`
  return `$${numCost.toFixed(0)}/task`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

// Fetch on mount
onMounted(async () => {
  await fetchModels()
  
  // Check if we need to import more models
  try {
    const stats = await getStats()
    if (stats.needsImport) {
      console.log(`AA has ${stats.aaTotal} models, DB has ${stats.dbTotal}. Starting auto-import...`)
      await actions.fetchMorePrices()
    }
  } catch (error) {
    console.error('Failed to check stats:', error)
  }
})

// Head
useHead({
  title: 'AI Model Value Comparison | Dashboard',
  meta: [
    {
      name: 'description',
      content: 'Compare AI models by Intelligence Index vs Cost per Task. Find the best value models based on artificialanalysis.ai data.'
    }
  ]
})

useSeoMeta({
  title: 'AI Model Value Comparison',
  description: 'Compare AI models by Intelligence Index vs Cost per Task. Find the best value models.',
  ogTitle: 'AI Model Value Comparison',
  ogDescription: 'Find the most cost-effective AI models based on Intelligence Index.'
})
</script>

<template>
  <UDashboardPanel id="models">
    <template #header>
      <UDashboardNavbar title="AI Model Value Comparison">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <UButton
            variant="outline"
            size="sm"
            icon="i-lucide-download"
            @click="actions.importModels"
          >
            Importera ({{ totalInDb }})
          </UButton>
          <UButton
            v-if="modelsWithoutCost.length > 0"
            variant="outline"
            size="sm"
            :loading="progress.show"
            icon="i-lucide-plus"
            @click="actions.fetchMorePrices"
          >
            Fler ({{ modelsWithoutCost.length }})
          </UButton>
          <UButton
            variant="outline"
            size="sm"
            :loading="progress.show"
            icon="i-lucide-refresh-cw"
            @click="actions.refreshPrices"
          >
            Uppdatera priser ({{ modelsWithCost.length }})
          </UButton>
          <UButton
            variant="ghost"
            size="sm"
            :href="'https://artificialanalysis.ai/models'"
            target="_blank"
            icon="i-lucide-external-link"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6">
        <!-- Header Info -->
        <div class="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4 border border-primary/20">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="p-2 rounded-lg bg-primary/20">
                <UIcon name="i-lucide-brain" class="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 class="font-semibold text-lg">
                  Intelligence Index vs. Cost per Task
                </h2>
                <p class="text-sm text-muted-foreground mt-1">
                  <span class="font-semibold">{{ totalInDb }}</span> modeller i databasen.
                  <span v-if="modelsWithCost.length > 0"> ({{ modelsWithCost.length }} med pris)</span>
                  <span v-if="modelsWithoutCost.length > 0">
                    , {{ modelsWithoutCost.length }} utan pris
                  </span>
                </p>
                <p v-if="metaData?.updatedAt" class="text-xs text-muted-foreground mt-1">
                  Last updated: {{ formatDate(metaData.updatedAt) }}
                </p>
              </div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold">{{ totalInDb }}</div>
              <div class="text-xs text-muted-foreground">I databasen</div>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="progress.show" class="bg-primary/10 rounded-lg p-4 border border-primary/20">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin text-primary" />
              <span class="text-sm font-medium">Hämtar modeller...</span>
            </div>
            <div class="text-right">
              <span class="text-sm font-semibold">{{ progress.current.value }} / {{ progress.total.value }}</span>
              <span class="text-xs text-muted-foreground ml-2">{{ progress.timeRemaining.value }}</span>
            </div>
          </div>
          <div class="h-2 bg-primary/20 rounded-full overflow-hidden">
            <div 
              class="h-full bg-primary transition-all duration-300 rounded-full"
              :style="{ width: `${progress.percent.value}%` }"
            />
          </div>
        </div>

        <!-- Error Message -->
        <UAlert v-if="lastError" color="error" variant="soft" title="Error">
          {{ lastError }}
          <template #footer>
            <UButton size="xs" variant="outline" color="error" @click="lastError = null">
              Dismiss
            </UButton>
          </template>
        </UAlert>

        <!-- No Data Message -->
        <UCard v-if="modelsData.length === 0 && !lastError" class="text-center py-12">
          <div class="flex flex-col items-center gap-4">
            <UIcon name="i-lucide-database" class="w-12 h-12 text-muted-foreground" />
            <div>
              <p class="font-semibold text-lg">No Data Available</p>
              <p class="text-sm text-muted-foreground mt-1">
                Click "Scrape Data" to fetch the latest models from Artificial Analysis.
              </p>
            </div>
            <UButton
              :loading="progress.show"
              icon="i-lucide-refresh-cw"
              @click="actions.fetchMorePrices"
            >
              Update Data
            </UButton>
          </div>
        </UCard>

        <!-- Filters -->
        <div v-if="modelsData.length > 0" class="flex flex-wrap items-center gap-4">
          <!-- Category Filter -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Category:</span>
            <div class="flex gap-1">
              <UButton
                v-for="cat in ['all', 'frontier', 'high', 'mid', 'budget'] as const"
                :key="cat"
                :variant="selectedCategory === cat ? 'solid' : 'outline'"
                :color="selectedCategory === cat ? 'primary' : 'neutral'"
                size="xs"
                @click="selectedCategory = cat"
              >
                {{ cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1) }}
                <span class="ml-1 opacity-60">({{ cat === 'all' ? categoryStats.all : categoryStats[cat] }})</span>
              </UButton>
            </div>
          </div>

          <!-- Sort -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Sort by:</span>
            <USelect
              v-model="sortBy"
              :options="[
                { value: 'value', label: 'Best Value (Int/Cost)' },
                { value: 'intelligence', label: 'Intelligence Index' },
                { value: 'cost', label: 'Lowest Cost' },
                { value: 'speed', label: 'Fastest Speed' }
              ]"
              size="xs"
              class="w-48"
            />
          </div>

          <!-- Open Weights Toggle -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="relative inline-flex h-5 w-9 items-center rounded-full bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :class="{ 'bg-primary': showOnlyOpenWeights }"
              @click="showOnlyOpenWeights = !showOnlyOpenWeights"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                :class="{ 'translate-x-4': showOnlyOpenWeights, 'translate-x-0': !showOnlyOpenWeights }"
              />
            </button>
            <span class="text-sm text-muted-foreground">Open weights only</span>
            <span class="text-xs text-muted-foreground">({{ categoryStats.openWeights }} models)</span>
          </div>
        </div>

        <!-- Stats Cards -->
        <div v-if="modelsData.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Best Value Card -->
          <UCard class="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <div class="flex items-center gap-3">
              <div class="p-3 rounded-xl bg-green-500/20">
                <UIcon name="i-lucide-trophy" class="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Best Value Model</p>
                <a
                  v-if="bestValueModels[0]"
                  :href="`https://artificialanalysis.ai/models/${bestValueModels[0].slug}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-bold text-lg hover:underline hover:text-primary"
                >
                  {{ bestValueModels[0].name }}
                </a>
                <p class="text-sm text-green-500">
                  Ratio: {{ bestValueModels[0] ? (bestValueModels[0].intelligenceIndex / (bestValueModels[0].costPerTask ?? 1)).toFixed(0) : 0 }}x
                </p>
              </div>
            </div>
          </UCard>

          <!-- Top Intelligence Card -->
          <UCard class="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <div class="flex items-center gap-3">
              <div class="p-3 rounded-xl bg-purple-500/20">
                <UIcon name="i-lucide-cpu" class="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Highest Intelligence</p>
                <a
                  v-if="topIntelligenceModels[0]"
                  :href="`https://artificialanalysis.ai/models/${topIntelligenceModels[0].slug}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-bold text-lg hover:underline hover:text-primary"
                >
                  {{ topIntelligenceModels[0].name }}
                </a>
                <p class="text-sm text-purple-500">
                  Index: {{ topIntelligenceModels[0]?.intelligenceIndex }}
                </p>
              </div>
            </div>
          </UCard>

          <!-- Lowest Cost Card -->
          <UCard class="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <div class="flex items-center gap-3">
              <div class="p-3 rounded-xl bg-amber-500/20">
                <UIcon name="i-lucide-coins" class="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Lowest Cost per Task</p>
                <a
                  v-if="lowestCostModels[0]"
                  :href="`https://artificialanalysis.ai/models/${lowestCostModels[0].slug}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-bold text-lg hover:underline hover:text-primary"
                >
                  {{ lowestCostModels[0].name }}
                </a>
                <p class="text-sm text-amber-500">
                  {{ formatCost(lowestCostModels[0]?.costPerTask || 0) }}/task
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Pareto Optimal Section -->
        <div v-if="paretoOptimalModels.length > 0">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-lucide-star" class="w-5 h-5 text-primary" />
            <h3 class="font-semibold text-lg">Top Models</h3>
            <UBadge variant="subtle" color="primary" size="sm">Best in Class</UBadge>
          </div>
          <div class="flex flex-wrap gap-2">
            <UCard v-for="model in paretoOptimalModels" :key="model.id" class="min-w-[200px] flex-1">
              <div class="flex items-center gap-2 mb-2">
                <a
                  :href="`https://artificialanalysis.ai/models/${model.slug}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-sm truncate hover:underline hover:text-primary"
                >
                  {{ model.name }}
                </a>
                <UBadge :class="getCategoryColor(model.category)" size="xs">
                  {{ model.category }}
                </UBadge>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span class="text-muted-foreground">Intelligence:</span>
                  <span class="font-semibold ml-1">{{ model.intelligenceIndex }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Cost:</span>
                  <span class="font-semibold ml-1">{{ formatCost(model.costPerTask) }}</span>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Full Comparison Table -->
        <div v-if="sortedModels.length > 0">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-lg">Full Model Comparison</h3>
            <span class="text-sm text-muted-foreground">
              Showing {{ sortedModels.length }} models
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-border">
                  <th class="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                  <th class="text-center py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none" @click="handleSort('value')">
                    <span class="flex items-center justify-center gap-1">
                      Value
                      <UIcon v-if="sortBy === 'value'" :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'" class="w-4 h-4" />
                    </span>
                  </th>
                  <th class="text-center py-3 px-4 font-medium text-muted-foreground">Category</th>
                  <th class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none" @click="handleSort('intelligence')">
                    <span class="flex items-center justify-end gap-1">
                      Intelligence
                      <UIcon v-if="sortBy === 'intelligence'" :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'" class="w-4 h-4" />
                    </span>
                  </th>
                  <th class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none" @click="handleSort('cost')">
                    <span class="flex items-center justify-end gap-1">
                      Cost/Task
                      <UIcon v-if="sortBy === 'cost'" :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'" class="w-4 h-4" />
                    </span>
                  </th>
                  <th class="text-right py-3 px-4 font-medium text-muted-foreground">Ratio</th>
                  <th class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none" @click="handleSort('speed')">
                    <span class="flex items-center justify-end gap-1">
                      Speed
                      <UIcon v-if="sortBy === 'speed'" :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'" class="w-4 h-4" />
                    </span>
                  </th>
                  <th class="text-center py-3 px-4 font-medium text-muted-foreground">Open</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(model, index) in sortedModels"
                  :key="model.id"
                  class="border-b border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                      <span v-if="index < 3" class="text-lg">
                        {{ index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉' }}
                      </span>
                      <div>
                        <a
                          :href="`https://artificialanalysis.ai/models/${model.slug}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="font-medium hover:underline hover:text-primary"
                        >
                          {{ model.name }}
                        </a>
                        <p class="text-xs text-muted-foreground">{{ model.provider }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4 text-center">
                    <UBadge :class="getCategoryColor(model.category)" size="sm">
                      {{ model.category }}
                    </UBadge>
                  </td>
                  <td class="py-4 px-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <span class="font-bold">{{ model.intelligenceIndex }}</span>
                      <div class="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          class="h-full bg-primary rounded-full"
                          :style="{ width: `${Math.min((model.intelligenceIndex / 70) * 100, 100)}%` }"
                        />
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4 text-right">
                    <span class="font-mono">{{ formatCost(model.costPerTask) }}</span>
                  </td>
                  <td class="py-4 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <span v-if="(model.costPerTask ?? 0) === 0" class="text-sm font-semibold text-green-500">
                        Free
                      </span>
                      <template v-else>
                        <div class="flex items-center gap-1">
                          <span v-for="n in 5" :key="n" class="text-primary">
                            {{ n <= Math.round(getValueRating(model.intelligenceIndex / (model.costPerTask ?? 1)).stars) ? '★' : '☆' }}
                          </span>
                        </div>
                        <span class="text-sm font-semibold text-primary">
                          {{ (model.intelligenceIndex / (model.costPerTask ?? 1)).toFixed(0) }}x
                        </span>
                      </template>
                    </div>
                  </td>
                  <td class="py-4 px-4 text-right text-sm">
                    <span v-if="model.speed">{{ model.speed }} t/s</span>
                    <span v-else class="text-muted-foreground">—</span>
                  </td>
                  <td class="py-4 px-4 text-center">
                    <UIcon
                      v-if="model.openWeights"
                      name="i-lucide-check"
                      class="w-4 h-4 text-green-500"
                    />
                    <UIcon
                      v-else
                      name="i-lucide-x"
                      class="w-4 h-4 text-muted-foreground"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Methodology Note -->
        <UCard v-if="modelsData.length > 0" class="bg-muted/50">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-info" class="w-5 h-5 text-muted-foreground mt-0.5" />
            <div class="text-sm text-muted-foreground">
              <p class="font-medium text-foreground mb-1">Methodology</p>
              <p>
                Intelligence Index is a weighted composite score from Artificial Analysis,
                incorporating multiple benchmark evaluations.
              </p>
              <p class="mt-2">
                Cost per task is calculated from input and output token pricing.
              </p>
              <p class="mt-2 text-xs">
                Data provided by
                <a href="https://artificialanalysis.ai/" target="_blank" class="text-primary hover:underline">
                  Artificial Analysis
                </a>.
                Pricing and model availability change rapidly.
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
/* Ensure table doesn't overflow */
table {
  min-width: 100%;
}
</style>
