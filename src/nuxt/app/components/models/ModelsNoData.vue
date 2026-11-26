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
        <p class="font-semibold text-lg">Ingen data tillgänglig</p>
        <p class="text-sm text-muted-foreground mt-1">
          Tryck på "Hämta data" för att hämta de senaste modellerna från Artificial Analysis.
        </p>
      </div>
      <UButton
        :loading="loading"
        icon="i-lucide-refresh-cw"
        @click="emit('fetch')"
      >
        Hämta data
      </UButton>
    </div>
  </UCard>
</template>
