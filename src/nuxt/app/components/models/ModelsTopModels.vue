<script setup lang="ts">
import { computed } from 'vue'
import type { ModelData } from '~/data/models'
import {
  getBenchmarkCostPerAttempt,
  getBenchmarkCostPerSuccessfulTask,
  getBenchmarkOption,
  getBenchmarkRankingMetric,
  getBenchmarkScore,
  type RankingBenchmark
} from '~/utils/modelScoring'
import {
  formatCodingValue,
  formatCost,
  formatCostPerSuccessfulTask
} from '~/utils/modelFormatters'

const props = defineProps<{
  models: ModelData[]
  benchmark: RankingBenchmark
  includeEstimatedScores: boolean
}>()

const benchmarkOption = computed(() => getBenchmarkOption(props.benchmark))

function formatMetric(model: ModelData): string {
  const metric = getBenchmarkRankingMetric(model, props.benchmark, props.includeEstimatedScores)
  if (!metric) return '—'
  if (metric.kind === 'cost-per-success') return formatCostPerSuccessfulTask(metric.value)
  if (metric.kind === 'score-only') return `${metric.value.toFixed(1)} / 100`
  return formatCodingValue(metric.value)
}

function getCost(model: ModelData): number | null {
  return getBenchmarkCostPerSuccessfulTask(model, props.benchmark) ??
    getBenchmarkCostPerAttempt(model, props.benchmark)
}

function formatFrontierCost(model: ModelData): string {
  return props.benchmark === 'terminal-bench-4-1' || props.benchmark === 'terminal-bench-4-0' || props.benchmark === 'deep-swe'
    ? formatCostPerSuccessfulTask(getCost(model))
    : formatCost(getCost(model))
}
</script>

<template>
  <div>
    <div class="flex items-center gap-2 mb-3">
      <UIcon name="i-lucide-star" class="w-5 h-5 text-primary" />
      <h3 class="font-semibold text-lg">{{ benchmarkOption.label }}-frontier</h3>
      <UBadge variant="subtle" color="primary" size="sm">Bästa avvägningar</UBadge>
    </div>
    <p class="text-sm text-muted-foreground mb-3">
      Pareto-optimala modeller som bara använder {{ benchmarkOption.label }}-poängen och dess matchade kostnadsdata.
    </p>
    <div class="flex flex-wrap gap-2">
      <UCard
        v-for="model in models"
        :key="model.id"
        class="min-w-[220px] flex-1"
      >
        <div class="flex items-center gap-2 mb-2">
          <a
            :href="`https://artificialanalysis.ai/models/${model.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-sm truncate hover:underline hover:text-primary"
          >
            {{ model.name }}
          </a>
          <UBadge v-if="model.category" :color="(model.category.toLowerCase()) as any" size="xs">
            {{ model.category }}
          </UBadge>
          <span v-else class="text-muted-foreground text-xs">—</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-muted-foreground">Poäng:</span>
            <span class="font-semibold ml-1">
              {{ getBenchmarkScore(model, benchmark, includeEstimatedScores)?.toFixed(1) ?? '—' }}
            </span>
          </div>
          <div>
            <span class="text-muted-foreground">{{ benchmarkOption.rankingLabel }}:</span>
            <span class="font-semibold ml-1">{{ formatMetric(model) }}</span>
          </div>
          <div class="col-span-2">
            <span class="text-muted-foreground">Kostnad:</span>
            <span class="font-semibold ml-1">{{ formatFrontierCost(model) }}</span>
            <span v-if="benchmark === 'terminal-bench-4-1' || benchmark === 'terminal-bench-4-0' || benchmark === 'deep-swe'" class="text-muted-foreground ml-1">
              ({{ formatCost(getBenchmarkCostPerAttempt(model, benchmark)) }} per försök)
            </span>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
