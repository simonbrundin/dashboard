<script setup lang="ts">
defineProps<{
  current: number
  total: number
  timeRemaining: string
  percent: number
  statusMessage?: string
}>()
</script>

<template>
  <div class="bg-primary/10 rounded-lg p-4 border border-primary/20">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin text-primary" />
        <span class="text-sm font-medium">{{ statusMessage || 'Hämtar...' }}</span>
      </div>
      <div class="text-right">
        <span class="text-sm font-semibold">{{ current }} / {{ total }}</span>
        <span class="text-xs text-muted-foreground ml-2">{{ timeRemaining }}</span>
      </div>
    </div>
    <div class="h-2 bg-primary/20 rounded-full overflow-hidden">
      <div
        class="h-full bg-primary transition-all duration-300 rounded-full"
        :style="{ width: `${percent}%` }"
      />
    </div>
  </div>
</template>
