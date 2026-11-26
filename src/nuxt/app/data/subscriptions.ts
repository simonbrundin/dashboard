/**
 * Kod-relevanta prenumerationsplaner (fast månadskostnad) jämförda mot
 * pay-per-task API-priser.
 *
 * Kvot-modellen per plan:
 * - credits-usd: planen inkluderar en hårt avgränsad kvot med publikt
 *   $-värde (t.ex. Copilot AI credits, 1 credit = $0.01). Overage betalas
 *   enligt listpris.
 * - quota-units: kvoten räknas i anrop per tidsfönster eller relativ enhet
 *   (MiniMax Token Plan, M Plan). Den saknar dollarvärde, så antalet
 *   agentuppgifter som ryms går inte att räkna ut.
 * - soft-limits: gränser publiceras inte som $-värde (5-timmarsfönster,
 *   "5x Pro-usage" osv). Jämförelsen förutsätter då att gränserna räcker vid
 *   användarens nivå, och markeras som antagande i UI:t.
 */
export interface PlanQuota {
  kind: 'credits-usd' | 'quota-units' | 'soft-limits'
  /**
   * Included quota value in USD per month, when the vendor publishes a dollar
   * value (GitHub Copilot AI credits). Undefined means the quota is not
   * dollar-denominated - requests per window or relative units - and then the
   * number of covered agent tasks cannot be calculated.
   */
  amountUsdPerMonth?: number
  /**
   * Published request limit per window, when the vendor counts usage in
   * requests instead of dollars (MiniMax Token Plan).
   */
  requestsPerWindow?: number
  /** Length of the window the request limit applies to, in hours. */
  windowHours?: number
  /**
   * A published limit that is not expressible as dollars or requests, e.g. a
   * relative quota ("3x Go") or a message range per 5-hour window.
   */
  publishedRange?: string
  /** Human explanation: windows, relative quotas, assumptions. */
  note: string
}

export interface SubscriptionPlan {
  id: string
  vendor: string
  name: string
  /** USD per month, billed monthly unless noted in the description. */
  pricePerMonth: number
  /** USD per month when billed annually, when the vendor publishes one. */
  annualPricePerMonth: number | null
  /** Code-relevant models the plan gives access to (slugs in the models table). */
  modelSlugs: string[]
  notes: string
  priceVerifiedDate: string
  priceSourceUrl: string
  priceVerified: boolean
  /**
   * API credits included with the plan, usable against API spend. Anthropic
   * publishes these for Max ($100) and Ultra ($200); they do not cover the
   * in-app agent usage, only API calls.
   */
  apiCreditsUsdPerMonth?: number
  quota?: PlanQuota
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'claude-pro',
    vendor: 'Anthropic',
    name: 'Claude Pro',
    pricePerMonth: 20,
    annualPricePerMonth: 17,
    modelSlugs: ['claude-sonnet-5-5'],
    notes: 'Fler användningar än Free, förnyad var 5:e timme. Årspris $200 fakturerat på en gång.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://www.anthropic.com/pricing',
    priceVerified: true,
    quota: {
      kind: 'soft-limits',
      note: 'Gränser publiceras inte som $-värde: användning förnyas var 5:e timme; intensiv agentanvändning kan maxas.'
    }
  },
  {
    id: 'claude-max',
    vendor: 'Anthropic',
    name: 'Claude Max',
    pricePerMonth: 100,
    annualPricePerMonth: null,
    modelSlugs: ['claude-fable-5-2-high', 'claude-opus-5-5'],
    notes: '5x Pro-användning, Fable ingår upp till viss grad, plus $100/mån i API-credits.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://claude.com/pricing',
    priceVerified: true,
    apiCreditsUsdPerMonth: 100,
    quota: {
      kind: 'soft-limits',
      publishedRange: '5× Pro-usage',
      note: '5× Pro-användning per 5h/vecka; $-värde på "Pro-usage" publiceras inte.'
    }
  },
  {
    id: 'claude-ultra',
    vendor: 'Anthropic',
    name: 'Claude Ultra',
    pricePerMonth: 200,
    annualPricePerMonth: null,
    modelSlugs: ['claude-fable-5-2-high', 'claude-opus-5-5'],
    notes: '10x Pro-användning, ingen 5-timmarsgräns, plus $200/mån i API-credits.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://claude.com/pricing',
    priceVerified: true,
    apiCreditsUsdPerMonth: 200,
    quota: {
      kind: 'soft-limits',
      publishedRange: '10× Pro-usage/vecka',
      note: '10× Pro-användning utan 5-timmarsgräns (verifierade konton).'
    }
  },
  {
    id: 'chatgpt-plus',
    vendor: 'OpenAI',
    name: 'ChatGPT Plus',
    pricePerMonth: 20,
    annualPricePerMonth: null,
    modelSlugs: ['gpt-6-2-astra'],
    notes: 'Utökad åtkomst till ChatGPT och Codex-agenten. Credits kan köpas till vid behov.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://chatgpt.com/codex/pricing/',
    priceVerified: true,
    quota: {
      kind: 'soft-limits',
      publishedRange: 'GPT-6.2 Astra 6-50 meddelanden/5h',
      note: 'Codex publicerar meddelandefönster per 5h (t.ex. GPT-6.2 Astra 6-50), inte $-värde. Lokala meddelanden och molnchatt delar samma kvot.'
    }
  },
  {
    id: 'chatgpt-pro',
    vendor: 'OpenAI',
    name: 'ChatGPT Pro',
    pricePerMonth: 100,
    annualPricePerMonth: null,
    modelSlugs: ['gpt-6-2-astra', 'gpt-6-astra'],
    notes: 'Ingen 5-timmarsgräns; extra credits kan köpas.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://chatgpt.com/codex/pricing/',
    priceVerified: true,
    quota: {
      kind: 'soft-limits',
      publishedRange: 'inga 5-timmarsgränser',
      note: 'Pro har ingen 5-timmarsgräns; inget inkluderat $-belopp publiceras.'
    }
  },
  {
    id: 'copilot-pro',
    vendor: 'GitHub',
    name: 'Copilot Pro',
    pricePerMonth: 10,
    annualPricePerMonth: null,
    modelSlugs: ['claude-sonnet-5-5', 'gpt-6-2-astra'],
    notes: 'Agenter inklusive Claude Code och Codex.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing',
    priceVerified: true,
    quota: {
      kind: 'credits-usd',
      amountUsdPerMonth: 15,
      note: '1 500 AI credits/mån (1 000 base + 500 flex); 1 credit = $0.01; tokens dras enligt Copilot:s per-token-priser (≈ listpriser).'
    }
  },
  {
    id: 'copilot-pro-plus',
    vendor: 'GitHub',
    name: 'Copilot Pro+',
    pricePerMonth: 39,
    annualPricePerMonth: null,
    modelSlugs: ['claude-sonnet-5-5', 'gpt-6-2-astra', 'claude-opus-5-5'],
    notes: 'Fler premiummodeller (inklusive Opus).',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing',
    priceVerified: true,
    quota: {
      kind: 'credits-usd',
      amountUsdPerMonth: 70,
      note: '7 000 AI credits/mån (3 900 base + 3 100 flex).'
    }
  },
  {
    id: 'copilot-max',
    vendor: 'GitHub',
    name: 'Copilot Max',
    pricePerMonth: 100,
    annualPricePerMonth: null,
    modelSlugs: ['claude-sonnet-5-5', 'gpt-6-2-astra', 'claude-opus-5-5'],
    notes: 'Högre credits-allotterning.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing',
    priceVerified: true,
    quota: {
      kind: 'credits-usd',
      amountUsdPerMonth: 200,
      note: '20 000 AI credits/mån (10 000 base + 10 000 flex).'
    }
  },
  {
    id: 'minimax-token-starter',
    vendor: 'MiniMax',
    name: 'Token Starter',
    pricePerMonth: 10,
    annualPricePerMonth: null,
    modelSlugs: ['minimax-m2-7'],
    // Priset ar anvandaruppgivet 2026-11-26: MiniMax:s sajter blockar botar
    // sa det gamla Token Plan-starterpriset kunde inte verifieras online.
    notes: 'Kvot-baserad (Token Plan). Priset ar anvandaruppgivet.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://platform.minimax.io/docs/m-plan/token-plan-notice',
    priceVerified: false,
    quota: {
      kind: 'quota-units',
      requestsPerWindow: 1500,
      windowHours: 5,
      note: 'Kvoten räknas i anrop per 5-timmarsfönster (1 500 M2.7-anrop), inte i dollar. Över kvoten används credits och sedan listpris. Ett anrop är inte en agentuppgift - en uppgift består av många anrop - så antalet uppgifter kan inte räknas ut.'
    }
  },
  {
    id: 'minimax-m-plan-go',
    vendor: 'MiniMax',
    name: 'M Plan Go',
    pricePerMonth: 22,
    annualPricePerMonth: 220 / 12,
    modelSlugs: ['minimax-m3-1-flash'],
    notes: 'M Plan lägstnivå; textmodell M3.1 Flash. Kvot relativ: 1×.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://platform.minimax.io/docs/m-plan/monthly-offer',
    priceVerified: true,
    quota: {
      kind: 'quota-units',
      publishedRange: '1× Go',
      note: 'Kvoten räknas i relativa enheter (Go = 1×), inte i dollar. Text/speech har 5-timmars- och veckofönster; bild/video bara veckofönstret. Över kvoten används credits och sedan listpris.'
    }
  },
  {
    id: 'minimax-m-plan-explore',
    vendor: 'MiniMax',
    name: 'M Plan Explore',
    pricePerMonth: 55,
    annualPricePerMonth: 550 / 12,
    modelSlugs: ['minimax-m3-1-flash'],
    notes: 'Kvot relativ: 3× Go. Inkluderar även H3-video.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://platform.minimax.io/docs/m-plan/monthly-offer',
    priceVerified: true,
    quota: {
      kind: 'quota-units',
      publishedRange: '3× Go',
      note: 'Kvoten räknas i relativa enheter (3× Go-nivån), inte i dollar. Över kvoten används credits och sedan listpris.'
    }
  },
  {
    id: 'minimax-m-plan-build',
    vendor: 'MiniMax',
    name: 'M Plan Build',
    pricePerMonth: 132,
    annualPricePerMonth: 1320 / 12,
    modelSlugs: ['minimax-m3-1-flash'],
    notes: 'Kvot relativ: 7,5× Go. Inkluderar även H3-video.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://platform.minimax.io/docs/m-plan/monthly-offer',
    priceVerified: true,
    quota: {
      kind: 'quota-units',
      publishedRange: '7,5× Go',
      note: 'Kvoten räknas i relativa enheter (7,5× Go-nivån), inte i dollar. Över kvoten används credits och sedan listpris.'
    }
  },
  {
    id: 'google-ai-pro',
    vendor: 'Google',
    name: 'AI Pro',
    pricePerMonth: 19.99,
    annualPricePerMonth: null,
    modelSlugs: ['gemini-4-neon'],
    notes: 'Gemini-appen med 4x gränserna mot gratisnivån.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://gemini.google.com/subscriptions/',
    priceVerified: true,
    quota: {
      kind: 'soft-limits',
      publishedRange: '4× Pro-nivån',
      note: 'Gränserna publiceras som "4x Pro-nivån", inte som $-värde.'
    }
  },
  {
    id: 'google-ai-ultra-5x',
    vendor: 'Google',
    name: 'AI Ultra 5x',
    pricePerMonth: 99.99,
    annualPricePerMonth: null,
    modelSlugs: ['gemini-4-carbon', 'gemini-4-neon'],
    notes: '5x gränserna mot AI Pro.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://gemini.google.com/subscriptions/',
    priceVerified: true,
    quota: {
      kind: 'soft-limits',
      publishedRange: '5× AI Pro-kvoten',
      note: '5× AI Pro-kvoten; inget inkluderat $-belopp publiceras.'
    }
  },
  {
    id: 'google-ai-ultra-20x',
    vendor: 'Google',
    name: 'AI Ultra 20x',
    pricePerMonth: 199.99,
    annualPricePerMonth: null,
    modelSlugs: ['gemini-4-carbon', 'gemini-4-neon'],
    notes: '20x gränserna mot AI Pro.',
    priceVerifiedDate: '2026-11-26',
    priceSourceUrl: 'https://gemini.google.com/subscriptions/',
    priceVerified: true,
    quota: {
      kind: 'soft-limits',
      publishedRange: '20× AI Pro-kvoten',
      note: '20× AI Pro-kvoten; inget inkluderat $-belopp publiceras.'
    }
  }
]
