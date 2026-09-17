<script setup lang="ts">
import type { ModelData } from '~/data/models'
import { formatCost } from '~/utils/modelFormatters'

defineProps<{
  bestValue?: ModelData
  topIntelligence?: ModelData
  lowestCost?: ModelData
}>()
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <!-- Best Value Card -->
    <UCard class="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-green-500/20">
          <UIcon name="i-lucide-trophy" class="w-6 h-6 text-green-500" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Best Value Model</p>
          <a
            v-if="bestValue"
            :href="`https://artificialanalysis.ai/models/${bestValue.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-lg hover:underline hover:text-primary"
          >
            {{ bestValue.name }}
          </a>
          <p class="text-sm text-green-500">
            Ratio: {{ bestValue ? (bestValue.intelligenceIndex / (bestValue.costPerTask ?? 1)).toFixed(0) : 0 }}x
          </p>
        </div>
      </div>
    </UCard>

    <!-- Top Intelligence Card -->
    <UCard class="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-purple-500/20">
          <UIcon name="i-lucide-cpu" class="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Highest Intelligence</p>
          <a
            v-if="topIntelligence"
            :href="`https://artificialanalysis.ai/models/${topIntelligence.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-lg hover:underline hover:text-primary"
          >
            {{ topIntelligence.name }}
          </a>
          <p class="text-sm text-purple-500">
            Index: {{ topIntelligence?.intelligenceIndex }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- Lowest Cost Card -->
    <UCard class="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
      <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-amber-500/20">
          <UIcon name="i-lucide-coins" class="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Lowest Cost per Task</p>
          <a
            v-if="lowestCost"
            :href="`https://artificialanalysis.ai/models/${lowestCost.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-lg hover:underline hover:text-primary"
          >
            {{ lowestCost.name }}
          </a>
          <p class="text-sm text-amber-500">
            {{ formatCost(lowestCost?.costPerTask || 0) }}/task
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
