export function useProgress() {
  const show = ref(false)
  const percent = ref(0)
  const current = ref(0)
  const total = ref(0)
  const timeRemaining = ref('')

  let startTime = 0
  let interval: ReturnType<typeof setInterval> | null = null

  function updateTimeRemaining() {
    if (percent.value >= 100) {
      timeRemaining.value = 'Klart!'
      return
    }
    const elapsed = Date.now() - startTime
    if (percent.value > 0) {
      const totalTime = (elapsed / percent.value) * 100
      const remaining = totalTime - elapsed
      const minutes = Math.ceil(remaining / 60000)
      if (minutes < 1) timeRemaining.value = '< 1 min'
      else if (minutes < 60) timeRemaining.value = `~${minutes} min`
      else {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        timeRemaining.value = `~${h}h ${m}m`
      }
    } else {
      timeRemaining.value = 'Beräknar...'
    }
  }

  function start(totalItems: number) {
    show.value = true
    total.value = totalItems
    current.value = 0
    percent.value = 0
    startTime = Date.now()
    timeRemaining.value = 'Beräknar...'

    interval = setInterval(updateTimeRemaining, 5000)
  }

  function update(currentItem: number, totalItems: number) {
    current.value = currentItem
    total.value = totalItems
    percent.value = totalItems > 0 ? Math.round((currentItem / totalItems) * 100) : 0
    updateTimeRemaining()
  }

  function stop() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
    percent.value = 100
    timeRemaining.value = 'Klart!'
    setTimeout(() => { show.value = false }, 2000)
  }

  return {
    show,
    percent,
    current,
    total,
    timeRemaining,
    start,
    update,
    stop
  }
}
