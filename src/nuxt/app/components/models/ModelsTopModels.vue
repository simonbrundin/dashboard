<script setup lang="ts">
import type { ModelData } from '~/data/models'
import { getCategoryColor, formatCost } from '~/utils/modelFormatters'

defineProps<{
  models: ModelData[]
}>()
</script>

<template>
  <div>
    <div class="flex items-center gap-2 mb-3">
      <UIcon name="i-lucide-star" class="w-5 h-5 text-primary" />
      <h3 class="font-semibold text-lg">Top Models</h3>
      <UBadge variant="subtle" color="primary" size="sm">Best in Class</UBadge>
    </div>
    <div class="flex flex-wrap gap-2">
      <UCard
        v-for="model in models"
        :key="model.id"
        class="min-w-[200px] flex-1"
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
          <UBadge :class="getCategoryColor(model.category)" size="xs">
            {{ model.category }}
          </UBadge>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-muted-foreground">Intelligence:</span>
            <span class="font-semibold ml-1">{{ model.intelligenceIndex }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Cost:</span>
            <span class="font-semibold ml-1">{{ formatCost(model.costPerTask) }}</span>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
