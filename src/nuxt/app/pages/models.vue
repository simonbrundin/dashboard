<script setup lang="ts">
import { modelsData, bestValueModels, topIntelligenceModels, lowestCostModels, paretoOptimalModels, providerLogos } from '~/data/models'

// State
const selectedCategory = ref<'all' | 'frontier' | 'high' | 'mid' | 'budget'>('all')
const sortBy = ref<'value' | 'intelligence' | 'cost'>('value')
const showOnlyOpenWeights = ref(false)

// Computed
const filteredModels = computed(() => {
  let models = modelsData

  if (selectedCategory.value !== 'all') {
    models = models.filter((m) => m.category === selectedCategory.value)
  }

  if (showOnlyOpenWeights.value) {
    models = models.filter((m) => m.openWeights)
  }

  return models
})

const sortedModels = computed(() => {
  const models = [...filteredModels.value].filter((m) => m.costPerTask > 0)

  switch (sortBy.value) {
    case 'value':
      return models.sort((a, b) => {
        const aRatio = a.intelligenceIndex / a.costPerTask
        const bRatio = b.intelligenceIndex / b.costPerTask
        return bRatio - aRatio
      })
    case 'intelligence':
      return models.sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)
    case 'cost':
      return models.sort((a, b) => a.costPerTask - b.costPerTask)
    default:
      return models
  }
})

const categoryStats = computed(() => ({
  all: modelsData.length,
  frontier: modelsData.filter((m) => m.category === 'frontier').length,
  high: modelsData.filter((m) => m.category === 'high').length,
  mid: modelsData.filter((m) => m.category === 'mid').length,
  budget: modelsData.filter((m) => m.category === 'budget').length,
  openWeights: modelsData.filter((m) => m.openWeights).length
}))

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

function getValueRating(ratio: number): { stars: number; label: string } {
  if (ratio >= 200) return { stars: 5, label: 'Excellent' }
  if (ratio >= 100) return { stars: 4, label: 'Great' }
  if (ratio >= 50) return { stars: 3, label: 'Good' }
  if (ratio >= 25) return { stars: 2, label: 'Fair' }
  return { stars: 1, label: 'Basic' }
}

function formatCost(cost: number): string {
  if (cost === 0) return 'Free'
  if (cost < 0.01) return `$${cost.toFixed(3)}`
  if (cost < 1) return `$${cost.toFixed(2)}`
  return `$${cost.toFixed(2)}`
}

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
            :href="'https://artificialanalysis.ai/models'"
            target="_blank"
            icon="i-lucide-external-link"
          >
            Source: Artificial Analysis
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6">
        <!-- Header Info -->
        <div class="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4 border border-primary/20">
          <div class="flex items-start gap-3">
            <div class="p-2 rounded-lg bg-primary/20">
              <UIcon name="i-lucide-brain" class="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 class="font-semibold text-lg">
                Intelligence Index vs. Cost per Task
              </h2>
              <p class="text-sm text-muted-foreground mt-1">
                Data from Artificial Analysis Intelligence Index v4.3. Models ranked by
                <span class="font-semibold text-primary">Intelligence / Cost</span> ratio
                (higher is better value). Updated December 2025.
              </p>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-4">
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
                { value: 'cost', label: 'Lowest Cost' }
              ]"
              size="xs"
              class="w-48"
            />
          </div>

          <!-- Open Weights Toggle -->
          <div class="flex items-center gap-2">
            <UToggle v-model="showOnlyOpenWeights" size="xs" />
            <span class="text-sm text-muted-foreground">Open weights only</span>
            <span class="text-xs text-muted-foreground">({{ categoryStats.openWeights }} models)</span>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Best Value Card -->
          <UCard class="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <div class="flex items-center gap-3">
              <div class="p-3 rounded-xl bg-green-500/20">
                <UIcon name="i-lucide-trophy" class="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Best Value Model</p>
                <p class="font-bold text-lg">{{ bestValueModels[0]?.name }}</p>
                <p class="text-sm text-green-500">
                  Ratio: {{ bestValueModels[0] ? (bestValueModels[0].intelligenceIndex / bestValueModels[0].costPerTask).toFixed(0) : 0 }}x
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
                <p class="font-bold text-lg">{{ topIntelligenceModels[0]?.name }}</p>
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
                <p class="font-bold text-lg">{{ lowestCostModels[0]?.name }}</p>
                <p class="text-sm text-amber-500">
                  {{ formatCost(lowestCostModels[0]?.costPerTask || 0) }}/task
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Pareto Optimal Section -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-lucide-star" class="w-5 h-5 text-primary" />
            <h3 class="font-semibold text-lg">Pareto-Optimal Models</h3>
            <UBadge variant="subtle" color="primary" size="sm">Best in Class</UBadge>
          </div>
          <div class="flex flex-wrap gap-2">
            <UCard v-for="model in paretoOptimalModels" :key="model.id" class="min-w-[200px] flex-1">
              <div class="flex items-center gap-2 mb-2">
                <UIcon :name="providerLogos[model.providerLogo] || 'i-lucide-circle'" class="w-4 h-4" />
                <span class="font-medium text-sm truncate">{{ model.name }}</span>
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
        <div>
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
                  <th class="text-center py-3 px-4 font-medium text-muted-foreground">Category</th>
                  <th class="text-right py-3 px-4 font-medium text-muted-foreground">Intelligence</th>
                  <th class="text-right py-3 px-4 font-medium text-muted-foreground">Cost/Task</th>
                  <th class="text-right py-3 px-4 font-medium text-muted-foreground">Value Ratio</th>
                  <th class="text-right py-3 px-4 font-medium text-muted-foreground">Context</th>
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
                        <p class="font-medium">{{ model.name }}</p>
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
                          :style="{ width: `${(model.intelligenceIndex / 70) * 100}%` }"
                        />
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4 text-right font-mono">
                    {{ formatCost(model.costPerTask) }}
                  </td>
                  <td class="py-4 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <URating
                        :model-value="getValueRating(model.intelligenceIndex / model.costPerTask).stars"
                        :max="5"
                        size="xs"
                        readonly
                      />
                      <span class="text-sm font-semibold text-primary">
                        {{ (model.intelligenceIndex / model.costPerTask).toFixed(0) }}x
                      </span>
                    </div>
                  </td>
                  <td class="py-4 px-4 text-right text-sm">
                    {{ model.contextWindow }}
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
        <UCard class="bg-muted/50">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-info" class="w-5 h-5 text-muted-foreground mt-0.5" />
            <div class="text-sm text-muted-foreground">
              <p class="font-medium text-foreground mb-1">Methodology</p>
              <p>
                Intelligence Index is a weighted composite score from Artificial Analysis Intelligence Index v4.3,
                incorporating 10 evaluations: AA-Briefcase, GDPval-AA v2, AutomationBench-AA, Terminal-Bench 4.0, SciCode,
                Humanity's Last Exam, GDP.pdf, CritPt, AA-Omniscience, and AA-LCR v1.1.
              </p>
              <p class="mt-2">
                Cost per task is calculated from input, cache hit, cache write, reasoning, and answer token prices,
                divided by task count, and weighted by the Intelligence Index evaluation weights.
              </p>
              <p class="mt-2 text-xs">
                Note: Pricing and model availability change rapidly. This data represents a snapshot from December 2025.
                For live data, visit
                <a href="https://artificialanalysis.ai/models" target="_blank" class="text-primary hover:underline">
                  artificialanalysis.ai/models
                </a>.
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
