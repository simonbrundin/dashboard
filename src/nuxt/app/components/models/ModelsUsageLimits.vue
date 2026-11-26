<script setup lang="ts">
import type { ModelData } from '~/data/models'
import { formatModelName } from '~/utils/modelFormatters'
import {
  getModelUsageLimits,
  usageLimitRows,
  type ModelUsageLimits
} from '~/utils/usageLimits'

const props = defineProps<{
  models: ModelData[]
}>()

interface LimitRow {
  key: string
  name: string
  provider: string
  limits: ModelUsageLimits
  /** The published minute limit, if any. */
  minute: string | null
  /** The published day limit, if any. */
  day: string | null
  /** The published monthly spend cap, if any. */
  month: string | null
  /** The subscriptions the model is included in. */
  plans: string
  /** True when the provider publishes no static numbers. */
  notPublished: boolean
  /** Why the provider publishes no numbers. */
  notPublishedReason: string | null
  sourceUrl: string | null
  verifiedDate: string | null
}

/** Only models with a published limit or a subscription are worth listing. */
const rows = computed<LimitRow[]>(() =>
  props.models
    .map(model => {
      const limits = getModelUsageLimits(model)
      const limitRows = usageLimitRows(limits)
      const byPeriod = (period: string) =>
        limitRows.find(row => row.period === period)?.text ?? null

      return {
        key: `${model.provider}-${model.slug ?? model.id}`,
        name: formatModelName(model.name),
        provider: model.provider,
        limits,
        minute: byPeriod('tim'),
        day: byPeriod('dag'),
        month: byPeriod('månad'),
        plans: limits.plans
          .map(quota => `${quota.plan.vendor} ${quota.plan.name}`)
          .join(', '),
        notPublished: limits.notPublished,
        notPublishedReason: limits.notPublishedReason,
        sourceUrl: limits.api?.sourceUrl ?? null,
        verifiedDate: limits.api?.verifiedDate ?? null
      }
    })
    .filter(row =>
      row.minute != null
      || row.day != null
      || row.month != null
      || row.plans !== ''
      || row.notPublished
    )
    .sort((a, b) => {
      const rank = (row: LimitRow) =>
        (row.minute != null ? 4 : 0)
        + (row.day != null ? 2 : 0)
        + (row.month != null ? 1 : 0)
      return rank(b) - rank(a) || a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name)
    })
)

const withDayLimit = computed(() => rows.value.filter(row => row.day != null).length)
const withMonthLimit = computed(() => rows.value.filter(row => row.month != null).length)
const withPlanQuota = computed(() => rows.value.filter(row => row.plans !== '').length)
</script>

<template>
  <div>
    <h3 class="font-semibold text-lg mb-1">Användningsgränser per modell</h3>
    <p class="text-sm text-muted-foreground mb-3">
      Leverantörens egna gränser för API-anrop, gränsen i en prenumeration och en eventuell
      månadsgräns för spend. En gräns som inte publiceras i siffror står som
      <span class="font-medium">ej publicerade</span> - den är aldrig noll.
      En prenumeration täcker modellen i alla reasoning-effort-nivåer, så alla varianter av
      samma modell visas med samma prenumeration.
    </p>
    <p class="text-sm mb-4">
      <span class="font-medium">Sammanfattning:</span>
      {{ withDayLimit }} modeller har en publicerad dagsgräns,
      {{ withMonthLimit }} har en månadsgräns för spend och
      {{ withPlanQuota }} ingår i en prenumeration med kvot.
    </p>

    <div class="overflow-x-auto max-h-[600px] overflow-y-auto">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-default">
          <tr class="text-left text-xs text-muted-foreground border-b border-border">
            <th class="py-2 pr-3 font-medium">Modell</th>
            <th class="py-2 pr-3 font-medium">Leverantör</th>
            <th class="py-2 pr-3 font-medium">Timgräns</th>
            <th class="py-2 pr-3 font-medium">Dagsgräns</th>
            <th class="py-2 pr-3 font-medium">Månadsgräns</th>
            <th class="py-2 pr-3 font-medium">Prenumeration</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.key"
            class="border-b border-border/50 hover:bg-muted/50 transition-colors"
          >
            <td class="py-2 pr-3">
              <span class="font-medium">{{ row.name }}</span>
              <p v-if="row.notPublished" class="text-[11px] text-muted-foreground">
                {{ row.notPublishedReason }}
              </p>
            </td>
            <td class="py-2 pr-3 text-muted-foreground">{{ row.provider }}</td>
            <td class="py-2 pr-3 tabular-nums">
              <span v-if="row.minute">{{ row.minute }}</span>
              <span v-else-if="row.notPublished" class="text-muted-foreground">ej publicerade</span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="py-2 pr-3 tabular-nums">
              <span v-if="row.day">{{ row.day }}</span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="py-2 pr-3 tabular-nums">
              <span v-if="row.month">{{ row.month }}</span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="py-2 pr-3 text-muted-foreground">{{ row.plans || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-muted-foreground mt-3">
      Gränserna gäller din API-nivå. Anthropic och OpenAI sätter gränserna per organisation och
      låter dem växa med spend; MiniMax, Kimi, xAI och Alibaba sätter dem per konto och tier.
      En prenumerationskvot gäller agentanvändningen i appen och är skild från API-gränserna.
      Källa och kontrolleringsdatum för varje rad finns i kodbasen.
    </p>
  </div>
</template>
