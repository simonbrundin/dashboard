<script setup lang="ts">
import type { ModelData } from '~/data/models'
import { SUBSCRIPTION_PLANS } from '~/data/subscriptions'
import { formatModelName } from '~/utils/modelFormatters'
import {
  formatBasketPrice,
  measuredCacheShare,
  planBasketPrice,
  tokenBasket
} from '~/utils/unitEconomics'

const props = defineProps<{
  models: ModelData[]
}>()

interface PriceRow {
  key: string
  kind: 'api' | 'plan'
  label: string
  modelLabel: string
  provider: string
  /** Effective price of one million input plus one million output tokens. */
  price: number | null
  /** The same basket with the input served from the cache. */
  cachedPrice: number | null
  /** The list price of the same basket, for the plan rows. */
  listPrice: number | null
  /** Share of the input that was read from the cache on a measured run. */
  measuredCacheShare: number | null
  /** Why the price is missing, when it is. */
  reason: string | null
  /** True when the price is a lower bound. */
  isLowerBound: boolean
}

/**
 * The models that are relevant for coding agents: they have a measured
 * benchmark score. The full catalog has 700+ models, most of them small
 * open-weight ones that no coding agent runs on.
 */
const codingModels = computed(() =>
  props.models.filter(model =>
    model.aaCodingAgentIndex != null
    || model.terminalBench41Score != null
    || model.terminalBenchScore != null
    || model.deepSweScore != null
  )
)

const apiRows = computed<PriceRow[]>(() =>
  codingModels.value
    .filter(model => tokenBasket(model) !== null)
    .map(model => {
      const basket = tokenBasket(model)!
      const share = measuredCacheShare(model)
      return {
        key: `api-${model.slug ?? model.id}`,
        kind: 'api' as const,
        label: formatModelName(model.name),
        modelLabel: formatModelName(model.name),
        provider: model.provider,
        price: basket.listPrice,
        cachedPrice: basket.cachedPrice,
        listPrice: basket.listPrice,
        measuredCacheShare: share === null ? null : share * 100,
        reason: null,
        isLowerBound: false
      }
    })
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
)

const planRows = computed<PriceRow[]>(() =>
  SUBSCRIPTION_PLANS.map(plan => {
    const planModels = plan.modelSlugs
      .map(slug => props.models.find(model => model.slug === slug))
      .filter((model): model is ModelData => model !== undefined)

    const priced = planModels
      .filter(model => tokenBasket(model) !== null)
      .sort((a, b) => (b.aaCodingAgentIndex ?? -1) - (a.aaCodingAgentIndex ?? -1))[0]

    if (!priced) {
      return {
        key: `plan-${plan.id}`,
        kind: 'plan' as const,
        label: `${plan.vendor} ${plan.name}`,
        modelLabel: planModels[0] ? formatModelName(planModels[0].name) : '—',
        provider: plan.vendor,
        price: null,
        cachedPrice: null,
        listPrice: null,
        measuredCacheShare: null,
        reason: 'planens modell saknar listpris',
        isLowerBound: false
      }
    }

    const effective = planBasketPrice(plan, priced)
    const share = measuredCacheShare(priced)

    return {
      key: `plan-${plan.id}`,
      kind: 'plan' as const,
      label: `${plan.vendor} ${plan.name}`,
      modelLabel: formatModelName(priced.name),
      provider: plan.vendor,
      price: effective.effectivePrice,
      cachedPrice: null,
      listPrice: tokenBasket(priced)!.listPrice,
      measuredCacheShare: share === null ? null : share * 100,
      reason: effective.reason,
      isLowerBound: effective.isLowerBound
    }
  })
)

const rows = computed<PriceRow[]>(() =>
  [...apiRows.value, ...planRows.value].sort((a, b) => {
    if (a.price === null && b.price === null) return a.label.localeCompare(b.label)
    if (a.price === null) return 1
    if (b.price === null) return -1
    return a.price - b.price
  })
)

/** The cheapest plan and the cheapest API model, for the summary line. */
const cheapestPlan = computed(() => planRows.value.find(row => row.price !== null) ?? null)
const cheapestApi = computed(() => apiRows.value[0] ?? null)

/** The plan that saves the most against the list price of its own model. */
const bestSaving = computed(() => {
  const rows = planRows.value.filter(
    row => row.price !== null && row.listPrice !== null && row.listPrice > 0
  )
  return rows.sort((a, b) => (a.price! / a.listPrice!) - (b.price! / b.listPrice!))[0] ?? null
})
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h3 class="font-semibold text-lg">Pris per miljon token</h3>
        <p class="text-sm text-muted-foreground mt-1">
          Samma mått för API och prenumeration: en miljon inputtokens plus en miljon
          outputtokens. Inga gömda mixes — bara listpriset.
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          Listan visar modeller som är uppmätta i ett kodbenchmark plus alla prenumerationer.
        </p>
      </div>
    </template>

    <p v-if="bestSaving" class="text-sm mb-4">
      <span class="font-medium">Störst sparande:</span>
      {{ bestSaving.label }} kostar {{ formatBasketPrice(bestSaving.price) }} per miljon token mot
      {{ formatBasketPrice(bestSaving.listPrice) }} via API för samma modell
      ({{ bestSaving.modelLabel }}).
    </p>
    <p v-else-if="cheapestPlan && cheapestApi" class="text-sm mb-4">
      <span class="font-medium">Billigast per miljon token:</span>
      {{ cheapestPlan.label }} ({{ formatBasketPrice(cheapestPlan.price) }}) jämfört med
      {{ cheapestApi.label }} via API ({{ formatBasketPrice(cheapestApi.price) }}).
    </p>

    <div class="overflow-x-auto max-h-[600px] overflow-y-auto">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-default">
          <tr class="text-left text-xs text-muted-foreground border-b border-border">
            <th class="py-2 pr-3 font-medium">Alternativ</th>
            <th class="py-2 pr-3 font-medium">Modell</th>
            <th class="py-2 pr-3 font-medium text-right">$ / 1M token</th>
            <th class="py-2 pr-3 font-medium text-right">Listpris via API</th>
            <th class="py-2 pr-3 font-medium text-right">$ / 1M token, med cache</th>
            <th class="py-2 pr-3 font-medium text-right">Mätt cacheandel</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.key"
            class="border-b border-border/50"
          >
            <td class="py-2 pr-3">
              {{ row.label }}
              <span class="block text-xs text-muted-foreground">
                {{ row.kind === 'plan' ? 'prenumeration' : 'API' }}
              </span>
            </td>
            <td class="py-2 pr-3 text-xs text-muted-foreground">{{ row.modelLabel }}</td>
            <td class="py-2 pr-3 text-right tabular-nums">
              <template v-if="row.price !== null">{{ formatBasketPrice(row.price) }}</template>
              <template v-else><span class="text-muted-foreground">—</span></template>
              <span v-if="row.reason" class="block text-xs text-muted-foreground">{{ row.reason }}</span>
            </td>
            <td class="py-2 pr-3 text-right tabular-nums">
              <template v-if="row.listPrice !== null">{{ formatBasketPrice(row.listPrice) }}</template>
              <template v-else><span class="text-muted-foreground">—</span></template>
            </td>
            <td class="py-2 pr-3 text-right tabular-nums">
              <template v-if="row.cachedPrice !== null">{{ formatBasketPrice(row.cachedPrice) }}</template>
              <template v-else><span class="text-muted-foreground">—</span></template>
            </td>
            <td class="py-2 pr-3 text-right tabular-nums">
              <template v-if="row.measuredCacheShare !== null">
                {{ row.measuredCacheShare.toFixed(0) }} %
              </template>
              <template v-else><span class="text-muted-foreground">—</span></template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-muted-foreground mt-4">
      Cache-kolumnen antar att 90 % av inputen läses från promptcachen och resten skrivs till den
      — andelen kommer från de uppmätta DeepSWE-körningarna och gäller alla modeller lika.
      Prenumerationens effektiva pris räknas bara ut när kvoten är publicerad i dollar
      (Copilot credits); planer med mjuka gränser eller anropskvoter saknar den och visas som —.
    </p>
  </UCard>
</template>
