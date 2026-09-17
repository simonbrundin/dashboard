<script setup lang="ts">
import type { Category, SortColumn } from '~/composables/useModelFilters'

const props = defineProps<{
  selectedCategory: Category
  sortBy: SortColumn
  showOnlyOpenWeights: boolean
  categoryStats: {
    all: number
    frontier: number
    high: number
    mid: number
    budget: number
    openWeights: number
  }
}>()

const emit = defineEmits<{
  'update:selectedCategory': [value: Category]
  'update:sortBy': [value: SortColumn]
  'toggleOpenWeights': []
}>()

const categories: Category[] = ['all', 'frontier', 'high', 'mid', 'budget']

const sortOptions = [
  { value: 'value', label: 'Best Value (Int/Cost)' },
  { value: 'intelligence', label: 'Intelligence Index' },
  { value: 'cost', label: 'Lowest Cost' },
  { value: 'speed', label: 'Fastest Speed' }
] as const
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <!-- Category Filter -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">Category:</span>
      <div class="flex gap-1">
        <UButton
          v-for="cat in categories"
          :key="cat"
          :variant="selectedCategory === cat ? 'solid' : 'outline'"
          :color="selectedCategory === cat ? 'primary' : 'neutral'"
          size="xs"
          @click="emit('update:selectedCategory', cat)"
        >
          {{ cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1) }}
          <span class="ml-1 opacity-60">
            ({{ cat === 'all' ? categoryStats.all : categoryStats[cat] }})
          </span>
        </UButton>
      </div>
    </div>

    <!-- Sort -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">Sort by:</span>
      <USelect
        :model-value="sortBy"
        :options="sortOptions"
        size="xs"
        class="w-48"
        @update:model-value="emit('update:sortBy', $event)"
      />
    </div>

    <!-- Open Weights Toggle -->
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="relative inline-flex h-5 w-9 items-center rounded-full bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="{ 'bg-primary': showOnlyOpenWeights }"
        @click="emit('toggleOpenWeights')"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
          :class="{ 'translate-x-4': showOnlyOpenWeights, 'translate-x-0': !showOnlyOpenWeights }"
        />
      </button>
      <span class="text-sm text-muted-foreground">Open weights only</span>
      <span class="text-xs text-muted-foreground">({{ categoryStats.openWeights }} models)</span>
    </div>
  </div>
</template>
