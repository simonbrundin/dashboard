<script setup lang="ts">
import { useModelFilters } from '~/composables/useModelFilters'
import { useModelStats } from '~/composables/useModelStats'
import { getBenchmarkOption } from '~/utils/modelScoring'

// Data composables
const {
  modelsData,
  metaData,
  fetchModels,
  getStats,
  modelsWithMeasuredCost,
  modelsWithCodingScore,
  modelsWithProxyCost,
  modelsWithoutProxyCost,
  modelsWithEstimatedCost,
  modelsWithoutPrices,
  totalInDb
} = useModels()
const progress = useProgress()
const actions = useModelActions(modelsData, progress, fetchModels)

// Filter & sort composable
const {
  selectedCategory,
  sortBy,
  sortDirection,
  selectedBenchmark,
  showOnlyOpenWeights,
  showUnrankable,
  includeEstimatedScores,
  minBenchmarkScore,
  maxBenchmarkScore,
  modelsAboveThreshold,
  categoryStats,
  sortedModels,
  setSelectedBenchmark,
  handleSort
} = useModelFilters(modelsData)

const benchmarkOption = computed(() => getBenchmarkOption(selectedBenchmark.value))
const rankingDescription = computed(() => {
  switch (selectedBenchmark.value) {
    case 'benchlm':
      return 'Quality-only ranking: BenchLM scores have no matched task cost and are not converted to value per dollar.'
    case 'aa-coding-agent':
      return 'Ranked by the Coding Agent Index score and the cost of the same agent run.'
    case 'estimated':
      return 'Estimate for every model: token prices combined with the median token profile of the same effort tier. This is not a coding measurement.'
    default:
      return `Ranked by ${benchmarkOption.value.rankingLabel.toLowerCase()} using ${benchmarkOption.value.label} data only.`
  }
})

const {
  bestValueModels,
  topScoreModels,
  lowestCostModels,
  paretoOptimalModels
} = useModelStats(modelsAboveThreshold, selectedBenchmark, includeEstimatedScores)

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
  title: 'AI Coding Model Benchmark & Cost Comparison | Dashboard',
  meta: [
    {
      name: 'description',
      content: 'Compare coding benchmark scores and source-aligned cost per successful task across AI models.'
    }
  ]
})

useSeoMeta({
  title: 'AI Coding Model Benchmark & Cost Comparison',
  description: 'Compare coding benchmark scores and source-aligned task costs.',
  ogTitle: 'AI Coding Model Benchmark & Cost Comparison',
  ogDescription: 'Compare coding quality and cost within each benchmark.'
})
</script>

<template>
  <UDashboardPanel id="models">
    <template #header>
      <UDashboardNavbar title="AI Coding Model Benchmark & Cost Comparison">
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
            v-if="modelsWithoutProxyCost.length > 0"
            variant="outline"
            size="sm"
            :loading="progress.show.value"
            icon="i-lucide-tag"
            @click="actions.fetchMorePrices"
          >
            Hämta priser ({{ modelsWithoutProxyCost.length }} utan)
          </UButton>
          <UButton
            variant="outline"
            size="sm"
            :loading="progress.show.value"
            icon="i-lucide-refresh-cw"
            @click="actions.refreshPrices"
          >
            Uppdatera priser ({{ modelsWithProxyCost.length }})
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
          :with-estimated-cost="modelsWithEstimatedCost.length"
          :without-prices="modelsWithoutPrices.length"
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
            :selected-benchmark="selectedBenchmark"
            :sort-by="sortBy"
            :show-only-open-weights="showOnlyOpenWeights"
            :include-estimated-scores="includeEstimatedScores"
            :min-benchmark-score="minBenchmarkScore"
            :max-benchmark-score="maxBenchmarkScore"
            :category-stats="categoryStats"
            @update:selected-category="selectedCategory = $event"
            @update:selected-benchmark="setSelectedBenchmark($event)"
            @update:sort-by="handleSort($event)"
            @update:min-benchmark-score="minBenchmarkScore = $event"
            @toggle-open-weights="showOnlyOpenWeights = !showOnlyOpenWeights"
            @toggle-estimated-scores="includeEstimatedScores = !includeEstimatedScores"
          />

          <!-- Stats Cards -->
          <ModelsStatsCards
            :best-value="bestValueModels[0]"
            :top-score="topScoreModels[0]"
            :lowest-cost="lowestCostModels[0]"
            :benchmark="selectedBenchmark"
            :include-estimated-scores="includeEstimatedScores"
          />

          <!-- Pareto Optimal Section -->
          <ModelsTopModels
            v-if="paretoOptimalModels.length > 0"
            :models="paretoOptimalModels"
            :benchmark="selectedBenchmark"
            :include-estimated-scores="includeEstimatedScores"
          />

          <!-- Full Comparison Table -->
          <div v-if="sortedModels.length > 0">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-semibold text-lg">{{ benchmarkOption.label }} comparison</h3>
                <p class="text-xs text-muted-foreground">{{ rankingDescription }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ sortedModels.length }} av {{ totalInDb }} modeller kan jämföras i den här vyn.
                </p>
              </div>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    v-model="showUnrankable"
                    type="checkbox"
                    class="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  >
                  <span class="text-muted-foreground">Show models without a ranking metric</span>
                </label>
                <span class="text-sm text-muted-foreground">
                  {{ sortedModels.length }} modeller
                </span>
              </div>
            </div>

            <ModelsComparisonTable
              :models="sortedModels"
              :benchmark="selectedBenchmark"
              :sort-by="sortBy"
              :sort-direction="sortDirection"
              :include-estimated-scores="includeEstimatedScores"
              @sort="handleSort"
            />
          </div>
          <UAlert
            v-else
            color="neutral"
            variant="soft"
            title="No ranked models for this benchmark"
          >
            There are no matching score/cost pairs for {{ benchmarkOption.label }} in the current data. Select another benchmark or synchronize the source data.
          </UAlert>

          <!-- Methodology Note -->
          <ModelsMethodology />
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
