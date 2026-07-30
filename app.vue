<script setup lang="ts">
const status = ref<'up' | 'down' | 'checking'>('checking')
const lastChecked = ref<Date | null>(null)
const responseTime = ref<number | null>(null)

const url = 'https://plan.simonbrundin.com'

async function checkStatus() {
  status.value = 'checking'
  const start = Date.now()
  
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors'
    })
    responseTime.value = Date.now() - start
    status.value = 'up'
  } catch {
    status.value = 'down'
    responseTime.value = null
  }
  
  lastChecked.value = new Date()
}

// Check immediately and then every 60 seconds
onMounted(() => {
  checkStatus()
  setInterval(checkStatus, 60000)
})

const statusColor = computed(() => {
  switch (status.value) {
    case 'up': return 'text-green-500'
    case 'down': return 'text-red-500'
    default: return 'text-yellow-500'
  }
})

const statusText = computed(() => {
  switch (status.value) {
    case 'up': return 'Online'
    case 'down': return 'Offline'
    default: return 'Checking...'
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-8">
    <div class="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800">
      <h1 class="text-2xl font-bold text-gray-100 mb-2">
        Status Dashboard
      </h1>
      
      <div class="flex items-center gap-4 mt-6">
        <!-- Status Indicator (Uptime Kuma style) -->
        <div class="relative">
          <div 
            class="w-12 h-12 rounded-full transition-colors duration-300"
            :class="{
              'bg-green-500': status === 'up',
              'bg-red-500 animate-pulse': status === 'down',
              'bg-yellow-500 animate-pulse': status === 'checking'
            }"
          />
          <div 
            v-if="status === 'up'"
            class="absolute inset-0 w-12 h-12 rounded-full bg-green-500 opacity-30 animate-ping"
          />
        </div>
        
        <div>
          <p class="text-xl font-semibold text-gray-100">
            plan.simonbrundin.com
          </p>
          <p class="text-lg" :class="statusColor">
            {{ statusText }}
          </p>
          <p v-if="responseTime" class="text-sm text-gray-500 mt-1">
            {{ responseTime }}ms
          </p>
        </div>
      </div>
      
      <div class="mt-6 pt-4 border-t border-gray-800">
        <p class="text-sm text-gray-500">
          Uppdateras var 60:e sekund
        </p>
        <p v-if="lastChecked" class="text-xs text-gray-600 mt-1">
          Senast kontrollerad: {{ lastChecked.toLocaleTimeString('sv-SE') }}
        </p>
      </div>
      
      <button 
        @click="checkStatus"
        class="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
      >
        Kontrollera nu
      </button>
    </div>
  </div>
</template>
