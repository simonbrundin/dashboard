<script setup lang="ts">
import type { EffortFilter, SortColumn } from '~/composables/useModelFilters'
import type { Category } from '~/utils/modelFormatters'
import {
  getBenchmarkOption,
  RANKING_BENCHMARKS,
  type RankingBenchmark
} from '~/utils/modelScoring'

const props = defineProps<{
  selectedCategory: Category
  selectedBenchmark: RankingBenchmark
  sortBy: SortColumn
  showOnlyOpenWeights: boolean
  includeEstimatedScores: boolean
  minBenchmarkScore: number
  maxBenchmarkScore: number
  selectedEffort: EffortFilter
  categoryStats: {
    all: number
    frontier: number
    high: number
    mid: number
    budget: number
    openWeights: number
  }
  effortStats: Record<string, number>
}>()

const emit = defineEmits<{
  'update:selectedCategory': [value: Category]
  'update:selectedBenchmark': [value: RankingBenchmark]
  'update:sortBy': [value: SortColumn]
  'update:minBenchmarkScore': [value: number]
  'update:selectedEffort': [value: EffortFilter]
  toggleOpenWeights: []
  toggleEstimatedScores: []
}>()

const categories: Category[] = ['all', 'frontier', 'high', 'mid', 'budget']

/** The category names in Swedish. */
const CATEGORY_LABELS: Record<Category, string> = {
  all: 'Alla',
  frontier: 'Frontier',
  high: 'Hög',
  mid: 'Mellan',
  budget: 'Budget'
}
const benchmarkOptions = RANKING_BENCHMARKS.map(({ value, label }) => ({ value, label }))

const EFFORT_FILTERS: EffortFilter[] = ['all', 'max', 'xhigh', 'high', 'medium', 'low', 'non-reasoning']

/** The effort levels in the same words the benchmark sources use. */
const EFFORT_LABELS: Record<string, string> = {
  max: 'Max',
  xhigh: 'Xhigh',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  'non-reasoning': 'Utan resonemang'
}

const effortOptions = computed(() =>
  EFFORT_FILTERS
    .filter(effort => effort === 'all' || (props.effortStats[effort] ?? 0) > 0)
    .map(effort => ({
      value: effort,
      label: effort === 'all'
        ? `Alla (${props.categoryStats.all})`
        : `${EFFORT_LABELS[effort] ?? effort} (${props.effortStats[effort] ?? 0})`
    }))
)

const sortOptions = computed(() => {
  const selected = getBenchmarkOption(props.selectedBenchmark)
  return [
    { value: 'ranking', label: selected.rankingLabel },
    { value: 'score', label: selected.scoreLabel },
    {
      value: 'cost',
      label: selected.metricKind === 'cost-per-success' ? 'Kostnad per lyckad uppgift' : selected.costLabel,
      disabled: props.selectedBenchmark === 'benchlm'
    },
    { value: 'intelligence', label: 'Intelligence Index' },
    { value: 'speed', label: 'Snabbast' }
  ]
})

function updateSort(value: unknown) {
  if (sortOptions.value.some(option => option.value === value && !option.disabled)) {
    emit('update:sortBy', value as SortColumn)
  }
}

function updateMinimumScore(value: number | number[] | undefined) {
  if (typeof value === 'number') {
    emit('update:minBenchmarkScore', value)
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">Benchmark:</span>
      <USelect
        :model-value="selectedBenchmark"
        :items="benchmarkOptions"
        size="xs"
        class="w-56"
        @update:model-value="emit('update:selectedBenchmark', $event as RankingBenchmark)"
      />
    </div>

    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">Kategori:</span>
      <div class="flex gap-1">
        <UButton
          v-for="cat in categories"
          :key="cat"
          :variant="selectedCategory === cat ? 'solid' : 'outline'"
          :color="selectedCategory === cat ? 'primary' : 'neutral'"
          size="xs"
          @click="emit('update:selectedCategory', cat)"
        >
          {{ CATEGORY_LABELS[cat] }}
          <span class="ml-1 opacity-60">
            ({{ cat === 'all' ? categoryStats.all : categoryStats[cat] }})
          </span>
        </UButton>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">Sortera efter:</span>
      <USelect
        :model-value="sortBy"
        :items="sortOptions"
        size="xs"
        class="w-64"
        @update:model-value="updateSort"
      />
    </div>

    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">Ansträngning:</span>
      <USelect
        :model-value="selectedEffort"
        :items="effortOptions"
        size="xs"
        class="w-40"
        @update:model-value="emit('update:selectedEffort', $event as EffortFilter)"
      />
    </div>

    <div class="flex items-center gap-3">
      <span class="text-sm text-muted-foreground">Minsta poäng:</span>
      <USlider
        :model-value="minBenchmarkScore"
        :min="0"
        :max="Math.max(maxBenchmarkScore, 1)"
        :step="1"
        tooltip
        class="w-40"
        @update:model-value="updateMinimumScore"
      />
      <span class="text-sm font-semibold w-8 text-primary">
        {{ minBenchmarkScore === 0 ? 'Alla' : `≥ ${minBenchmarkScore}` }}
      </span>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        :disabled="selectedBenchmark !== 'benchlm'"
        :aria-pressed="includeEstimatedScores"
        class="relative inline-flex h-5 w-9 items-center rounded-full bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
        :class="{ 'bg-primary': includeEstimatedScores }"
        @click="emit('toggleEstimatedScores')"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
          :class="{ 'translate-x-4': includeEstimatedScores, 'translate-x-0': !includeEstimatedScores }"
        />
      </button>
      <span class="text-sm text-muted-foreground">Inkludera BenchLM-familj / uppskattade poäng</span>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        :aria-pressed="showOnlyOpenWeights"
        class="relative inline-flex h-5 w-9 items-center rounded-full bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="{ 'bg-primary': showOnlyOpenWeights }"
        @click="emit('toggleOpenWeights')"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
          :class="{ 'translate-x-4': showOnlyOpenWeights, 'translate-x-0': !showOnlyOpenWeights }"
        />
      </button>
      <span class="text-sm text-muted-foreground">Endast öppna vikter</span>
      <span class="text-xs text-muted-foreground">({{ categoryStats.openWeights }} modeller)</span>
    </div>
  </div>
</template>
