<script setup lang="ts">
import { formatDate } from '~/utils/modelFormatters'
import { useModelFilters } from '~/composables/useModelFilters'
import { useModelStats } from '~/composables/useModelStats'

// Data composables
const { modelsData, metaData, fetchModels, getStats, modelsWithCost, modelsWithoutCost, totalInDb } = useModels()
const progress = useProgress()
const actions = useModelActions(modelsData, progress, fetchModels)

// Filter & sort composable
const {
  selectedCategory,
  sortBy,
  sortDirection,
  showOnlyOpenWeights,
  showWithoutPrice,
  categoryStats,
  sortedModels,
  handleSort
} = useModelFilters(modelsData)

// Stats composable
const { bestValueModels, topIntelligenceModels, lowestCostModels, paretoOptimalModels } = useModelStats(modelsData)

// Local state
const lastError = ref<string | null>(null)

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
            Lägg till modeller ({{ totalInDb }})
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
          :with-price="modelsWithCost.length"
          :without-price="modelsWithoutCost.length"
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
        <UAlert v-if="lastError" color="error" variant="soft" title="Error">
          {{ lastError }}
          <template #footer>
            <UButton size="xs" variant="outline" color="error" @click="lastError = null">
              Dismiss
            </UButton>
          </template>
        </UAlert>

        <!-- No Data Message -->
        <ModelsNoData
          v-if="modelsData.length === 0 && !lastError"
          :loading="progress.show.value"
          @fetch="actions.fetchMorePrices"
        />

        <template v-if="modelsData.length > 0">
          <!-- Filters -->
          <ModelsFilters
            :selected-category="selectedCategory"
            :sort-by="sortBy"
            :show-only-open-weights="showOnlyOpenWeights"
            :category-stats="categoryStats"
            @update:selected-category="selectedCategory = $event"
            @update:sort-by="sortBy = $event"
            @toggle-open-weights="showOnlyOpenWeights = !showOnlyOpenWeights"
          />

          <!-- Stats Cards -->
          <ModelsStatsCards
            :best-value="bestValueModels[0]"
            :top-intelligence="topIntelligenceModels[0]"
            :lowest-cost="lowestCostModels[0]"
          />

          <!-- Pareto Optimal Section -->
          <ModelsTopModels
            v-if="paretoOptimalModels.length > 0"
            :models="paretoOptimalModels"
          />

          <!-- Full Comparison Table -->
          <div v-if="sortedModels.length > 0">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold text-lg">Full Model Comparison</h3>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    v-model="showWithoutPrice"
                    type="checkbox"
                    class="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
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
