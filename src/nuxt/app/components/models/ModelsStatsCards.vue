<script setup lang="ts">
import type { ModelData } from '~/data/models'
import {
  getBenchmarkCostPerAttempt,
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
  bestValue?: ModelData
  topScore?: ModelData
  lowestCost?: ModelData
  benchmark: RankingBenchmark
  includeEstimatedScores: boolean
}>()

const benchmarkOption = computed(() => getBenchmarkOption(props.benchmark))

function formatMetric(model?: ModelData): string {
  if (!model) return '—'
  const metric = getBenchmarkRankingMetric(model, props.benchmark, props.includeEstimatedScores)
  if (!metric) return '—'
  if (metric.kind === 'cost-per-success') return formatCostPerSuccessfulTask(metric.value)
  if (metric.kind === 'score-only') return `${metric.value.toFixed(1)} / 100`
  return formatCodingValue(metric.value)
}

function formatScore(model?: ModelData): string {
  if (!model) return '—'
  const score = getBenchmarkScore(model, props.benchmark, props.includeEstimatedScores)
  return score === null ? '—' : `${score.toFixed(1)} / 100`
}

function getBestValueTitle(): string {
  if (props.benchmark === 'benchlm') return 'Bästa BenchLM-kodpoäng'
  if (props.benchmark === 'estimated') return 'Bäst prisvärd (uppskattat)'
  if (props.benchmark === 'aa-coding-agent') return 'Bäst prisvärd (kod, mätt)'
  return 'Billigast per lyckad uppgift'
}

function getCostTitle(): string {
  if (props.benchmark === 'aa-coding-agent') return 'Lägst AA-kostnad per uppgift'
  if (props.benchmark === 'estimated') return 'Lägst uppskattad kostnad'
  return 'Lägst kostnad per uppgift'
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    <UCard
      v-if="benchmark !== 'benchlm'"
      class="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20"
    >
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-green-500/20">
          <UIcon name="i-lucide-trophy" class="w-6 h-6 text-green-500" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">{{ getBestValueTitle() }}</p>
          <a
            v-if="bestValue"
            :href="`https://artificialanalysis.ai/models/${bestValue.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-lg hover:underline hover:text-primary"
          >
            {{ bestValue.name }}
          </a>
          <p class="text-sm text-green-500">{{ formatMetric(bestValue) }}</p>
          <p v-if="bestValue" class="text-xs text-muted-foreground">
            {{ benchmarkOption.label }} · poäng {{ formatScore(bestValue) }}
          </p>
        </div>
      </div>
    </UCard>

    <UCard
      v-else
      class="bg-gradient-to-br from-muted/50 to-muted/20 border-border"
    >
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-muted">
          <UIcon name="i-lucide-info" class="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Ingen prisanknuten värderingsranking</p>
          <p class="text-sm font-medium">BenchLM ger en kvalitetspoäng, men ingen matchad uppgiftskostnad.</p>
          <p class="text-xs text-muted-foreground">Välj DeepSWE, Terminal-Bench eller AA Coding Agent för en kostnadsjämförelse.</p>
        </div>
      </div>
    </UCard>

    <UCard class="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-purple-500/20">
          <UIcon name="i-lucide-code-2" class="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Högst {{ benchmarkOption.label }}-poäng</p>
          <a
            v-if="topScore"
            :href="`https://artificialanalysis.ai/models/${topScore.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-lg hover:underline hover:text-primary"
          >
            {{ topScore.name }}
          </a>
          <p class="text-sm text-purple-500">{{ formatScore(topScore) }}</p>
        </div>
      </div>
    </UCard>

    <UCard
      v-if="benchmark !== 'benchlm'"
      class="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20"
    >
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-blue-500/20">
          <UIcon name="i-lucide-coins" class="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">{{ getCostTitle() }}</p>
          <a
            v-if="lowestCost"
            :href="`https://artificialanalysis.ai/models/${lowestCost.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-lg hover:underline hover:text-primary"
          >
            {{ lowestCost.name }}
          </a>
          <p class="text-sm text-blue-500">
            {{ formatCost(lowestCost ? getBenchmarkCostPerAttempt(lowestCost, benchmark) : null) }}
          </p>
          <p v-if="lowestCost" class="text-xs text-muted-foreground">
            {{ benchmarkOption.costLabel }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
