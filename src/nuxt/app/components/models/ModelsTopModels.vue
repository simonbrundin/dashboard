<script setup lang="ts">
import type { ModelData } from '~/data/models'
import {
  getBenchLmCodingScore,
  getCodingValue,
  getCodingScore,
  getTaskCost,
  getTerminalBenchCodingScore
} from '~/utils/modelScoring'
import { formatCodingValue, formatCost } from '~/utils/modelFormatters'

defineProps<{
  models: ModelData[]
}>()

function formatCodingScore(model: ModelData): string {
  const score = getCodingScore(model)
  return score == null ? '—' : score.toFixed(1)
}
</script>

<template>
  <div>
    <div class="flex items-center gap-2 mb-3">
      <UIcon name="i-lucide-star" class="w-5 h-5 text-primary" />
      <h3 class="font-semibold text-lg">Coding Value Frontier</h3>
      <UBadge variant="subtle" color="primary" size="sm">Best trade-offs</UBadge>
    </div>
    <p class="text-sm text-muted-foreground mb-3">
      Pareto-optimal models: highest coding score for the lowest cost per successful task.
      Requires both a coding score (Terminal-Bench or BenchLM) and a measured benchmark cost.
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
          <UBadge :color="(model.category?.toLowerCase() ?? 'neutral') as any" size="xs">
            {{ model.category }}
          </UBadge>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-muted-foreground">Combined:</span>
            <span class="font-semibold ml-1">{{ formatCodingScore(model) }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Value:</span>
            <span class="font-semibold ml-1">{{ formatCodingValue(getCodingValue(model)) }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">TB:</span>
            <span class="font-semibold ml-1">{{ getTerminalBenchCodingScore(model) ?? '—' }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">BenchLM:</span>
            <span class="font-semibold ml-1">{{ getBenchLmCodingScore(model) ?? '—' }}</span>
          </div>
          <div class="col-span-2">
            <span class="text-muted-foreground">Cost/success:</span>
            <span class="font-semibold ml-1">{{ formatCost(getTaskCost(model)) }}</span>
            <span class="text-xs text-muted-foreground ml-1">({{ formatCost(model.terminalBenchCostPerSuccessfulTask ?? model.deepSweCostPerSuccessfulTask) }})</span>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
