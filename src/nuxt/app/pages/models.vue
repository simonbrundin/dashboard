<script setup lang="ts">
import { useModelFilters } from '~/composables/useModelFilters'
import { useModelStats } from '~/composables/useModelStats'
import { hasRankableCodingEvidence } from '~/utils/modelScoring'

// Data composables
const {
  modelsData,
  metaData,
  fetchModels,
  getStats,
  modelsWithCost,
  modelsWithoutCost,
  modelsWithMeasuredCost,
  modelsWithCodingScore,
  totalInDb
} = useModels()
const progress = useProgress()
const actions = useModelActions(modelsData, progress, fetchModels)

// Filter & sort composable
const {
  selectedCategory,
  sortBy,
  sortDirection,
  showOnlyOpenWeights,
  showWithoutPrice,
  includeEstimatedScores,
  minCodingIndex,
  maxCodingIndex,
  modelsAboveThreshold,
  categoryStats,
  sortedModels,
  handleSort
} = useModelFilters(modelsData)

// Primary stats use supported coding evidence by default. Estimated rows can be
// included explicitly from the filters without changing the stored source data.
const rankingModels = computed(() =>
  modelsAboveThreshold.value.filter(model => hasRankableCodingEvidence(model, includeEstimatedScores.value))
)

const {
  bestMeasuredCodingValueModels,
  topCodingModels,
  lowestMeasuredCostModels,
  paretoOptimalModels
} = useModelStats(rankingModels)

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
  title: 'AI Coding Model Value Comparison | Dashboard',
  meta: [
    {
      name: 'description',
      content: 'Compare AI models by coding ability per dollar. Find the best coding value models based on Artificial Analysis data.'
    }
  ]
})

useSeoMeta({
  title: 'AI Coding Model Value Comparison',
  description: 'Compare AI models by Coding Index per task cost. Find the most cost-effective coding models.',
  ogTitle: 'AI Coding Model Value Comparison',
  ogDescription: 'Find the models with the most coding ability per dollar.'
})
</script>

<template>
  <UDashboardPanel id="models">
    <template #header>
      <UDashboardNavbar title="AI Coding Model Value Comparison">
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
            Synka modeller ({{ totalInDb }})
          </UButton>
          <UButton
            v-if="modelsWithoutCost.length > 0"
            variant="outline"
            size="sm"
            :loading="progress.show.value"
            icon="i-lucide-tag"
            @click="actions.fetchMorePrices"
          >
            Hämta priser ({{ modelsWithoutCost.length }} utan)
          </UButton>
          <UButton
            variant="outline"
            size="sm"
            :loading="progress.show.value"
            icon="i-lucide-refresh-cw"
            @click="actions.refreshPrices"
          >
            Uppdatera priser ({{ modelsWithCost.length }})
          </UButton>
          <UButton
            to="/models/methodology"
            variant="ghost"
            size="sm"
            icon="i-lucide-calculator"
          >
            Beräkningar
          </UButton>
          <UButton
            variant="ghost"
            size="sm"
            :href="'https://artificialanalysis.ai/models'"
            target="_blank"
            icon="i-lucide-external-link"
            custom
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6">
        <!-- Header Info -->
        <ModelsHeader
          :total="totalInDb"
          :with-measured-cost="modelsWithMeasuredCost.length"
          :without-price="modelsWithoutCost.length"
          :with-coding-score="modelsWithCodingScore.length"
          :updated-at="metaData?.updatedAt"
        />

        <!-- Progress Bar -->
        <ModelsProgress
          v-if="progress.show.value"
          :current="progress.current.value"
          :total="progress.total.value"
          :time-remaining="progress.timeRemaining.value"
          :percent="progress.percent.value"
          :status-message="actions.statusMessage.value"
        />

        <!-- Error Message -->
        <UAlert
          v-if="actions.error.value"
          color="error"
          variant="soft"
          title="Error"
        >
          {{ actions.error.value }}
          <template #footer>
            <UButton
              size="xs"
              variant="outline"
              color="error"
              @click="actions.error.value = null"
            >
              Dismiss
            </UButton>
          </template>
        </UAlert>

        <!-- No Data Message -->
        <ModelsNoData
          v-if="modelsData.length === 0 && !actions.error.value"
          :loading="progress.show.value"
          @fetch="actions.fetchMorePrices"
        />

        <template v-if="modelsData.length > 0">
          <!-- Filters -->
          <ModelsFilters
            :selected-category="selectedCategory"
            :sort-by="sortBy"
            :show-only-open-weights="showOnlyOpenWeights"
            :include-estimated-scores="includeEstimatedScores"
            :min-coding-index="minCodingIndex"
            :max-coding-index="maxCodingIndex"
            :category-stats="categoryStats"
            @update:selected-category="selectedCategory = $event"
            @update:sort-by="sortBy = $event"
            @update:min-coding-index="minCodingIndex = $event"
            @toggle-open-weights="showOnlyOpenWeights = !showOnlyOpenWeights"
            @toggle-estimated-scores="includeEstimatedScores = !includeEstimatedScores"
          />

          <!-- Stats Cards -->
          <ModelsStatsCards
            :best-measured-coding-value="bestMeasuredCodingValueModels[0]"
            :top-coding="topCodingModels[0]"
            :lowest-cost="lowestMeasuredCostModels[0]"
          />

          <!-- Pareto Optimal Section -->
          <ModelsTopModels
            v-if="paretoOptimalModels.length > 0"
            :models="paretoOptimalModels"
          />

          <!-- Full Comparison Table -->
          <div v-if="sortedModels.length > 0">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-semibold text-lg">Full Model Comparison</h3>
                <p class="text-xs text-muted-foreground">Default value ranking uses measured coding costs and Supported evidence.</p>
              </div>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    v-model="showWithoutPrice"
                    type="checkbox"
                    class="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  >
                  <span class="text-muted-foreground">Visa utan pris ({{ modelsWithoutCost.length }})</span>
                </label>
                <span class="text-sm text-muted-foreground">
                  {{ sortedModels.length }} modeller
                </span>
              </div>
            </div>

            <ModelsComparisonTable
              :models="sortedModels"
              :sort-by="sortBy"
              :sort-direction="sortDirection"
              :include-estimated-scores="includeEstimatedScores"
              @sort="handleSort"
            />
          </div>

          <!-- Methodology Note -->
          <ModelsMethodology />
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
