<script setup lang="ts">
import type { ModelData } from '~/data/models'
import { compareSubscriptionPlans, type SubscriptionComparisonRow } from '~/utils/subscriptions'
import { formatCost, formatModelName } from '~/utils/modelFormatters'

const props = defineProps<{
  models: ModelData[]
}>()

// Agent tasks run per day - the usage level the plans are compared at.
const tasksPerDay = ref(5)

const comparison = computed(() => compareSubscriptionPlans(props.models, tasksPerDay.value))

/**
 * The winner has to have a verifiable cost. Plans with soft limits only give
 * a lower bound, so they are shown but never presented as the answer.
 */
const winner = computed<SubscriptionComparisonRow | null>(() =>
  comparison.value.rows.find(row =>
    row.cheaperThanApi === true && row.plan.priceVerified && !row.costIsLowerBound)
    ?? comparison.value.rows.find(row =>
      row.cheaperThanApi === true && row.plan.priceVerified)
    ?? comparison.value.rows[0]
    ?? null
)

function formatApiCost(row: SubscriptionComparisonRow): string {
  if (row.apiCostPerTask === null) return '—'
  return formatCost(row.apiCostPerTask)
}

function formatBreakEven(row: SubscriptionComparisonRow): string {
  if (row.breakEvenTasksPerMonth === null) return '—'
  const perMonth = row.breakEvenTasksPerMonth
  if (perMonth < 1) {
    return `redan vid ${perMonth < 0.1 ? '<1' : Math.ceil(perMonth)} uppgift/månad`
  }
  if (perMonth < 10) return `${perMonth.toFixed(1)} uppgifter/månad`
  return `${Math.round(perMonth)} uppgifter/månad (≈${(perMonth / 30).toFixed(1)}/dag)`
}

function formatPlanLabel(row: SubscriptionComparisonRow): string {
  return `${row.plan.vendor} ${row.plan.name}`
}

function formatQuota(row: SubscriptionComparisonRow): string {
  const quota = row.plan.quota
  if (!quota) return 'kvot ej dokumenterad'
  if (quota.requestsPerWindow !== undefined) {
    return `${quota.requestsPerWindow.toLocaleString('sv-SE')} anrop/${quota.windowHours}h`
  }
  if (quota.publishedRange) return quota.publishedRange
  if (quota.kind === 'soft-limits') return 'mjuk gräns · ej omräknad till $'
  if (row.includedTasksPerMonth === null) return 'kvot · kostnad saknas'
  return `≈${Math.floor(row.includedTasksPerMonth)} uppgifter/mån inkluderat`
}

/** API credits included with the plan, if the vendor publishes them. */
function formatApiCredits(row: SubscriptionComparisonRow): string {
  if (!row.apiCreditsUsdPerMonth) return '—'
  if (row.apiCreditCoveredTasks === null) return `$${row.apiCreditsUsdPerMonth}/mån`
  return `$${row.apiCreditsUsdPerMonth}/mån ≈${Math.floor(row.apiCreditCoveredTasks)} uppgifter`
}
</script>

<template>
  <UCard class="mt-6">
    <template #header>
      <div>
        <h3 class="font-semibold text-lg">Lönar sig en prenumeration?</h3>
        <p class="text-sm text-muted-foreground mt-1">
          En prenumeration kostar lika mycket varje månad oavsett hur mycket du använder den.
          Här jämförs den fasta månadspriset med att betala per agentuppgift via API.
        </p>
      </div>
    </template>

    <div class="flex items-center gap-3 mb-4">
      <span class="text-sm text-muted-foreground">Hur många agentuppgifter kör du per dag?</span>
      <USlider
        v-model="tasksPerDay"
        :min="1"
        :max="60"
        :step="1"
        class="w-44"
        :default-value="5"
      />
      <span class="text-sm font-medium tabular-nums">{{ tasksPerDay }} per dag</span>
    </div>

    <div
      v-if="winner"
      class="rounded-lg border border-green-500/30 bg-green-500/10 p-4 mb-4"
    >
      <p class="text-sm">
        <span class="font-semibold text-green-600 dark:text-green-400">Svar:</span>
        Vid {{ tasksPerDay }} agentuppgifter per dag kostar
        <span class="font-semibold">{{ formatPlanLabel(winner) }}</span>
        <span class="font-semibold">
          {{ winner.costIsLowerBound ? '≤ ' : '' }}{{ formatCost(winner.effectiveCostPerTask) }} per uppgift
        </span>
        — mot {{ formatApiCost(winner) }} via API för samma uppgift.
        <template v-if="winner.breakEvenTasksPerMonth !== null">
          Prenumerationen lönar sig {{ formatBreakEven(winner) }}.
        </template>
        <template v-else>
          Kvoten är räknad i credits, så planen kan inte bli billigare än API.
        </template>
      </p>
      <p v-if="winner.costIsLowerBound" class="text-xs text-muted-foreground mt-1">
        ≤ betyder att planens användningsgränser inte publiceras som dollarbelopp - kostnaden
        gäller så länge gränserna räcker vid din användning.
      </p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border text-left text-xs text-muted-foreground">
            <th class="py-2 px-3">Plan</th>
            <th class="py-2 px-3 text-right">Pris per månad</th>
            <th class="py-2 px-3">Modell i planen</th>
            <th class="py-2 px-3" title="Planens publicerade användningsgräns och hur den räknas">
              Användningsgräns
            </th>
            <th class="py-2 px-3" title="API-credits som ingår i planen (Anthropic Max/Ultra)">
              API-credits
            </th>
            <th class="py-2 px-3 text-right" title="AA:s mätta agentkörningskostnad för modellen, utan plan">
              Kostnad via API (per uppgift)
            </th>
            <th
              class="py-2 px-3 text-right"
              title="Hur många agentuppgifter per månad som motsvarar prenumerationens pris i API-kostnad"
            >
              Lönar sig redan vid
            </th>
            <th
              class="py-2 px-3 text-right"
              title="Planens pris utslaget på antalet uppgifter du kör per dag"
            >
              Kostnad per uppgift med planen
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in comparison.rows"
            :key="`${row.plan.id}-${row.model.slug}`"
            class="border-b border-border/50"
          >
            <td class="py-2 px-3">
              <span :title="`${row.plan.notes} (pris verifierat ${row.plan.priceVerifiedDate}, källa: ${row.plan.priceSourceUrl})`">
                {{ formatPlanLabel(row) }}
              </span>
              <span v-if="!row.plan.priceVerified" class="text-amber-500 text-xs" title="Priset ej omverifierat">⚠</span>
            </td>
            <td class="py-2 px-3 text-right tabular-nums">${{ row.plan.pricePerMonth.toFixed(2) }}</td>
            <td class="py-2 px-3">{{ formatModelName(row.model.name) }}</td>
            <td class="py-2 px-3 text-xs" :title="row.plan.quota?.note">
              {{ formatQuota(row) }}
            </td>
            <td class="py-2 px-3 text-xs tabular-nums">
              {{ formatApiCredits(row) }}
            </td>
            <td class="py-2 px-3 text-right tabular-nums">
              {{ formatApiCost(row) }}<span v-if="row.apiCostIsEstimated" title="Uppskattad från tokenpriser - agentkörningen är inte mätt av AA"> ≈</span>
            </td>
            <td class="py-2 px-3 text-right tabular-nums">
              <template v-if="row.plan.quota?.kind === 'soft-limits' || row.plan.quota?.kind === 'quota-units'">
                <span :title="'Gäller bara om planens gränser räcker för hela användningen'">{{ formatBreakEven(row) }}</span>
              </template>
              <template v-else>
                <span :title="row.hasOverage ? 'Över kvoten läggs listpriset till' : 'Användningen ryms i den inkluderade kvoten'">kvot + listpris</span>
              </template>
            </td>
            <td
              class="py-2 px-3 text-right tabular-nums"
              :class="row.cheaperThanApi ? 'text-green-600 dark:text-green-400 font-medium' : ''"
              :title="row.costIsLowerBound ? 'Gäller så länge planens gränser räcker' : (row.hasOverage ? 'Inkluderar listpris för användning över kvoten' : 'All användning ryms i kvoten')"
            >
              <template v-if="row.costPerTaskAtUsage === null">—</template>
              <template v-else>
                <span>{{ row.costIsLowerBound ? '≤ ' : '' }}{{ formatCost(row.costPerTaskAtUsage) }}</span>
                <span v-if="row.costIsLowerBound" class="block text-[10px] font-normal text-muted-foreground">
                  om kvoten räcker
                </span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-muted-foreground mt-4">
      Kostnad per uppgift är AA:s mätta agentkörningskostnad (Coding Agent Index); ≈ betyder att
      agentkörningen inte är mätt och kostnaden är uppskattad från tokenpriser. För creditsplaner
      räknas inkluderade uppgifter som kvotvärde / kostnad per uppgift; över kvoten läggs
      listpriset till. Oanvända Copilot-credits sparas inte mellan månader och förbrukas även av
      chat och kodkompletteringar. API-credits (Anthropic Max/Ultra) gäller bara API-anrop, inte
      agentanvändningen i apparna, och förgår vid månadsskiftet. Mjuka gränser (t.ex.
      5-timmarsfönster) och anropskvoter (MiniMax) kan inte omräknas till antal agentuppgifter -
      de visas därför som ≤ och gäller bara så länge gränserna räcker. Priser är snapshot från
      leverantörernas prissidor, verifierade 2026-11-26 (⚠ = ej omverifierat).
    </p>
  </UCard>
</template>
