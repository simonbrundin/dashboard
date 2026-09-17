<script setup lang="ts">
defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  fetch: []
}>()
</script>

<template>
  <UCard class="text-center py-12">
    <div class="flex flex-col items-center gap-4">
      <UIcon name="i-lucide-database" class="w-12 h-12 text-muted-foreground" />
      <div>
        <p class="font-semibold text-lg">No Data Available</p>
        <p class="text-sm text-muted-foreground mt-1">
          Click "Scrape Data" to fetch the latest models from Artificial Analysis.
        </p>
      </div>
      <UButton
        :loading="loading"
        icon="i-lucide-refresh-cw"
        @click="emit('fetch')"
      >
        Update Data
      </UButton>
    </div>
  </UCard>
</template>
