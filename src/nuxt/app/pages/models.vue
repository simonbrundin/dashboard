<script setup lang="ts">
import { useModelFilters } from '~/composables/useModelFilters'
import { useModelStats } from '~/composables/useModelStats'
import { getBenchmarkOption } from '~/utils/modelScoring'
import { useAgentTasksPerDay } from '~/composables/useAgentBenchmark'

// Data composables
const {
  modelsData,
  metaData,
  fetchModels,
  getStats,
  modelsWithMeasuredCost,
  modelsWithCodingScore,
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
  effortStats,
  selectedEffort,
  sortedModels,
  setSelectedBenchmark,
  handleSort
} = useModelFilters(modelsData)

// The page leads with one recommendation; everything else is opt-in.
const showAllData = ref(false)

// The workload drives every monthly cost on the page.
const tasksPerDay = useAgentTasksPerDay()

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
  title: 'Kodbenchmark och kostnadsjämförelse för AI-modeller | Dashboard',
  meta: [
    {
      name: 'description',
      content: 'Jämför kodbenchmarkspoäng och källanpassad kostnad per lyckad uppgift mellan AI-modeller.'
    }
  ]
})

useSeoMeta({
  title: 'Kodbenchmark och kostnadsjämförelse för AI-modeller',
  description: 'Jämför kodbenchmarkspoäng och källanpassade uppgiftskostnader.',
  ogTitle: 'Kodbenchmark och kostnadsjämförelse för AI-modeller',
  ogDescription: 'Jämför kodkvalitet och kostnad inom varje benchmark.'
})
</script>

<template>
  <UDashboardPanel id="models">
    <template #header>
      <UDashboardNavbar title="Kodmodeller — vad ska du köra?">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <UButton
            variant="outline"
            size="sm"
            :loading="progress.show.value"
            icon="i-lucide-refresh-cw"
            @click="actions.fetchMorePrices"
          >
            Synka modeller ({{ totalInDb }})
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
              Stäng
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
          <!-- The single answer this page exists for -->
          <ModelsRecommendation :models="modelsData" />

          <!-- Every measured model with quality, cost and monthly price -->
          <ModelsDecisionTable
            :models="modelsData"
            :tasks-per-day="tasksPerDay"
          />

          <UButton
            variant="ghost"
            block
            size="sm"
            :icon="showAllData ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            :trailing="true"
            @click="showAllData = !showAllData"
          >
            {{ showAllData ? 'Visa mindre' : 'Visa all data: alla benchmark-vyer, filter och prenumerationsdetaljer' }}
          </UButton>

          <div v-if="showAllData" class="space-y-6">
            <!-- Header Info -->
            <ModelsHeader
              :total="totalInDb"
              :with-measured-cost="modelsWithMeasuredCost.length"
              :with-estimated-cost="modelsWithEstimatedCost.length"
              :without-prices="modelsWithoutPrices.length"
              :with-coding-score="modelsWithCodingScore.length"
              :updated-at="metaData?.updatedAt"
            />

            <!-- Filters -->
            <ModelsFilters
              :selected-category="selectedCategory"
              :selected-benchmark="selectedBenchmark"
              :sort-by="sortBy"
              :show-only-open-weights="showOnlyOpenWeights"
              :include-estimated-scores="includeEstimatedScores"
              :min-benchmark-score="minBenchmarkScore"
              :max-benchmark-score="maxBenchmarkScore"
              :selected-effort="selectedEffort"
              :category-stats="categoryStats"
              :effort-stats="effortStats"
              @update:selected-category="selectedCategory = $event"
              @update:selected-benchmark="setSelectedBenchmark($event)"
              @update:sort-by="handleSort($event)"
              @update:min-benchmark-score="minBenchmarkScore = $event"
              @update:selected-effort="selectedEffort = $event"
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

            <!-- Budget finder: cheapest models that clear a quality threshold -->
            <ModelsBudgetFinder
              :models="modelsData"
              :include-estimated-scores="includeEstimatedScores"
            />

            <!-- Subscription vs pay-per-task comparison -->
            <ModelsSubscriptionComparison :models="modelsData" />

            <!-- Normalised price per million tokens -->
            <ModelsUnitEconomics :models="modelsData" />

            <!-- Published usage limits per model -->
            <ModelsUsageLimits :models="modelsData" />

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
                  <span class="text-muted-foreground">Visa modeller utan mätvärde</span>
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
              title="Inga jämförbara modeller för den här vyn"
            >
              Inga score/kostnad-par för {{ benchmarkOption.label }} i nuvarande data. Välj en annan vy eller synka källdata.
            </UAlert>

            <!-- Methodology Note -->
            <ModelsMethodology />
          </div>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
