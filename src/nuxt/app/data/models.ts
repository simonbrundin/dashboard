export interface ModelData {
  id: string
  slug?: string
  name: string
  provider: string
  providerLogo: string
  intelligenceIndex: number
  costPerTask: number
  inputPricePerM: number
  outputPricePerM: number
  category: 'frontier' | 'high' | 'mid' | 'budget'
  strengths: string[]
  contextWindow: string
  openWeights: boolean
  notes?: string
  speed?: number       // tokens per second
  latency?: number      // time to first token in seconds
}

// Data baserad på Artificial Analysis Intelligence Index och kostnadsjämförelser
// Uppdaterad December 2025 - Källa: artificialanalysis.ai
export const modelsData: ModelData[] = [
  // Frontier Models - Högsta intelligens
  {
    id: 'claude-fable-5.1-max',
    name: 'Claude Fable 5.1 (max with fallback)',
    provider: 'Anthropic',
    providerLogo: 'anthropic',
    intelligenceIndex: 53,
    costPerTask: 2.15,
    inputPricePerM: 15,
    outputPricePerM: 75,
    category: 'frontier',
    strengths: ['Reasoning', 'Code', 'Analysis', 'Long context'],
    contextWindow: '200K',
    openWeights: false,
    notes: 'Top intelligence score among evaluated models'
  },
  {
    id: 'claude-fable-5.1-xhigh',
    name: 'Claude Fable 5.1 (xhigh with fallback)',
    provider: 'Anthropic',
    providerLogo: 'anthropic',
    intelligenceIndex: 52,
    costPerTask: 1.85,
    inputPricePerM: 15,
    outputPricePerM: 75,
    category: 'frontier',
    strengths: ['Reasoning', 'Code', 'Analysis'],
    contextWindow: '200K',
    openWeights: false
  },
  {
    id: 'gpt-6-astra-max',
    name: 'GPT-6 Astra (max)',
    provider: 'OpenAI',
    providerLogo: 'openai',
    intelligenceIndex: 51,
    costPerTask: 1.95,
    inputPricePerM: 12,
    outputPricePerM: 60,
    category: 'frontier',
    strengths: ['General', 'Reasoning', 'Code'],
    contextWindow: '256K',
    openWeights: false
  },
  {
    id: 'gpt-6-astra-xhigh',
    name: 'GPT-6 Astra (xhigh)',
    provider: 'OpenAI',
    providerLogo: 'openai',
    intelligenceIndex: 50,
    costPerTask: 1.65,
    inputPricePerM: 12,
    outputPricePerM: 60,
    category: 'frontier',
    strengths: ['General', 'Reasoning', 'Code'],
    contextWindow: '256K',
    openWeights: false
  },
  {
    id: 'gemini-3-ultra',
    name: 'Gemini 3 Ultra',
    provider: 'Google',
    providerLogo: 'google',
    intelligenceIndex: 48,
    costPerTask: 1.45,
    inputPricePerM: 10.5,
    outputPricePerM: 52.5,
    category: 'frontier',
    strengths: ['Multimodal', 'Long context', 'Speed'],
    contextWindow: '1M',
    openWeights: false
  },

  // High-tier models - Bra balans
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    providerLogo: 'anthropic',
    intelligenceIndex: 57,
    costPerTask: 0.85,
    inputPricePerM: 3,
    outputPricePerM: 15,
    category: 'high',
    strengths: ['Coding', 'Agentic', 'Analysis'],
    contextWindow: '200K',
    openWeights: false
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    providerLogo: 'google',
    intelligenceIndex: 60,
    costPerTask: 1.25,
    inputPricePerM: 5,
    outputPricePerM: 25,
    category: 'high',
    strengths: ['Multimodal', 'Long context', 'Code'],
    contextWindow: '1M',
    openWeights: false
  },
  {
    id: 'gpt-4.5-thinking',
    name: 'GPT-5 Thinking',
    provider: 'OpenAI',
    providerLogo: 'openai',
    intelligenceIndex: 67,
    costPerTask: 2.50,
    inputPricePerM: 15,
    outputPricePerM: 75,
    category: 'high',
    strengths: ['Deep reasoning', 'Code', 'Math'],
    contextWindow: '128K',
    openWeights: false,
    notes: 'Highest intelligence but premium cost'
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    providerLogo: 'deepseek',
    intelligenceIndex: 45,
    costPerTask: 0.15,
    inputPricePerM: 0.5,
    outputPricePerM: 1.1,
    category: 'high',
    strengths: ['Math', 'Coding', 'Cost efficiency'],
    contextWindow: '128K',
    openWeights: true
  },

  // Mid-tier - Bästa värde
  {
    id: 'qwen3-coder-480b',
    name: 'Qwen3 Coder (480B)',
    provider: 'Alibaba',
    providerLogo: 'qwen',
    intelligenceIndex: 42,
    costPerTask: 0.08,
    inputPricePerM: 0.3,
    outputPricePerM: 1.2,
    category: 'mid',
    strengths: ['Code generation', 'Cost efficiency'],
    contextWindow: '128K',
    openWeights: true,
    notes: 'Excellent value for coding tasks'
  },
  {
    id: 'glm-4.5',
    name: 'GLM-4.5',
    provider: 'Zhipu AI',
    providerLogo: 'zhipu',
    intelligenceIndex: 49,
    costPerTask: 0.25,
    inputPricePerM: 0.8,
    outputPricePerM: 1.6,
    category: 'mid',
    strengths: ['General', 'Chinese', 'Cost efficiency'],
    contextWindow: '1M',
    openWeights: true
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    providerLogo: 'deepseek',
    intelligenceIndex: 47,
    costPerTask: 0.18,
    inputPricePerM: 0.55,
    outputPricePerM: 2.19,
    category: 'mid',
    strengths: ['Reasoning', 'Math', 'Coding'],
    contextWindow: '128K',
    openWeights: true
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    providerLogo: 'openai',
    intelligenceIndex: 43,
    costPerTask: 0.45,
    inputPricePerM: 2.5,
    outputPricePerM: 10,
    category: 'mid',
    strengths: ['General', 'Multimodal'],
    contextWindow: '128K',
    openWeights: false
  },
  {
    id: 'claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    providerLogo: 'anthropic',
    intelligenceIndex: 44,
    costPerTask: 0.38,
    inputPricePerM: 3,
    outputPricePerM: 15,
    category: 'mid',
    strengths: ['Code', 'Analysis', 'Extended thinking'],
    contextWindow: '200K',
    openWeights: false
  },

  // Budget - Högsta värde per dollar
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    provider: 'Google',
    providerLogo: 'google',
    intelligenceIndex: 32,
    costPerTask: 0.02,
    inputPricePerM: 0.075,
    outputPricePerM: 0.3,
    category: 'budget',
    strengths: ['Speed', 'Cost efficiency', 'High volume'],
    contextWindow: '1M',
    openWeights: false,
    notes: 'Fastest response time at lowest cost'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'Google',
    providerLogo: 'google',
    intelligenceIndex: 30,
    costPerTask: 0.015,
    inputPricePerM: 0.0375,
    outputPricePerM: 0.15,
    category: 'budget',
    strengths: ['Speed', 'Cost efficiency'],
    contextWindow: '1M',
    openWeights: false,
    notes: 'Best cost per task'
  },
  {
    id: 'north-mini-code',
    name: 'North Mini Code',
    provider: 'Cohere',
    providerLogo: 'cohere',
    intelligenceIndex: 28,
    costPerTask: 0.01,
    inputPricePerM: 0.02,
    outputPricePerM: 0.08,
    category: 'budget',
    strengths: ['Code', 'Speed', 'Low latency'],
    contextWindow: '32K',
    openWeights: false,
    notes: 'Lowest latency among budget options'
  },
  {
    id: 'gemma-3-27b',
    name: 'Gemma 3 27B',
    provider: 'Google',
    providerLogo: 'google',
    intelligenceIndex: 35,
    costPerTask: 0.03,
    inputPricePerM: 0.1,
    outputPricePerM: 0.4,
    category: 'budget',
    strengths: ['Open weights', 'Cost efficiency'],
    contextWindow: '128K',
    openWeights: true
  },
  {
    id: 'devstral-2',
    name: 'Devstral 2',
    provider: 'Mistral',
    providerLogo: 'mistral',
    intelligenceIndex: 38,
    costPerTask: 0,
    inputPricePerM: 0,
    outputPricePerM: 0,
    category: 'budget',
    strengths: ['Code', 'Open weights', 'Free'],
    contextWindow: '128K',
    openWeights: true,
    notes: 'Open weights - no API cost'
  },
  {
    id: 'granite-4.2-3b',
    name: 'Granite 4.2 3B',
    provider: 'IBM',
    providerLogo: 'ibm',
    intelligenceIndex: 25,
    costPerTask: 0.008,
    inputPricePerM: 0.025,
    outputPricePerM: 0.1,
    category: 'budget',
    strengths: ['Speed', 'Low latency', 'Enterprise'],
    contextWindow: '128K',
    openWeights: true
  },
  {
    id: 'qwen-2.5-coder-32b',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'Alibaba',
    providerLogo: 'qwen',
    intelligenceIndex: 36,
    costPerTask: 0.05,
    inputPricePerM: 0.2,
    outputPricePerM: 0.8,
    category: 'budget',
    strengths: ['Code', 'Open weights', 'Self-host'],
    contextWindow: '128K',
    openWeights: true
  },
  {
    id: 'llama-4-scout',
    name: 'Llama 4 Scout',
    provider: 'Meta',
    providerLogo: 'meta',
    intelligenceIndex: 40,
    costPerTask: 0.12,
    inputPricePerM: 0.5,
    outputPricePerM: 2,
    category: 'budget',
    strengths: ['Open weights', 'General'],
    contextWindow: '10M',
    openWeights: true
  },
  {
    id: 'mercury-2',
    name: 'Mercury 2',
    provider: 'Inception Labs',
    providerLogo: 'inception',
    intelligenceIndex: 35,
    costPerTask: 0.04,
    inputPricePerM: 0.15,
    outputPricePerM: 0.6,
    category: 'budget',
    strengths: ['Speed (610 t/s)', 'Cost efficiency'],
    contextWindow: '128K',
    openWeights: false,
    notes: 'Second fastest model overall'
  },
  {
    id: 'celeris-1',
    name: 'Celeris-1',
    provider: 'Celeris',
    providerLogo: 'celeris',
    intelligenceIndex: 22,
    costPerTask: 0.008,
    inputPricePerM: 0.03,
    outputPricePerM: 0.12,
    category: 'budget',
    strengths: ['Speed (1463 t/s)', 'Lowest cost'],
    contextWindow: '128K',
    openWeights: false,
    notes: 'Fastest model at lowest cost'
  }
]

// Beräkna value ratio (intelligence per dollar)
export const modelsWithValue = modelsData.map((model) => ({
  ...model,
  valueRatio: model.costPerTask > 0 ? model.intelligenceIndex / model.costPerTask : Infinity
}))

// Sortera efter bästa värde (högst ratio)
export const bestValueModels = modelsWithValue
  .filter((m) => m.costPerTask > 0)
  .sort((a, b) => b.valueRatio - a.valueRatio)

// Sortera efter Intelligence Index (för de som prioriterar kvalitet)
export const topIntelligenceModels = [...modelsData].filter((m) => m.intelligenceIndex >= 40).sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)

// Sortera efter lägsta kostnad
export const lowestCostModels = [...modelsData].filter((m) => m.costPerTask > 0).sort((a, b) => a.costPerTask - b.costPerTask)

// Pareto-optimala modeller (bästa i sin kategori)
export const paretoOptimalModels = modelsData.filter((model) => {
  const cheaperOrBetter = modelsData.filter((other) => {
    return (
      other.costPerTask <= model.costPerTask
      && other.intelligenceIndex >= model.intelligenceIndex
      && (other.costPerTask < model.costPerTask || other.intelligenceIndex > model.intelligenceIndex)
    )
  })
  return cheaperOrBetter.length === 0
}).sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)

export const providerLogos: Record<string, string> = {
  anthropic: 'i-logos-anthropic',
  openai: 'i-logos-openai',
  google: 'i-logos-google',
  deepseek: 'i-simple-icons-deepseek',
  qwen: 'i-simple-icons-alibaba',
  zhipu: 'i-simple-icons-zhipuai',
  cohere: 'i-logos-cohere',
  meta: 'i-logos-meta',
  mistral: 'i-logos-mistral',
  ibm: 'i-logos-ibm',
  inception: 'i-simple-icons-inception-labs',
  celeris: 'i-simple-icons-celeris'
}
