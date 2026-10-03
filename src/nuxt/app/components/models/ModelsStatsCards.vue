<script setup lang="ts">
import type { ModelData } from '~/data/models'
import {
  getCodingScore,
  getCodingValue,
  getTaskCost,
  getTerminalBenchCodingScore,
  getBenchLmCodingScore
} from '~/utils/modelScoring'
import { formatCodingValue, formatCost } from '~/utils/modelFormatters'

defineProps<{
  bestMeasuredCodingValue?: ModelData
  topCoding?: ModelData
  lowestCost?: ModelData
}>()

function formatCodingScore(model?: ModelData): string {
  const score = model ? getCodingScore(model) : null
  return score == null ? '—' : score.toFixed(1)
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    <!-- Best measured coding value card -->
    <UCard class="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-green-500/20">
          <UIcon name="i-lucide-trophy" class="w-6 h-6 text-green-500" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Best Coding Value</p>
          <a
            v-if="bestMeasuredCodingValue"
            :href="`https://artificialanalysis.ai/models/${bestMeasuredCodingValue.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-lg hover:underline hover:text-primary"
          >
            {{ bestMeasuredCodingValue.name }}
          </a>
          <p class="text-sm text-green-500">
            {{ bestMeasuredCodingValue ? formatCodingValue(getCodingValue(bestMeasuredCodingValue)) : '—' }}
          </p>
          <p v-if="bestMeasuredCodingValue" class="text-xs text-muted-foreground">
            Cost per successful task: {{ formatCost(getTaskCost(bestMeasuredCodingValue)) }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- Highest coding score card -->
    <UCard class="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-purple-500/20">
          <UIcon name="i-lucide-code-2" class="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Highest Coding Score</p>
          <a
            v-if="topCoding"
            :href="`https://artificialanalysis.ai/models/${topCoding.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-lg hover:underline hover:text-primary"
          >
            {{ topCoding.name }}
          </a>
          <p class="text-sm text-purple-500">
            Combined: {{ formatCodingScore(topCoding) }} / 100
          </p>
          <p v-if="topCoding" class="text-xs text-muted-foreground">
            TB {{ getTerminalBenchCodingScore(topCoding) ?? '—' }} · BenchLM {{ getBenchLmCodingScore(topCoding) ?? '—' }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- Lowest cost per successful task card -->
    <UCard class="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-blue-500/20">
          <UIcon name="i-lucide-coins" class="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Lowest Cost per Successful Task</p>
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
            {{ formatCost(lowestCost ? getTaskCost(lowestCost) : null) }}
          </p>
          <p v-if="lowestCost" class="text-xs text-muted-foreground">
            {{ formatCost((lowestCost as ModelData).terminalBenchCostPerSuccessfulTask ?? (lowestCost as ModelData).deepSweCostPerSuccessfulTask) }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
