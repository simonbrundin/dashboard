<script setup lang="ts">
import { computed } from 'vue'
import type { ModelData } from '~/data/models'
import type { SortColumn } from '~/composables/useModelFilters'
import {
  getBenchmarkCostPerAttempt,
  getBenchmarkCostPerSuccessfulTask,
  getBenchmarkOption,
  getBenchmarkRankingMetric,
  getBenchmarkScore,
  getBenchLmConfidenceLabel,
  getBenchLmMatchLabel,
  type RankingBenchmark
} from '~/utils/modelScoring'
import {
  getCategoryColor,
  formatCodingValue,
  formatConfidenceInterval,
  formatCost,
  formatModelName,
  formatCostPerSuccessfulTask
} from '~/utils/modelFormatters'
import { AGENT_BENCHMARKS } from '~/utils/agentBenchmarks'

const props = defineProps<{
  models: ModelData[]
  benchmark: RankingBenchmark
  sortBy: SortColumn
  sortDirection: 'asc' | 'desc'
  includeEstimatedScores: boolean
}>()

const emit = defineEmits<{
  sort: [column: SortColumn]
}>()

const benchmarkOption = computed(() => getBenchmarkOption(props.benchmark))

/** The agent harness the selected benchmark was run with. */
const agentBenchmark = computed(() =>
  AGENT_BENCHMARKS.find(benchmark => benchmark.id === props.benchmark) ?? null
)

/** The agent of a single row, when the benchmark names it per row. */
function getAgent(model: ModelData): string | null {
  const benchmark = agentBenchmark.value
  if (!benchmark) return null
  return benchmark.harnessFor?.(model) ?? benchmark.harness
}

/** The published confidence interval of a single row, when it has one. */
function getConfidence(model: ModelData): string | null {
  const published = agentBenchmark.value?.confidenceFor?.(model)
  if (!published) return null
  return formatConfidenceInterval(published.low, published.high)
}

function getScore(model: ModelData): number | null {
  return getBenchmarkScore(model, props.benchmark, props.includeEstimatedScores)
}

function getRankingMetric(model: ModelData) {
  return getBenchmarkRankingMetric(model, props.benchmark, props.includeEstimatedScores)
}

function formatRankingMetric(model: ModelData): string {
  const metric = getRankingMetric(model)
  if (!metric) return '—'
  if (metric.kind === 'cost-per-success') return formatCostPerSuccessfulTask(metric.value)
  if (metric.kind === 'score-only') return `${metric.value.toFixed(1)} / 100`
  if (metric.kind === 'estimated-score-per-dollar') return `≈ ${formatCodingValue(metric.value)}`
  return formatCodingValue(metric.value)
}

function getScoreEvidence(model: ModelData): string {
  if (props.benchmark !== 'benchlm' || getScore(model) === null) return ''
  return `${getBenchLmConfidenceLabel(model)} · ${getBenchLmMatchLabel(model)}`
}

function getIntelligencePercent(index: number | null): number {
  if (index === null) return 0
  return Math.min((index / 70) * 100, 100)
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="border-b border-border">
          <th class="text-left py-3 px-4 font-medium text-muted-foreground">
            Modell
          </th>
          <th
            class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
            @click="emit('sort', 'ranking')"
          >
            <span class="flex items-center justify-end gap-1">
              {{ benchmarkOption.rankingLabel }}
              <UIcon
                v-if="sortBy === 'ranking'"
                :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
                class="w-4 h-4"
              />
            </span>
          </th>
          <th class="text-center py-3 px-4 font-medium text-muted-foreground" title="Prisklass baserad på tokenpriser">
            Kategori
          </th>
          <th
            class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
            @click="emit('sort', 'score')"
          >
            <span class="flex items-center justify-end gap-1">
              {{ benchmarkOption.scoreLabel }}
              <UIcon
                v-if="sortBy === 'score'"
                :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
                class="w-4 h-4"
              />
            </span>
          </th>
          <th
            class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
            @click="emit('sort', 'intelligence')"
          >
            <span class="flex items-center justify-end gap-1">
              Intelligence
              <UIcon
                v-if="sortBy === 'intelligence'"
                :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
                class="w-4 h-4"
              />
            </span>
          </th>
          <th
            class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
            :class="{ 'cursor-default hover:bg-transparent': benchmark === 'benchlm' }"
            @click="benchmark !== 'benchlm' && emit('sort', 'cost')"
          >
            <span class="flex items-center justify-end gap-1">
              {{ benchmarkOption.costLabel }}
              <UIcon
                v-if="sortBy === 'cost'"
                :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
                class="w-4 h-4"
              />
            </span>
          </th>
          <th
            class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
            @click="emit('sort', 'speed')"
          >
            <span class="flex items-center justify-end gap-1">
              Hastighet
              <UIcon
                v-if="sortBy === 'speed'"
                :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
                class="w-4 h-4"
              />
            </span>
          </th>
          <th class="text-center py-3 px-4 font-medium text-muted-foreground" title="Öppna vikter">
            Öppen
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(model, index) in models"
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
                  {{ formatModelName(model.name) }}
                </a>
                <p class="text-xs text-muted-foreground">{{ model.provider }}</p>
                <p v-if="getAgent(model)" class="text-[11px] text-muted-foreground">
                  agent: {{ getAgent(model) }}
                </p>
              </div>
            </div>
          </td>
          <td class="py-4 px-4 text-right">
            <span v-if="getRankingMetric(model)" class="text-sm font-semibold text-primary">
              {{ formatRankingMetric(model) }}
            </span>
            <span v-else class="text-sm text-muted-foreground">
              {{ getScore(model) === null ? 'Ingen benchmark-poäng' : 'Ingen matchad kostnad' }}
            </span>
          </td>
          <td class="py-4 px-4 text-center">
            <UBadge v-if="model.category" :class="getCategoryColor(model.category)" size="sm">
              {{ model.category }}
            </UBadge>
            <span v-else class="text-muted-foreground">—</span>
          </td>
          <td class="py-4 px-4 text-right">
            <div class="flex items-center justify-end gap-1">
              <span v-if="getScore(model) !== null" class="font-bold">{{ getScore(model)?.toFixed(1) }}</span>
              <span v-else class="text-muted-foreground">—</span>
              <div class="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-green-500 rounded-full"
                  :style="{ width: `${Math.min(Math.max(getScore(model) ?? 0, 0), 100)}%` }"
                />
              </div>
            </div>
            <p v-if="getScoreEvidence(model)" class="text-[11px] text-muted-foreground mt-1">
              {{ getScoreEvidence(model) }}
            </p>
            <p v-if="getConfidence(model)" class="text-[11px] text-muted-foreground">
              95 % CI: {{ getConfidence(model) }}
            </p>
          </td>
          <td class="py-4 px-4 text-right">
            <div class="flex items-center justify-end gap-1">
              <span class="font-bold">{{ model.intelligenceIndex ?? '—' }}</span>
              <div class="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full"
                  :style="{ width: `${getIntelligencePercent(model.intelligenceIndex)}%` }"
                />
              </div>
            </div>
          </td>
          <td class="py-4 px-4 text-right">
            <template v-if="getBenchmarkCostPerAttempt(model, benchmark) !== null">
              <span class="font-mono">
                {{ formatCost(getBenchmarkCostPerAttempt(model, benchmark)) }}
              </span>
              <p v-if="getBenchmarkCostPerSuccessfulTask(model, benchmark) !== null" class="text-xs text-muted-foreground">
                {{ formatCostPerSuccessfulTask(getBenchmarkCostPerSuccessfulTask(model, benchmark)) }}
              </p>
              <p v-else class="text-xs text-muted-foreground">per task</p>
            </template>
            <span v-else class="text-sm text-muted-foreground">—</span>
          </td>
          <td class="py-4 px-4 text-right text-sm">
            <span v-if="model.speed != null">{{ model.speed }} t/s</span>
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
</template>

<style scoped>
table {
  min-width: 100%;
}
</style>
