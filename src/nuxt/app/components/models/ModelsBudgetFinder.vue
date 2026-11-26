<script setup lang="ts">
import type { ModelData } from '~/data/models'
import {
  findCheapestSufficient,
  getBenchmarkScore,
  getBudgetSourceOptions,
  type BudgetFinderRow,
  type RankingBenchmark
} from '~/utils/modelScoring'
import { formatCost, formatModelName } from '~/utils/modelFormatters'

const props = defineProps<{
  models: ModelData[]
  includeEstimatedScores: boolean
}>()

const selectedSource = ref<RankingBenchmark>('aa-coding-agent')
const expanded = ref(false)

const sourceOptions = computed(() => getBudgetSourceOptions(props.models))

watch(sourceOptions, (options) => {
  if (!options.some(option => option.value === selectedSource.value)) {
    selectedSource.value = options[0]?.value ?? 'aa-coding-agent'
  }
})

const source = computed(() => sourceOptions.value.find(option => option.value === selectedSource.value))

const availableReferences = computed(() =>
  props.models
    .filter(model => getBenchmarkScore(model, selectedSource.value, props.includeEstimatedScores) !== null)
    .sort((a, b) =>
      (getBenchmarkScore(b, selectedSource.value, props.includeEstimatedScores) ?? 0) -
      (getBenchmarkScore(a, selectedSource.value, props.includeEstimatedScores) ?? 0)
    )
)

const referenceSlug = ref<string | undefined>(undefined)

watch(availableReferences, (list) => {
  if (!list.some(model => model.slug === referenceSlug.value)) {
    const preferred = list.find(model => model.slug?.includes('sonnet'))
      ?? list[Math.floor(list.length / 4)]
      ?? list[0]
    referenceSlug.value = preferred?.slug
  }
}, { immediate: true })

const result = computed(() =>
  findCheapestSufficient(
    props.models,
    selectedSource.value,
    referenceSlug.value ?? null,
    props.includeEstimatedScores
  )
)

/** The single best answer: cheapest measured-cost model at the same level. */
const recommendation = computed<BudgetFinderRow | null>(() => {
  const { measuredRows, estimatedRows } = result.value
  return measuredRows.find(row => row.model.slug !== referenceSlug.value)
    ?? measuredRows[0]
    ?? estimatedRows[0]
    ?? null
})

const MAX_ROWS = 6
const shownMeasured = computed(() =>
  expanded.value ? result.value.measuredRows : result.value.measuredRows.slice(0, MAX_ROWS)
)
const hiddenCount = computed(() =>
  result.value.measuredRows.length + result.value.estimatedRows.length
    - Math.min(result.value.measuredRows.length, expanded.value ? Infinity : MAX_ROWS)
    - Math.min(result.value.estimatedRows.length, expanded.value ? Infinity : MAX_ROWS)
)

function formatRowCost(row: BudgetFinderRow): string {
  if (row.cost === null) return '—'
  return formatCost(row.cost)
}

function formatSavings(row: BudgetFinderRow): string {
  if (row.savingsPct === null || row.savingsPct <= 0) return '—'
  return `${row.savingsPct}% lägre`
}

function qualityColumnLabel(): string {
  if (selectedSource.value === 'estimated') return 'Intelligence Index (0–100)'
  if (selectedSource.value === 'aa-coding-agent') return 'Kodpoäng (AA Coding Agent Index, 0–100)'
  return 'Poäng på benchmark (0–100)'
}

function costColumnLabel(): string {
  if (selectedSource.value === 'aa-coding-agent') return 'Kostnad per agentuppgift (mätt av AA)'
  if (selectedSource.value === 'estimated') return 'Kostnad per uppgift (≈ uppskattad)'
  return 'Kostnad per lyckad uppgift (mätt av AA)'
}
</script>

<template>
  <UCard class="mt-6">
    <template #header>
      <div>
        <h3 class="font-semibold text-lg">Vilken är billigast — och lika smart?</h3>
        <p class="text-sm text-muted-foreground mt-1">
          Välj en modell du vet klarar dina koduppgifter. Vi visar billigare modeller som får
          <span class="font-medium">minst lika hög poäng på samma test</span> — aldrig en annan tests skala.
        </p>
      </div>
    </template>

    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Källa:</span>
        <USelect
          v-model="selectedSource"
          :items="sourceOptions.map(o => ({ value: o.value, label: `${o.label} — ${o.count} modeller` }))"
          size="xs"
          class="w-72"
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Lika smart som:</span>
        <USelect
          v-model="referenceSlug"
          :items="availableReferences.map(m => ({ value: m.slug ?? '', label: formatModelName(m.name) }))"
          size="xs"
          class="w-64"
        />
      </div>
    </div>

    <div v-if="result.reference && result.threshold !== null">
      <!-- The direct answer -->
      <div
        v-if="recommendation"
        class="rounded-lg border border-green-500/30 bg-green-500/10 p-4 mb-4"
      >
        <p class="text-sm">
          <span class="font-semibold text-green-600 dark:text-green-400">Svar:</span>
          <span class="font-semibold">{{ formatModelName(recommendation.model.name) }}</span>
          — {{ formatRowCost(recommendation) }} per {{ selectedSource === 'aa-coding-agent' ? 'agentuppgift' : selectedSource === 'estimated' ? 'uppgift (≈ uppskattad)' : 'lyckad uppgift' }}
          <template v-if="recommendation.savingsPct !== null && recommendation.savingsPct > 0">
            — {{ recommendation.savingsPct }} % billigare än
            {{ formatModelName(result.reference?.name ?? '') }}
          </template>
          <span class="text-muted-foreground">
            ({{ recommendation.quality.toFixed(1) }} mot {{ result.threshold.toFixed(1) }} poäng)
          </span>
        </p>
      </div>
      <div
        v-else
        class="rounded-lg border border-border bg-muted/40 p-4 mb-4"
      >
        <p class="text-sm text-muted-foreground">
          Ingen annan modell når {{ result.threshold.toFixed(1) }} poäng på {{ source?.label }} än.
        </p>
      </div>

      <div v-if="shownMeasured.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left text-xs text-muted-foreground">
              <th class="py-2 px-3">Modell</th>
              <th class="py-2 px-3 text-right">{{ qualityColumnLabel() }}</th>
              <th class="py-2 px-3 text-right">{{ costColumnLabel() }}</th>
              <th class="py-2 px-3 text-right">Billigare än referens</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in shownMeasured"
              :key="row.model.slug"
              class="border-b border-border/50"
              :class="row.model.slug === referenceSlug ? 'bg-primary/5' : ''"
            >
              <td class="py-2 px-3">
                {{ formatModelName(row.model.name) }}
                <span
                  v-if="row.model.slug === referenceSlug"
                  class="text-xs text-muted-foreground"
                >(referens)</span>
              </td>
              <td class="py-2 px-3 text-right tabular-nums">{{ row.quality.toFixed(1) }}</td>
              <td class="py-2 px-3 text-right tabular-nums">{{ formatRowCost(row) }}</td>
              <td class="py-2 px-3 text-right text-green-600 dark:text-green-400 tabular-nums">
                {{ formatSavings(row) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="result.estimatedRows.length > 0" class="mt-4">
        <p class="text-xs text-muted-foreground mb-2">
          Lika smarta men utan mätt kostnad på den här källan — kostnaden är en uppskattning (≈) från
          tokenpriser, inte en mätning:
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border text-left text-xs text-muted-foreground">
                <th class="py-2 px-3">Modell</th>
                <th class="py-2 px-3 text-right">{{ qualityColumnLabel() }}</th>
                <th class="py-2 px-3 text-right">≈ Kostnad per uppgift (uppskattad)</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in (expanded ? result.estimatedRows : result.estimatedRows.slice(0, MAX_ROWS))"
                :key="row.model.slug"
                class="border-b border-border/50 opacity-75"
              >
                <td class="py-2 px-3">{{ formatModelName(row.model.name) }}</td>
                <td class="py-2 px-3 text-right tabular-nums">{{ row.quality.toFixed(1) }}</td>
                <td class="py-2 px-3 text-right tabular-nums">≈ {{ formatRowCost(row) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <UButton
        v-if="hiddenCount > 0"
        variant="ghost"
        size="xs"
        class="mt-3"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Visa färre' : `Visa alla (${hiddenCount} fler)` }}
      </UButton>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      Välj en referensmodell med poäng på den valda källan.
    </p>
  </UCard>
</template>
