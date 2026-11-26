<script setup lang="ts">
import type { ModelData } from '~/data/models'
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '~/data/subscriptions'
import { AGENT_BENCHMARKS, resolveCostBasis, getAgentBenchmark } from '~/utils/agentBenchmarks'
import {
  formatConfidenceInterval,
  formatMetricCost,
  formatModelName,
  metricUnitLabel
} from '~/utils/modelFormatters'
import { planIncludesModel } from '~/utils/usageLimits'
import { useAgentBenchmarkId } from '~/composables/useAgentBenchmark'

const props = defineProps<{
  models: ModelData[]
  /** How many agent runs the user does per day. */
  tasksPerDay: number
}>()

const benchmarkId = useAgentBenchmarkId()

/** The benchmarks that actually have measurements in the current data. */
const availableBenchmarks = computed(() =>
  AGENT_BENCHMARKS.filter(benchmark =>
    props.models.some(model => benchmark.score(model) != null)
  )
)

watch(availableBenchmarks, (list) => {
  if (!list.some(benchmark => benchmark.id === benchmarkId.value)) {
    benchmarkId.value = list[0]?.id ?? null
  }
}, { immediate: true })

const benchmark = computed(() =>
  benchmarkId.value ? getAgentBenchmark(benchmarkId.value) : null
)

interface DecisionRow {
  key: string
  name: string
  provider: string
  score: number | null
  ciLow: number | null
  ciHigh: number | null
  agent: string | null
  /** Measured cost per solved task, or per attempt when the benchmark has no
   * pass rate. */
  costPerTask: number
  costIsPerAttempt: boolean
  /** The cost of a single attempt, when the benchmark publishes it. */
  costPerAttempt: number | null
  /** Pass rate in percent, when the benchmark has one. */
  passRate: number | null
  /**
   * The cost at the user's usage level, per month.
   *
   * The usage level is counted in attempts - that is what you pay for. A
   * solved task costs more because only part of the attempts succeed.
   */
  monthlyCost: number
  /** How many tasks are solved per month at this usage level. */
  solvedTasksPerMonth: number | null
  /** The cheapest subscription that includes the model. */
  plan: SubscriptionPlan | null
  /** What the plan's quota looks like, when it is published. */
  quotaText: string | null
  /** True when the quota has a published dollar value. */
  quotaIsExact: boolean
}

const rows = computed<DecisionRow[]>(() => {
  const active = benchmark.value
  if (!active) return []

  const result: DecisionRow[] = []
  for (const model of props.models) {
    const score = active.score(model)
    if (score === null) continue

    const basis = resolveCostBasis(model, active)
    const metric = basis?.costPerSolvedTask ?? basis?.costPerAttempt ?? null
    if (metric === null) continue

    const confidence = active.confidenceFor?.(model) ?? { low: null, high: null }
    const plans = SUBSCRIPTION_PLANS
      .filter(plan => planIncludesModel(plan, model.slug))
      .sort((a, b) => a.pricePerMonth - b.pricePerMonth)

    const plan = plans[0] ?? null
    const quota = plan?.quota ?? null
    const quotaIsExact = quota?.kind === 'credits-usd'

    result.push({
      key: `${model.provider}-${model.slug ?? model.id}`,
      name: formatModelName(model.name),
      provider: model.provider,
      score,
      ciLow: confidence.low,
      ciHigh: confidence.high,
      agent: active.harnessFor?.(model) ?? active.harness,
      costPerTask: metric,
      costIsPerAttempt: basis?.isPerAttempt ?? true,
      costPerAttempt: basis?.costPerAttempt ?? null,
      passRate: basis?.passRate ?? null,
      monthlyCost: (basis?.costPerAttempt ?? metric) * props.tasksPerDay * 30,
      solvedTasksPerMonth: basis?.passRate != null
        ? Math.round((basis.passRate / 100) * props.tasksPerDay * 30)
        : null,
      plan,
      quotaText: quota?.publishedRange
        ?? (quota?.requestsPerWindow != null
          ? `${quota.requestsPerWindow.toLocaleString('sv-SE')} anrop/${quota.windowHours ?? '?'} h`
          : null),
      quotaIsExact
    })
  }

  return result.sort((a, b) => a.costPerTask - b.costPerTask)
})

/**
 * The models that nothing else beats on both price and quality.
 *
 * A model is dominated when another measured model is at least as good and
 * no more expensive.
 */
const frontierKeys = computed(() => {
  const keys = new Set<string>()
  for (const row of rows.value) {
    const dominated = rows.value.some(other =>
      other !== row
      && other.score !== null
      && row.score !== null
      && other.costPerTask <= row.costPerTask
      && other.score >= row.score
      && (other.costPerTask < row.costPerTask || other.score > row.score)
    )
    if (!dominated) keys.add(row.key)
  }
  return keys
})

/** Show only the models that are actually worth choosing between. */
const onlyFrontier = ref(true)

const shownRows = computed(() =>
  onlyFrontier.value
    ? rows.value.filter(row => frontierKeys.value.has(row.key))
    : rows.value
)

/** The unit of the benchmark's cost metric. */
const isPassRate = computed(() => benchmark.value?.isPassRate ?? false)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="font-semibold text-xl">Beslutstabell</h2>
          <p class="text-sm text-muted-foreground mt-1">
            Varje rad: hur bra modellen är, vad en agentkörning kostar och vad det blir för dig
            per månad. Allt kommer från samma benchmark och samma körning.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <USelect
            v-model="benchmarkId"
            :items="availableBenchmarks.map(b => ({ value: b.id, label: b.label }))"
            size="sm"
            class="w-52"
          />
          <UButton
            size="sm"
            variant="outline"
            :color="onlyFrontier ? 'primary' : 'neutral'"
            @click="onlyFrontier = !onlyFrontier"
          >
            {{ onlyFrontier ? 'Visar fronten' : 'Visar alla mätta' }}
          </UButton>
        </div>
      </div>
    </template>

    <p class="text-sm text-muted-foreground mb-3">
      <template v-if="onlyFrontier">
        {{ shownRows.length }} av {{ rows.length }} mätta modeller - resten är dyrare eller sämre
        än någon på listan.
      </template>
      <template v-else>
        {{ shownRows.length }} mätta modeller.
      </template>
      Månadskostnaden räknas på {{ tasksPerDay }} körningar per dag.
    </p>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-muted-foreground border-b border-border">
            <th class="py-2 pr-3 font-medium">Modell</th>
            <th class="py-2 pr-3 font-medium text-right">Poäng</th>
            <th class="py-2 pr-3 font-medium text-right">95 % CI</th>
            <th class="py-2 pr-3 font-medium">Agent</th>
            <th class="py-2 pr-3 font-medium text-right">$ per lyckad uppgift</th>
            <th class="py-2 pr-3 font-medium text-right" :title="`Kostnad för ${tasksPerDay} agentkörningar per dag via API`">
              $ per månad
            </th>
            <th class="py-2 pr-3 font-medium">Prenumeration</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in shownRows"
            :key="row.key"
            class="border-b border-border/50 hover:bg-muted/50 transition-colors"
          >
            <td class="py-2 pr-3">
              <span class="font-medium">{{ row.name }}</span>
              <p class="text-[11px] text-muted-foreground">{{ row.provider }}</p>
            </td>
            <td class="py-2 pr-3 text-right tabular-nums">
              {{ row.score !== null ? row.score.toFixed(1) : '—' }}
              <span v-if="isPassRate" class="text-[11px] text-muted-foreground">%</span>
            </td>
            <td class="py-2 pr-3 text-right tabular-nums text-xs text-muted-foreground">
              {{ formatConfidenceInterval(row.ciLow, row.ciHigh) ?? '—' }}
            </td>
            <td class="py-2 pr-3 text-xs text-muted-foreground">{{ row.agent ?? '—' }}</td>
            <td class="py-2 pr-3 text-right tabular-nums">
              <span class="font-medium">{{ formatMetricCost(row.costPerTask) }}</span>
              <span class="block text-[11px] text-muted-foreground">
                {{ metricUnitLabel(row.costIsPerAttempt) }}
              </span>
            </td>
            <td class="py-2 pr-3 text-right tabular-nums">
              {{ formatMetricCost(row.monthlyCost) }}
              <span class="block text-[11px] text-muted-foreground">
                via API
                <template v-if="row.solvedTasksPerMonth !== null">
                  · {{ row.solvedTasksPerMonth }} lösta/mån
                </template>
              </span>
            </td>
            <td class="py-2 pr-3 text-xs">
              <template v-if="row.plan">
                <span>{{ row.plan.vendor }} {{ row.plan.name }}</span>
                <span class="block text-[11px] text-muted-foreground">
                  {{ row.plan.pricePerMonth.toFixed(0) }}$/mån ·
                  <template v-if="row.quotaIsExact">
                    kvot i dollar
                  </template>
                  <template v-else-if="row.quotaText">
                    kvot: {{ row.quotaText }}
                  </template>
                  <template v-else>
                    kvot ej publicerad
                  </template>
                </span>
              </template>
              <span v-else class="text-muted-foreground">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-muted-foreground mt-3">
      Poängen kommer från {{ benchmark?.label }}. Kostnaden är mätt för en agentkörning i samma
      benchmark. Prenumerationskolumnen visar den billigaste planen som ingår modellen - om kvoten
      saknar publicerat dollarvärde går det inte att räkna ut hur många körningar den täcker.
    </p>
  </UCard>
</template>
