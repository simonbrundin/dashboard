<script setup lang="ts">
import type { ModelData } from '~/data/models'
import { buildRecommendation, type RecommendationOption } from '~/utils/recommendation'
import {
  formatConfidenceInterval,
  formatMetricCost,
  formatModelName,
  metricUnitLabel
} from '~/utils/modelFormatters'
import { AGENT_BENCHMARKS } from '~/utils/agentBenchmarks'
import { getModelUsageLimits, usageLimitRows } from '~/utils/usageLimits'
import { useAgentBenchmarkId, useAgentTasksPerDay } from '~/composables/useAgentBenchmark'

const props = defineProps<{
  models: ModelData[]
}>()

// The quality bar: "at least as smart as this model". Without a reference the
// page answers with the quality/cost frontier instead, which needs no input.
const referenceSlug = ref<string | null>(null)
// Which benchmark the bar and the costs come from. Score and cost are never
// mixed across benchmarks. The decision table reads the same value, so both
// views always describe the same measurement.
const benchmarkId = useAgentBenchmarkId()
// How many agent tasks the user runs per day.
const tasksPerDay = useAgentTasksPerDay()

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

// The benchmarks the chosen reference model is measured in. Without a
// reference every benchmark with measurements is available.
const availableBenchmarks = computed(() => {
  if (referenceSlug.value === null) {
    return AGENT_BENCHMARKS.filter(benchmark =>
      props.models.some(model => benchmark.score(model) != null)
    )
  }
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
    referenceSlug.value,
    tasksPerDay.value,
    benchmarkId.value
  )
)

const benchmarkLabel = computed(() => result.value.benchmark?.label ?? '')

/** True when no reference model is chosen: the answer is the frontier. */
const frontierMode = computed(() => referenceSlug.value === null)

/** The published usage limits of the recommended model. */
const bestLimits = computed(() => {
  const model = result.value.best?.model
  if (!model) return []
  const limits = getModelUsageLimits(model)
  const rows = [...usageLimitRows(limits)]
  if (limits.notPublished) {
    rows.unshift({
      period: 'gräns',
      text: 'ej publicerade i siffror',
      unquantified: true
    })
  }
  return rows
})

// Measured options first, then a couple of estimated ones (marked ≈), so
// models without a measured run - like MiniMax M2.7 - stay comparable.
const shownApiOptions = computed(() => [
  ...result.value.apiOptions.slice(0, 5),
  ...result.value.estimatedOptions.slice(0, 2)
])

/** The score, its confidence interval and the agent behind it. */
function scoreLine(option: RecommendationOption): string {
  const parts: string[] = []
  if (option.score != null) {
    parts.push(
      `${option.score.toFixed(1)} ${result.value.benchmark?.isPassRate ? '%' : 'poäng'}`
    )
  }
  const ci = formatConfidenceInterval(option.ciLow, option.ciHigh)
  if (ci) parts.push(`95 % CI ${ci}`)
  if (option.agent) parts.push(`agent ${option.agent}`)
  return parts.join(' · ')
}

/** The cost of this option per month at the user's usage level. */
function monthlyCost(option: RecommendationOption): number | null {
  if (!option.costIsVerifiable) return null
  // The usage level counts attempts: that is what you pay for. A solved task
  // costs more, because only part of the attempts succeed.
  const perAttempt = option.costPerAttempt ?? option.costPerTask
  if (perAttempt === null) return null
  return perAttempt * tasksPerDay.value * 30
}

/** The number of tasks per month where a plan costs the same as the API. */
function breakEvenText(option: RecommendationOption): string {
  if (option.breakEvenTasksPerMonth === null) return 'går inte att räkna ut'
  if (option.breakEvenTasksPerMonth < 1) return 'redan vid 1 körning/månad'
  return `vid ${Math.ceil(option.breakEvenTasksPerMonth)} körningar/månad`
}

function referenceLabel(): string {
  const reference = result.value.reference
  if (!reference) return ''
  return formatModelName(reference.name)
}

/** The agent/harness behind a measurement, when the source names one. */
function agentLabel(agent: string | null): string | null {
  return agent ?? null
}

/** The frontier, best quality first. */
const frontierOptions = computed(() =>
  [...result.value.frontier].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
      || (a.costPerTask ?? Infinity) - (b.costPerTask ?? Infinity)
  )
)
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="font-semibold text-xl">Vilken modell ska du köra — och genom vad?</h2>
        <p class="text-sm text-muted-foreground mt-1">
          Välj benchmark och hur mycket du kör. Kvalitet, kostnad och osäkerhet kommer från samma
          körning - inga siffror blandas mellan källor.
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
        <span class="text-sm text-muted-foreground">Jämför med:</span>
        <USelect
          v-model="referenceSlug"
          :items="[
            { value: null, label: 'Ingen referens - visa fronten' },
            ...candidates.map(m => ({ value: m.slug ?? '', label: formatModelName(m.name) }))
          ]"
          size="sm"
          class="w-72"
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground" title="Ett försök på en uppgift. Det kan misslyckas - bara en del av försöken lyckas.">
          Agentkörningar:
        </span>
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

    <!-- What the units mean -->
    <p class="text-xs text-muted-foreground mb-5 border-l-2 border-border pl-3">
      En <strong class="text-foreground">agentkörning</strong> är ett försök på en uppgift, och den
      kan misslyckas. En <strong class="text-foreground">lyckad uppgift</strong> är en körning som
      löste uppgiften - på Terminal-Bench lyckas omkring 65 % av körningarna. Ett
      <strong class="text-foreground">anrop</strong> är ett API-anrop mot leverantören, och en
      körning består av många anrop. Slidaren räknar körningar, alltså försök.
    </p>

    <!-- The frontier: what is actually worth choosing between -->
    <div v-if="frontierMode && result.frontier.length > 0" class="rounded-lg border border-border bg-muted/40 p-5">
      <p class="text-sm text-muted-foreground">
        Fronten i {{ benchmarkLabel }}: {{ result.frontier.length }} mätta modeller som ingenting
        annat slår på både pris och kvalitet. Resten är antingen dyrare eller sämre.
      </p>
      <ul class="mt-3 space-y-2">
        <li
          v-for="option in frontierOptions"
          :key="option.model.slug"
          class="flex items-start justify-between gap-4 text-sm border-b border-border/50 pb-2"
        >
          <span>
            <span class="font-medium">{{ option.label }}</span>
            <span class="block text-xs text-muted-foreground">
              {{ scoreLine(option) || 'poäng saknas' }}
            </span>
          </span>
          <span class="tabular-nums text-right">
            <span class="font-medium">{{ formatMetricCost(option.costPerTask) }}</span>
            <span class="block text-xs text-muted-foreground">
              {{ metricUnitLabel(option.costIsPerAttempt) }}
              <template v-if="monthlyCost(option) !== null">
                · {{ formatMetricCost(monthlyCost(option)) }}/mån
              </template>
            </span>
          </span>
        </li>
      </ul>
      <p class="text-xs text-muted-foreground mt-3">
        Kostnaden är mätt för en agentkörning i {{ benchmarkLabel }}. Priset per månad räknas på
        {{ tasksPerDay }} körningar per dag.
      </p>
    </div>

    <!-- The direct answer -->
    <div
      v-else-if="result.best && result.threshold !== null"
      class="rounded-lg border border-green-500/30 bg-green-500/10 p-5"
    >
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
          <template v-if="result.best.includedTasksPerMonth">
            · ≈{{ Math.floor(result.best.includedTasksPerMonth) }} körningar/mån inkluderat
          </template>
          <template v-else-if="result.best.breakEvenTasksPerMonth !== null">
            · lönar sig redan {{ breakEvenText(result.best) }}
          </template>
        </template>
        <template v-else>
          (mätt på {{ benchmarkLabel }})
        </template>
      </p>
      <p class="text-xs text-muted-foreground mt-2">
        <template v-if="result.best.score !== null">
          {{ result.best.score.toFixed(1) }} {{ result.benchmark?.isPassRate ? '% lösning' : 'poäng' }}
          <template v-if="formatConfidenceInterval(result.best.ciLow, result.best.ciHigh)">
            (95 % CI {{ formatConfidenceInterval(result.best.ciLow, result.best.ciHigh) }})
          </template>
          ·
        </template>
        <template v-if="result.best.agent">
          Agent: {{ agentLabel(result.best.agent) }} ·
        </template>
        <template v-if="result.best.passRate !== null">
          Löser {{ result.best.passRate.toFixed(1) }} % av uppgifterna ·
        </template>
        <template v-if="result.best.costPerAttempt !== null && !result.best.costIsPerAttempt">
          {{ formatMetricCost(result.best.costPerAttempt) }} per försök ·
        </template>
        Gränsen kommer från samma mätning som kostnaden.
      </p>
      <p v-if="result.best.costIsLowerBound" class="text-xs text-muted-foreground mt-1">
        ≤ betyder att planens användningsgränser inte publiceras som dollarbelopp. Kostnaden
        gäller så länge gränserna räcker vid din användning.
      </p>
      <p v-if="bestLimits.length > 0" class="text-xs text-muted-foreground mt-1">
        Gränser:
        <template v-for="(limit, index) in bestLimits" :key="limit.period + index">
          <span v-if="index > 0"> · </span>{{ limit.text }}
        </template>
      </p>
    </div>

    <!-- A plan with an unpublished quota can be cheaper, but not provably -->
    <div
      v-if="result.conditionalPlanOptions.length > 0"
      class="rounded-lg border border-border bg-muted/40 p-4 mt-3"
    >
      <p class="text-sm font-medium">Kan bli billigare - men bara om kvoten räcker</p>
      <ul class="mt-2 space-y-2">
        <li
          v-for="option in result.conditionalPlanOptions"
          :key="option.plan?.id"
          class="flex items-start justify-between gap-4 text-sm border-b border-border/50 pb-2"
        >
          <span>
            <span>{{ option.label }}</span>
            <span class="block text-xs text-muted-foreground">
              {{ formatModelName(option.model.name) }}
              <template v-if="option.score !== null">
                · {{ scoreLine(option) }}
              </template>
            </span>
          </span>
          <span class="tabular-nums text-right text-xs text-muted-foreground">
            {{ option.plan?.pricePerMonth.toFixed(0) }}$/mån
            <span class="block">
              API-likvärdigt {{ breakEvenText(option) }}
            </span>
            <span class="block">
              kvot: {{ option.quotaLabel ?? 'ej publicerad' }}
            </span>
          </span>
        </li>
      </ul>
      <p class="text-xs text-muted-foreground mt-2">
        Kvoten saknar publicerat dollarvärde, så antalet körningar den täcker går inte att räkna
        ut. Därför kan planen inte vinna en prisjämförelse - den kan bara vara billigare.
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
        <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Med prenumeration - kvot i dollar
        </h3>
        <ul class="space-y-2">
          <li
            v-for="option in result.planOptions"
            :key="option.plan?.id"
            class="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-2"
          >
            <span>
              {{ option.label }}
              <span class="block text-xs text-muted-foreground">
                {{ formatModelName(option.model.name) }}{{ option.plan && !option.plan.priceVerified ? ' · pris ej verifierat' : '' }}
                <template v-if="option.score !== null"> · {{ scoreLine(option) }}</template>
              </span>
            </span>
            <span class="tabular-nums text-right">
              <span class="font-medium">
                {{ formatMetricCost(option.costPerTask) }}
              </span>
              <span class="block text-xs text-muted-foreground">
                {{ metricUnitLabel(option.costIsPerAttempt) }}
                <template v-if="option.includedTasksPerMonth">
                  · ≈{{ Math.floor(option.includedTasksPerMonth) }} körningar/mån inkluderat
                </template>
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
            class="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-2"
            :class="option.qualityKnown ? '' : 'opacity-75'"
          >
            <span>
              {{ option.label }}
              <span class="block text-xs text-muted-foreground">
                via {{ option.model.provider }}
                <template v-if="option.score !== null"> · {{ scoreLine(option) }}</template>
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
      <p class="text-xs text-muted-foreground mb-2">
        Modellerna i dessa planer är inte mätta i {{ benchmarkLabel }}, så det går inte att säga
        om de når din nivå. Därför visas bara planpriset och kvoten - inte ett pris per körning.
        Ett sådant pris går inte att jämföra mellan planer, eftersom en körning i den ena planen
        kan förbruka helt annan kvot än i den andra.
      </p>
      <ul class="space-y-2">
        <li
          v-for="option in result.unmeasuredPlanOptions"
          :key="option.plan?.id"
          class="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-2 opacity-75"
        >
          <span>
            {{ option.label }}
            <span class="block text-xs text-muted-foreground">
              {{ formatModelName(option.model.name) }} · kodnivå ej mätt i det här benchmarket
            </span>
          </span>
          <span class="tabular-nums text-right text-xs text-muted-foreground">
            {{ option.plan?.pricePerMonth.toFixed(0) }}$/mån
            <span class="block">
              kvot: {{ option.quotaLabel ?? 'ej publicerad' }}
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
      En plan med kvot i dollar räknas med inkluderad kvot och listpris för överkostnad. En plan
      med mjuka gränser har ingen publicerad dollarkvot och kan därför aldrig vinna en
      prisjämförelse - den redovisas bara som ett möjligt billigare alternativ.
      </p>
    <p
      v-if="frontierMode && result.frontier.length === 0"
      class="text-sm text-muted-foreground"
    >
      Välj en referensmodell, eller stå på fronten, för att se rekommendationen.
    </p>
  </UCard>
</template>
