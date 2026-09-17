<script setup lang="ts">
import { formatDate } from '~/utils/modelFormatters'

defineProps<{
  total: number
  withPrice: number
  withoutPrice: number
  updatedAt?: string | null
}>()
</script>

<template>
  <div class="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4 border border-primary/20">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="p-2 rounded-lg bg-primary/20">
          <UIcon name="i-lucide-brain" class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 class="font-semibold text-lg">
            Intelligence Index vs. Cost per Task
          </h2>
          <p class="text-sm text-muted-foreground mt-1">
            <span class="font-semibold">{{ total }}</span> modeller i databasen.
            <span v-if="withPrice > 0"> ({{ withPrice }} med pris)</span>
            <span v-if="withoutPrice > 0">, {{ withoutPrice }} utan pris</span>
          </p>
          <p v-if="updatedAt" class="text-xs text-muted-foreground mt-1">
            Last updated: {{ formatDate(updatedAt) }}
          </p>
        </div>
      </div>
      <div class="text-right">
        <div class="text-2xl font-bold">{{ total }}</div>
        <div class="text-xs text-muted-foreground">I databasen</div>
      </div>
    </div>
  </div>
</template>
