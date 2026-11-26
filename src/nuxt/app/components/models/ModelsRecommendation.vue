<script setup lang="ts">
import type { ModelData } from '~/data/models'
import { buildRecommendation } from '~/utils/recommendation'
import {
  formatConfidenceInterval,
  formatMetricCost,
  formatModelName,
  metricUnitLabel
} from '~/utils/modelFormatters'
import { AGENT_BENCHMARKS, type AgentBenchmarkId } from '~/utils/agentBenchmarks'

const props = defineProps<{
  models: ModelData[]
}>()

// The quality bar: "at least as smart as this model".
const referenceSlug = ref<string | undefined>(undefined)
// Which benchmark the bar and the costs come from. Score and cost are never
// mixed across benchmarks.
const benchmarkId = ref<AgentBenchmarkId | null>(null)
// How many agent tasks the user runs per day.
const tasksPerDay = ref(5)

// Reference candidates: every model that has a score in at least one of the
// agent benchmarks.
const candidates = computed(() => {
  const scored = props.models.filter(model =>
    AGENT_BENCHMARKS.some(benchmark => benchmark.score(model) != null)
  )
  return scored.sort((a, b) => {
    const aScore = Math.max(
      ...AGENT_BENCHMARKS.map(benchmark => benchmark.score(a) ?? -1)
    )
    const bScore = Math.max(
      ...AGENT_BENCHMARKS.map(benchmark => benchmark.score(b) ?? -1)
    )
    return bScore - aScore
  })
})

watch(candidates, (list) => {
  if (!list.some(model => model.slug === referenceSlug.value)) {
    const preferred = list.find(model => model.slug?.includes('sonnet'))
      ?? list.find(model => model.slug?.includes('gpt-6-2-astra'))
      ?? list[Math.floor(list.length / 4)]
      ?? list[0]
    referenceSlug.value = preferred?.slug
  }
}, { immediate: true })

// The benchmarks the chosen reference model is measured in.
const availableBenchmarks = computed(() => {
  const reference = candidates.value.find(model => model.slug === referenceSlug.value)
  if (!reference) return []
  return AGENT_BENCHMARKS.filter(benchmark => benchmark.score(reference) != null)
})

watch(availableBenchmarks, (list) => {
  if (!list.some(benchmark => benchmark.id === benchmarkId.value)) {
    benchmarkId.value = list[0]?.id ?? null
  }
}, { immediate: true })

const result = computed(() =>
  buildRecommendation(
    props.models,
    referenceSlug.value ?? null,
    tasksPerDay.value,
    benchmarkId.value
  )
)

const benchmarkLabel = computed(() => result.value.benchmark?.label ?? '')

// Measured options first, then a couple of estimated ones (marked ≈), so
// models without a measured run - like MiniMax M2.7 - stay comparable.
const shownApiOptions = computed(() => [
  ...result.value.apiOptions.slice(0, 5),
  ...result.value.estimatedOptions.slice(0, 2)
])

function referenceLabel(): string {
  const reference = result.value.reference
  if (!reference) return ''
  return formatModelName(reference.name)
}

/** The agent/harness behind a measurement, when the source names one. */
function agentLabel(agent: string | null): string | null {
  return agent ?? null
}
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="font-semibold text-xl">Vilken modell ska du köra — och genom vad?</h2>
        <p class="text-sm text-muted-foreground mt-1">
          Välj en modell du vet klarar dina koduppgifter. Vi räknar ut vad den nivån kostar via
          API och jämför med prenumerationer vid din användning.
        </p>
      </div>
    </template>

    <div class="flex flex-wrap items-center gap-5 mb-5">
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Mätt på:</span>
        <USelect
          v-model="benchmarkId"
          :items="availableBenchmarks.map(b => ({ value: b.id, label: b.label }))"
          size="sm"
          class="w-52"
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Lika smart som:</span>
        <USelect
          v-model="referenceSlug"
          :items="candidates.map(m => ({ value: m.slug ?? '', label: formatModelName(m.name) }))"
          size="sm"
          class="w-72"
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Agentkörningar:</span>
        <USlider
          v-model="tasksPerDay"
          :min="1"
          :max="60"
          :step="1"
          class="w-40"
          :default-value="5"
        />
        <span class="text-sm font-medium tabular-nums">{{ tasksPerDay }}/dag</span>
      </div>
    </div>

    <div v-if="result.best && result.threshold !== null">
      <!-- The direct answer -->
      <div class="rounded-lg border border-green-500/30 bg-green-500/10 p-5">
        <p class="text-sm text-muted-foreground">
          Rekommendation på {{ referenceLabel() }}-nivå
          ({{ result.threshold.toFixed(1) }} {{ result.benchmark?.isPassRate ? '%' : 'poäng' }}
          på {{ benchmarkLabel }}):
        </p>
        <p class="text-lg font-semibold mt-1">
          {{ result.best.kind === 'plan' ? `Kör ${result.best.label} med ${formatModelName(result.best.model.name)}` : `Kör ${result.best.label} via API (${result.best.model.provider})` }}
        </p>
        <p class="text-sm mt-1">
          <span class="font-semibold text-green-600 dark:text-green-400">
            {{ result.best.costIsLowerBound ? '≤ ' : '' }}{{ formatMetricCost(result.best.costPerTask) }}
          </span>
          {{ metricUnitLabel(result.best.costIsPerAttempt) }}
          <template v-if="result.best.kind === 'plan'">
            vid din användning · {{ result.best.plan?.pricePerMonth.toFixed(2) }}$/mån
            <template v-if="result.best.breakEvenTasksPerMonth !== null">
              · lönar sig redan vid {{ result.best.breakEvenTasksPerMonth < 1 ? '1 körning/månad' : `${Math.ceil(result.best.breakEvenTasksPerMonth)} körningar/månad` }}
            </template>
            <template v-else>
              · kvoten dras enligt listpris
            </template>
          </template>
          <template v-else>
            (mätt på {{ benchmarkLabel }})
          </template>
        </p>
        <p class="text-xs text-muted-foreground mt-2">
          <template v-if="result.best.agent">
            Agent: {{ agentLabel(result.best.agent) }} ·
          </template>
          <template v-if="result.best.passRate !== null">
            Löser {{ result.best.passRate.toFixed(1) }} % av uppgifterna
            <template v-if="formatConfidenceInterval(result.best.ciLow, result.best.ciHigh)">
              (95 % CI {{ formatConfidenceInterval(result.best.ciLow, result.best.ciHigh) }})
            </template>
            ·
          </template>
          <template v-if="result.best.costPerAttempt !== null && !result.best.costIsPerAttempt">
            {{ formatMetricCost(result.best.costPerAttempt) }} per försök ·
          </template>
          <template v-if="result.benchmark?.harness && !result.best.agent">
            Harness: {{ result.benchmark.harness }} ·
          </template>
          Gränsen kommer från samma mätning som kostnaden.
        </p>
        <p v-if="result.best.costIsLowerBound" class="text-xs text-muted-foreground mt-1">
          ≤ betyder att planens användningsgränser inte publiceras som dollarbelopp. Kostnaden
          gäller så länge gränserna räcker vid din användning.
        </p>
      </div>

      <!-- The alternative without a subscription -->
      <div
        v-if="result.bestWithoutPlan && result.bestWithoutPlan !== result.best && result.best.kind === 'plan'"
        class="rounded-lg border border-border bg-muted/40 p-4 mt-3"
      >
        <p class="text-sm">
          <span class="font-medium">Utan prenumeration:</span>
          {{ result.bestWithoutPlan.label }} via {{ result.bestWithoutPlan.model.provider }}
          — {{ formatMetricCost(result.bestWithoutPlan.costPerTask) }}
          {{ metricUnitLabel(result.bestWithoutPlan.costIsPerAttempt) }}.
        </p>
      </div>

      <!-- Alternatives -->
      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <div v-if="result.planOptions.length > 0">
          <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Med prenumeration</h3>
          <ul class="space-y-2">
            <li
              v-for="option in result.planOptions"
              :key="option.plan?.id"
              class="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2"
            >
              <span>
                {{ option.label }}
                <span class="block text-xs text-muted-foreground">
                  {{ formatModelName(option.model.name) }}{{ option.plan && !option.plan.priceVerified ? ' · pris ej verifierat' : '' }}
                  <template v-if="option.agent"> · agent {{ option.agent }}</template>
                </span>
              </span>
              <span class="tabular-nums text-right">
                <span class="font-medium">
                  {{ option.costIsLowerBound ? '≤ ' : '' }}{{ formatMetricCost(option.costPerTask) }}
                </span>
                <span class="block text-xs text-muted-foreground">
                  {{ metricUnitLabel(option.costIsPerAttempt) }} ·
                  <template v-if="option.quotaKind === 'quota-units'">kvot i anrop · antalet uppgifter går inte att räkna ut</template>
                  <template v-else-if="option.quotaKind === 'credits-usd' && option.includedTasksPerMonth">
                    ≈{{ Math.floor(option.includedTasksPerMonth) }} körningar/mån inkluderat
                  </template>
                  <template v-else-if="option.costIsLowerBound">gränserna ej omräknade till $</template>
                  <template v-else>{{ option.plan?.pricePerMonth.toFixed(0) }}$/mån</template>
                </span>
              </span>
            </li>
          </ul>
        </div>
        <div v-if="shownApiOptions.length > 0">
          <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Utan prenumeration (API)</h3>
          <ul class="space-y-2">
            <li
              v-for="option in shownApiOptions"
              :key="option.model.slug"
              class="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2"
              :class="option.qualityKnown ? '' : 'opacity-75'"
            >
              <span>
                {{ option.label }}
                <span class="block text-xs text-muted-foreground">
                  via {{ option.model.provider }}
                  <template v-if="option.agent"> · agent {{ option.agent }}</template>
                  <template v-if="!option.qualityKnown"> · ≈ uppskattad kostnad, kodnivå ej mätt här</template>
                </span>
              </span>
              <span class="font-medium tabular-nums">
                {{ option.qualityKnown ? '' : '≈ ' }}{{ formatMetricCost(option.costPerTask) }}
                <span class="block text-xs font-normal text-muted-foreground">
                  {{ metricUnitLabel(option.costIsPerAttempt) }}
                </span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Plans that are not measured in this benchmark -->
      <div v-if="result.unmeasuredPlanOptions.length > 0" class="mt-4">
        <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Ej mätt i {{ benchmarkLabel }} — kan inte jämföras
        </h3>
        <ul class="space-y-2">
          <li
            v-for="option in result.unmeasuredPlanOptions"
            :key="option.plan?.id"
            class="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2 opacity-75"
          >
            <span>
              {{ option.label }}
              <span class="block text-xs text-muted-foreground">
                {{ formatModelName(option.model.name) }} · ≈ kodnivå ej mätt i det här benchmarket
              </span>
            </span>
            <span class="tabular-nums text-right">
              <span class="font-medium">
                {{ option.costIsLowerBound ? '≤ ' : '' }}≈{{ formatMetricCost(option.costPerTask) }}
              </span>
              <span class="block text-xs text-muted-foreground">
                {{ metricUnitLabel(option.costIsPerAttempt) }} · kodnivå ej mätt
              </span>
            </span>
          </li>
        </ul>
      </div>

      <!-- Models that clear the bar but have no measured cost -->
      <p v-if="result.unpricedOptions.length > 0" class="text-xs text-muted-foreground mt-4">
        {{ result.unpricedOptions.length }} modeller klarar nivån i {{ benchmarkLabel }} men saknar
        publicerad kostnad för samma körning, så de går inte att prissätta här.
      </p>

      <p class="text-xs text-muted-foreground mt-5">
        Kvalitetsnivå och kostnad kommer från samma benchmark och samma körning
        ({{ benchmarkLabel }}{{ result.benchmark?.harness ? ` · ${result.benchmark.harness}` : '' }}),
        aldrig från två källor som blandas ihop. Token-uppskattningar används inte i rankningen.
        Planernas användningsgränser ingår i beräkningen: credits-planer räknas med inkluderad kvot
        och listpris för överkostnad, medan planer med mjuka gränser (5-timmarsfönster) bara kan visas
        som en undre gräns (≤).
      </p>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      Välj en referensmodell för att se rekommendationen.
    </p>
  </UCard>
</template>
