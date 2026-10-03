<script setup lang="ts">
import type { ModelData } from '~/data/models'
import type { SortColumn } from '~/composables/useModelFilters'
import {
  getBenchLmCodingScore,
  getTerminalBenchCodingScore,
  getBenchLmMatchLabel,
  getCodingConfidenceLabel,
  getCodingCostLabel,
  getCodingScore,
  getCodingValue,
  getRankingCodingValue,
  getTaskCost
} from '~/utils/modelScoring'
import { getCategoryColor, formatCodingValue, formatCost, getValueRating } from '~/utils/modelFormatters'

defineProps<{
  models: ModelData[]
  sortBy: SortColumn
  sortDirection: 'asc' | 'desc'
  includeEstimatedScores: boolean
}>()

const emit = defineEmits<{
  sort: [column: SortColumn]
}>()

function getCodingPercent(index: number | null | undefined): number {
  if (index == null) return 0
  return Math.min(Math.max(index, 0), 100)
}

function getIntelligencePercent(index: number): number {
  return Math.min((index / 70) * 100, 100)
}

function getDisplayedCodingValue(
  model: ModelData,
  includeEstimatedScores: boolean
): number | null {
  return getRankingCodingValue(model, includeEstimatedScores)
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="border-b border-border">
          <th class="text-left py-3 px-4 font-medium text-muted-foreground">
            Model
          </th>
          <th
            class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
            @click="emit('sort', 'codingValue')"
          >
            <span class="flex items-center justify-end gap-1">
              Coding Value (per successful task)
              <UIcon
                v-if="sortBy === 'codingValue'"
                :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
                class="w-4 h-4"
              />
            </span>
          </th>
          <th class="text-center py-3 px-4 font-medium text-muted-foreground">
            Category
          </th>
          <th
            class="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
            @click="emit('sort', 'coding')"
          >
            <span class="flex items-center justify-end gap-1">
              Coding Score (TB + BenchLM)
              <UIcon
                v-if="sortBy === 'coding'"
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
            @click="emit('sort', 'cost')"
          >
            <span class="flex items-center justify-end gap-1">
              Cost/Task
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
              Speed
              <UIcon
                v-if="sortBy === 'speed'"
                :name="sortDirection === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
                class="w-4 h-4"
              />
            </span>
          </th>
          <th class="text-center py-3 px-4 font-medium text-muted-foreground">
            Open
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
                  {{ model.name }}
                </a>
                <p class="text-xs text-muted-foreground">{{ model.provider }}</p>
              </div>
            </div>
          </td>
          <td class="py-4 px-4 text-right">
            <template v-if="getDisplayedCodingValue(model, includeEstimatedScores) !== null">
              <div class="flex items-center justify-end gap-2">
                <div class="flex items-center gap-1">
                  <span
                    v-for="n in 5"
                    :key="n"
                    class="text-primary"
                  >
                    {{ n <= Math.round(getValueRating(getDisplayedCodingValue(model, includeEstimatedScores)).stars) ? '★' : '☆' }}
                  </span>
                </div>
                <span class="text-sm font-semibold text-primary">
                  {{ formatCodingValue(getDisplayedCodingValue(model, includeEstimatedScores)) }}
                </span>
              </div>
              <p class="text-[11px] text-muted-foreground">
                {{ getCodingCostLabel(model) }}
              </p>
            </template>
            <template
              v-else-if="getCodingValue(model) !== null && !includeEstimatedScores && model.benchLmEvidenceStatus?.toLowerCase() !== 'supported'"
            >
              <span class="text-sm text-muted-foreground">Estimated only</span>
              <p class="text-[11px] text-muted-foreground">Enable estimated scores to rank</p>
            </template>
            <template v-else-if="getCodingScore(model) !== null && getTaskCost(model) === null">
              <span class="text-sm text-muted-foreground">No successful-task cost</span>
              <p class="text-[11px] text-muted-foreground">Terminal-Bench or DeepSWE cost unavailable</p>
            </template>
            <span v-else class="text-sm text-muted-foreground">Unavailable</span>
          </td>
          <td class="py-4 px-4 text-center">
            <UBadge :class="getCategoryColor(model.category)" size="sm">
              {{ model.category }}
            </UBadge>
          </td>
          <td class="py-4 px-4 text-right">
            <div class="flex items-center justify-end gap-1">
              <span v-if="getCodingScore(model) != null" class="font-bold">{{ getCodingScore(model)?.toFixed(1) }}</span>
              <span v-else class="text-muted-foreground">—</span>
              <div class="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-green-500 rounded-full"
                  :style="{ width: `${getCodingPercent(getCodingScore(model))}%` }"
                />
              </div>
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              TB {{ getTerminalBenchCodingScore(model) ?? '—' }} · BenchLM {{ getBenchLmCodingScore(model) ?? '—' }}
              <span v-if="model.benchLmEvidenceStatus"> · {{ model.benchLmEvidenceStatus }}</span>
              <span v-if="getCodingScore(model) != null"> · {{ getCodingConfidenceLabel(model) }} · {{ getBenchLmMatchLabel(model) }}</span>
            </p>
          </td>
          <td class="py-4 px-4 text-right">
            <div class="flex items-center justify-end gap-1">
              <span class="font-bold">{{ model.intelligenceIndex }}</span>
              <div class="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full"
                  :style="{ width: `${getIntelligencePercent(model.intelligenceIndex)}%` }"
                />
              </div>
            </div>
          </td>
          <td class="py-4 px-4 text-right">
            <span class="font-mono">{{ formatCost(model.costPerTask) }}</span>
            <p class="text-xs text-muted-foreground">
              {{ getCodingCostLabel(model) }}
            </p>
            <p
              v-if="model.terminalBenchCostPerSuccessfulTask != null || model.deepSweCostPerSuccessfulTask != null"
              class="text-[11px] text-muted-foreground"
            >
              TB {{ formatCost(model.terminalBenchCostPerSuccessfulTask) }} · DeepSWE {{ formatCost(model.deepSweCostPerSuccessfulTask) }}
            </p>
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
