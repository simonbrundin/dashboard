/**
 * Publicerade användningsgränser per leverantör och modell.
 *
 * Tre saker skiljs åt, eftersom de betyder olika saker:
 * - API-gränser (minut/dag): leverantörens gräns för dina API-anrop.
 * - Månadsgräns: hur mycket du får spenda per kalendermånad.
 * - Plangrenser: kvoten i en prenumeration (t.ex. 5-timmarsfönster).
 *
 * En gräns som leverantören inte publicerar i siffror markeras som
 * "ej publicerad" - den får aldrig göras om till noll eller "obegränsad".
 */

/** Ett värde som leverantören uttryckligen kallar obegränsat. */
export type LimitValue = number | 'unlimited'

export interface LimitTier {
  /** Leverantörens namn på nivån, t.ex. "Start", "Tier 2", "V3". */
  tier: string
  /** Vad som krävs för att nå nivån, t.ex. "$5 in total credit purchases". */
  requirement?: string
  /** Anrop per minut. */
  rpm?: number
  /** Anrop per sekund. */
  rps?: number
  /** Tokens per minut. */
  tpm?: number
  /** Tokens per dag. */
  tpd?: LimitValue
  /** Anrop per dag. */
  rpd?: LimitValue
  /** Samtidiga anrop. */
  concurrency?: number
  /** Maximal spend per kalendermånad i USD. */
  monthlyUsdCap?: number
}

export interface UsageLimitProfile {
  provider: string
  /**
   * Slug-prefix som profilen gäller. En tom lista betyder att profilen
   * gäller alla modeller från leverantören.
   */
  slugPrefixes: string[]
  /** Sant när leverantören inte publicerar siffror per modell. */
  notPublished?: boolean
  /** Varför gränserna inte kan visas i siffror. */
  notPublishedReason?: string
  /** De publicerade gränserna, per nivå. */
  tiers: LimitTier[]
  sourceUrl: string
  /** När källan senast kontrollerades. */
  verifiedDate: string
  note?: string
}

export const USAGE_LIMIT_PROFILES: UsageLimitProfile[] = [
  {
    provider: 'Anthropic',
    slugPrefixes: ['claude-fable-5-2', 'claude-fable-5-1', 'claude-fable-5'],
    tiers: [
      { tier: 'Start', requirement: 'Ny organisation', rpm: 4000, tpm: 500000, monthlyUsdCap: 500 },
      { tier: 'Build', requirement: '$1 000 i månadsspend', rpm: 10000, tpm: 1500000, monthlyUsdCap: 1000 },
      { tier: 'Scale', requirement: '$5 000 i månadsspend', rpm: 13000, tpm: 4000000, monthlyUsdCap: 200000 }
    ],
    sourceUrl: 'https://platform.claude.com/docs/en/api/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Månadsgränsen är en spend-cap per kalendermånad. TPM är inputtokens per minut; outputtokens har en egen gräns.'
  },
  {
    provider: 'Anthropic',
    slugPrefixes: ['claude-opus-5-5', 'claude-opus-5'],
    tiers: [
      { tier: 'Start', requirement: 'Ny organisation', rpm: 4000, tpm: 2000000, monthlyUsdCap: 500 },
      { tier: 'Build', requirement: '$1 000 i månadsspend', rpm: 10000, tpm: 5000000, monthlyUsdCap: 1000 },
      { tier: 'Scale', requirement: '$5 000 i månadsspend', rpm: 13000, tpm: 10000000, monthlyUsdCap: 200000 }
    ],
    sourceUrl: 'https://platform.claude.com/docs/en/api/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Månadsgränsen är en spend-cap per kalendermånad.'
  },
  {
    provider: 'Anthropic',
    slugPrefixes: ['claude-sonnet-5-5', 'claude-sonnet-5'],
    tiers: [
      { tier: 'Start', requirement: 'Ny organisation', rpm: 4000, tpm: 2000000, monthlyUsdCap: 500 },
      { tier: 'Build', requirement: '$1 000 i månadsspend', rpm: 10000, tpm: 5000000, monthlyUsdCap: 1000 },
      { tier: 'Scale', requirement: '$5 000 i månadsspend', rpm: 13000, tpm: 10000000, monthlyUsdCap: 200000 }
    ],
    sourceUrl: 'https://platform.claude.com/docs/en/api/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Månadsgränsen är en spend-cap per kalendermånad.'
  },
  {
    provider: 'Anthropic',
    slugPrefixes: ['claude-haiku-5-5', 'claude-haiku-4-5'],
    tiers: [
      { tier: 'Start', requirement: 'Ny organisation', rpm: 4000, tpm: 2000000, monthlyUsdCap: 500 },
      { tier: 'Build', requirement: '$1 000 i månadsspend', rpm: 10000, tpm: 5000000, monthlyUsdCap: 1000 },
      { tier: 'Scale', requirement: '$5 000 i månadsspend', rpm: 13000, tpm: 10000000, monthlyUsdCap: 200000 }
    ],
    sourceUrl: 'https://platform.claude.com/docs/en/api/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Månadsgränsen är en spend-cap per kalendermånad.'
  },
  {
    provider: 'OpenAI',
    slugPrefixes: ['gpt-6-2-astra', 'gpt-6-astra', 'gpt-6-2-sol', 'gpt-6-1-sol', 'gpt-6-sol', 'gpt-5-6-sol', 'gpt-5-6-terra', 'gpt-6-1-terra', 'gpt-6-2-terra', 'astra-for-law'],
    tiers: [
      { tier: 'Free', requirement: 'Gratisnivå', monthlyUsdCap: 100 },
      { tier: 'Build', requirement: '$5 i köpta credits', rpm: 5000, tpm: 1000000, monthlyUsdCap: 500 },
      { tier: 'Launch', requirement: '$100 i köpta credits', rpm: 10000, tpm: 4000000, monthlyUsdCap: 5000 },
      { tier: 'Grow', requirement: '$500 i köpta credits', rpm: 15000, tpm: 40000000, monthlyUsdCap: 200000 }
    ],
    sourceUrl: 'https://developers.openai.com/api/docs/guides/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Månadsgränsen är OpenAI:s månatliga användningsgräns för organisationen, inte en spend-cap du sätter själv.'
  },
  {
    provider: 'OpenAI',
    slugPrefixes: ['gpt-6-luna', 'gpt-5-6-luna'],
    tiers: [
      { tier: 'Free', requirement: 'Gratisnivå', monthlyUsdCap: 100 },
      { tier: 'Build', requirement: '$5 i köpta credits', rpm: 5000, tpm: 2000000, monthlyUsdCap: 500 },
      { tier: 'Launch', requirement: '$100 i köpta credits', rpm: 10000, tpm: 10000000, monthlyUsdCap: 5000 },
      { tier: 'Grow', requirement: '$500 i köpta credits', rpm: 30000, tpm: 180000000, monthlyUsdCap: 200000 }
    ],
    sourceUrl: 'https://developers.openai.com/api/docs/guides/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Månadsgränsen är OpenAI:s månatliga användningsgräns för organisationen.'
  },
  {
    provider: 'SpaceXAI',
    slugPrefixes: ['grok-4-7', 'grok-4-6', 'grok-4-5'],
    tiers: [
      { tier: 'Tier 0', requirement: '$0 spenderat', rps: 150, tpm: 50000000 },
      { tier: 'Tier 1', requirement: '$50 spenderat', rps: 172, tpm: 53000000 },
      { tier: 'Tier 2', requirement: '$250 spenderat', rps: 208, tpm: 60000000 },
      { tier: 'Tier 3', requirement: '$1 000 spenderat', rps: 312, tpm: 74000000 },
      { tier: 'Tier 4', requirement: '$5 000 spenderat', rps: 500, tpm: 100000000 }
    ],
    sourceUrl: 'https://docs.x.ai/developers/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'xAI mäter anrop per sekund, inte per minut. Sekundgränsen härleds ur minutsbudgeten.'
  },
  {
    provider: 'SpaceXAI',
    slugPrefixes: ['grok-4-3', 'grok-4-20', 'grok-4-1-fast', 'grok-4-fast'],
    tiers: [
      { tier: 'Tier 0', requirement: '$0 spenderat', rps: 37, tpm: 10000000 },
      { tier: 'Tier 1', requirement: '$50 spenderat', rps: 50, tpm: 15000000 },
      { tier: 'Tier 2', requirement: '$250 spenderat', rps: 75, tpm: 25000000 },
      { tier: 'Tier 3', requirement: '$1 000 spenderat', rps: 125, tpm: 45000000 },
      { tier: 'Tier 4', requirement: '$5 000 spenderat', rps: 208, tpm: 85000000 }
    ],
    sourceUrl: 'https://docs.x.ai/developers/rate-limits',
    verifiedDate: '2026-11-26'
  },
  {
    provider: 'Kimi',
    slugPrefixes: [],
    tiers: [
      {
        tier: 'Tier 0',
        requirement: '$1 påfyllt',
        rpm: 3,
        tpm: 500000,
        tpd: 1500000,
        concurrency: 1
      },
      {
        tier: 'Tier 1',
        requirement: '$10 påfyllt',
        rpm: 100,
        tpm: 2000000,
        tpd: 'unlimited',
        concurrency: 15
      },
      {
        tier: 'Tier 2',
        requirement: '$20 påfyllt',
        rpm: 100,
        tpm: 3000000,
        tpd: 'unlimited',
        concurrency: 40
      },
      {
        tier: 'Tier 3',
        requirement: '$100 påfyllt',
        rpm: 200,
        tpm: 3000000,
        tpd: 'unlimited',
        concurrency: 50
      },
      {
        tier: 'Tier 4',
        requirement: '$1 000 påfyllt',
        rpm: 200,
        tpm: 4000000,
        tpd: 'unlimited',
        concurrency: 60
      },
      {
        tier: 'Tier 5',
        requirement: '$3 000 påfyllt',
        rpm: 300,
        tpm: 5000000,
        tpd: 'unlimited',
        concurrency: 100
      }
    ],
    sourceUrl: 'https://platform.kimi.ai/docs/pricing/limits',
    verifiedDate: '2026-11-26',
    note: 'Kimi delar gränserna mellan alla modeller. Endast Tier 0 har en publicerad dagsgräns (tokens per dag); från Tier 1 är den obegränsad.'
  },
  {
    provider: 'MiniMax',
    slugPrefixes: ['minimax-m3-1-flash', 'minimax-m3'],
    tiers: [{ tier: 'Standard', rpm: 200, tpm: 10000000 }],
    sourceUrl: 'https://platform.minimax.io/docs/guides/rate-limits',
    verifiedDate: '2026-11-26'
  },
  {
    provider: 'MiniMax',
    slugPrefixes: ['minimax-m2-7', 'minimax-m2-5', 'minimax-m2-1', 'minimax-m2'],
    tiers: [{ tier: 'Standard', rpm: 500, tpm: 20000000 }],
    sourceUrl: 'https://platform.minimax.io/docs/guides/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Dessa rader finns inte längre i MiniMaxs egen gränstabell. M2.5 och M2.7 stängde för nya kunder 2026-10-19 och tas ur drift 2026-11-18.'
  },
  {
    provider: 'DeepSeek',
    slugPrefixes: ['deepseek-v4-1-flash', 'deepseek-v4-flash'],
    tiers: [{ tier: 'Standard', concurrency: 2500 }],
    sourceUrl: 'https://api-docs.deepseek.com/quick_start/rate_limit/',
    verifiedDate: '2026-11-26',
    note: 'DeepSeek publicerar bara samtidighetsgränsen, inte anrop eller tokens per minut.'
  },
  {
    provider: 'DeepSeek',
    slugPrefixes: ['deepseek-v4-pro', 'deepseek-r1', 'deepseek-chat', 'deepseek-coder'],
    tiers: [{ tier: 'Standard', concurrency: 500 }],
    sourceUrl: 'https://api-docs.deepseek.com/quick_start/rate_limit/',
    verifiedDate: '2026-11-26',
    note: 'DeepSeek publicerar bara samtidighetsgränsen, inte anrop eller tokens per minut.'
  },
  {
    provider: 'Google',
    slugPrefixes: [],
    notPublished: true,
    notPublishedReason:
      'Google tog bort de statiska gränstabellerna ur den publika dokumentationen 2026 och visar gränserna per projekt i AI Studio. De är inte garanterade.',
    tiers: [],
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Google skiljer på gräns per minut (RPM, TPM) och anrop per dag (RPD). Sökning med Google Search har dessutom en egen gräns på 1 500 anrop per dag.'
  },
  {
    provider: 'Mistral',
    slugPrefixes: [],
    notPublished: true,
    notPublishedReason:
      'Mistral visar gränserna per modell i Admin Panel (API › Limits). Dokumentationen anger att de sätts per organisation och per prenumerationstier, men inte siffrorna.',
    tiers: [],
    sourceUrl: 'https://docs.mistral.ai/admin/billing-usage/usage-limits/',
    verifiedDate: '2026-11-26',
    note: 'Mistral har tre oberoende gränser: anrop per sekund, tokens per minut och tokens per månad. Nivåerna Tier 1-4 kräver ackumulerad fakturering ($20, $100, $500, $2 000).'
  },
  {
    provider: 'Z AI',
    slugPrefixes: [],
    notPublished: true,
    notPublishedReason:
      'Z.ai sätter gränsen som antal samtidiga anrop per modell och visar den i konsolen. GLM Coding Plan-nivåerna sätter olika samtidighet per plan.',
    tiers: [],
    sourceUrl: 'https://docs.bigmodel.cn/cn/api/rate-limit',
    verifiedDate: '2026-11-26',
    note: 'Publicerad samtidighet för GLM-4-Flash: 200/1 000/2 000/3 000 för V0-V3. GLM-4-Plus: 50/100/300/500.'
  },
  {
    provider: 'Alibaba',
    slugPrefixes: ['qwen3-8-max', 'qwen4-max', 'qwen3-8-flash', 'qwen-flash'],
    tiers: [{ tier: 'Singapore', rpm: 600, tpm: 5000000 }],
    notPublished: true,
    notPublishedReason:
      'Dessa modeller använder dynamisk rate limiting: TPM-gränsen justeras efter månadsspenderad nivå och kan därför inte redovisas som en fast siffra.',
    tiers: [],
    sourceUrl: 'https://www.alibabacloud.com/help/en/model-studio/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Publicerad TPM-nivå för Singapore: qwen3.8-max 2 000 000 (Tier 1) / 5 000 000 (Tier 2) / 10 000 000 (Tier 3).'
  },
  {
    provider: 'Alibaba',
    slugPrefixes: ['qwen3-7-flash', 'qwen3-6-flash', 'qwen3-5-flash', 'qwen3-5-plus', 'qwen3-6-plus', 'qwen3-7-plus'],
    tiers: [{ tier: 'Singapore', rpm: 15000, tpm: 5000000 }],
    sourceUrl: 'https://www.alibabacloud.com/help/en/model-studio/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Gränserna gäller Model Studio i Singapore. Modellen kan även köpas via andra leverantörer med andra gränser.'
  },
  {
    provider: 'Alibaba',
    slugPrefixes: ['qwen3-7-max', 'qwen-max', 'qwen-plus'],
    tiers: [{ tier: 'Singapore', rpm: 600, tpm: 1000000 }],
    sourceUrl: 'https://www.alibabacloud.com/help/en/model-studio/rate-limits',
    verifiedDate: '2026-11-26',
    note: 'Gränserna gäller Model Studio i Singapore. Modellen kan även köpas via andra leverantörer med andra gränser.'
  }
]
