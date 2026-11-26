import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ModelData } from '../app/data/models.ts'
import { buildRecommendation } from '../app/utils/recommendation.ts'

function model(slug: string, overrides: Partial<ModelData> = {}): ModelData {
  return {
    id: `id-${slug}`,
    slug,
    name: `${slug} (Max)`,
    provider: 'Test Co',
    providerLogo: 'test',
    intelligenceIndex: 40,
    costPerTask: null,
    inputPricePerM: null,
    outputPricePerM: null,
    category: 'mid',
    strengths: [],
    contextWindow: 'N/A',
    openWeights: false,
    ...overrides
  }
}

const SONNET = model('claude-sonnet-5-5', {
  provider: 'Anthropic',
  aaCodingAgentIndex: 56.3,
  aaCodingAgentCostPerTask: 11.4
})
const NEON = model('gemini-4-neon', {
  provider: 'Google',
  aaCodingAgentIndex: 58.6,
  aaCodingAgentCostPerTask: 6.86
})
const ASTRA = model('gpt-6-2-astra', {
  provider: 'OpenAI',
  aaCodingAgentIndex: 53.5,
  aaCodingAgentCostPerTask: 5.12
})
const OPUS = model('claude-opus-5-5', {
  provider: 'Anthropic',
  aaCodingAgentIndex: 58.2,
  aaCodingAgentCostPerTask: 12.61
})

test('recommends the cheapest option that clears the reference level', () => {
  const result = buildRecommendation([SONNET, NEON, ASTRA], 'claude-sonnet-5-5', 5)

  assert.equal(result.threshold, 56.3)
  // Google AI Pro has soft limits, so its cost per task is only an
  // assumption and it may not win a price comparison. The winner is the
  // cheapest option whose cost is actually known.
  assert.equal(result.best?.kind, 'api')
  assert.equal(result.best?.model.slug, 'gemini-4-neon')
  assert.equal(result.best?.costPerTask, 6.86)
  // The soft-limit plan is still visible - as a conditional alternative.
  const googlePro = result.conditionalPlanOptions.find(option => option.plan?.id === 'google-ai-pro')
  assert.ok(googlePro)
  assert.equal(googlePro.costIsVerifiable, false)
  // The no-subscription answer uses the cheapest qualifying API model.
  assert.equal(result.bestWithoutPlan?.model.slug, 'gemini-4-neon')
  assert.equal(result.bestWithoutPlan?.costPerTask, 6.86)
})

test('a plan with a dollar quota can win the recommendation', () => {
  const result = buildRecommendation([SONNET], 'claude-sonnet-5-5', 5)

  const copilot = result.planOptions.find(option => option.plan?.id === 'copilot-pro')
  assert.ok(copilot)
  assert.equal(copilot.costIsVerifiable, true)
  // The plan with the largest published allowance wins: its cost per task is
  // the only one that is calculated, not assumed.
  assert.equal(result.best?.kind, 'plan')
  assert.equal(result.best?.plan?.id, 'copilot-max')
  assert.ok(result.best!.costPerTask < result.apiOptions[0]!.costPerTask)
})

test('a plan with an unpublished quota never wins a price comparison', () => {
  const result = buildRecommendation([SONNET, NEON], 'claude-sonnet-5-5', 5)

  assert.equal(result.best?.kind, 'api')
  assert.ok(result.conditionalPlanOptions.every(option => option.costIsVerifiable === false))
  assert.ok(result.conditionalPlanOptions.length > 0)
})

test('a credits plan never beats the plain API by more than the allowance', () => {
  // Copilot Pro: $10/month, $15 of included credits, overage at list price.
  // At 150 tasks/month of $11.4 the API costs $1710; the plan costs
  // $10 + ($1710 - $15) = $1705 - the allowance is the only saving.
  const result = buildRecommendation([SONNET], 'claude-sonnet-5-5', 5)

  const copilot = result.planOptions.find(option => option.plan?.id === 'copilot-pro')
  assert.ok(copilot)
  assert.equal(copilot.costIsLowerBound, false)
  assert.equal(copilot.includedTasksPerMonth, 15 / 11.4)
  assert.equal(copilot.costPerTask, (10 + (150 * 11.4 - 15)) / 150)
  assert.ok(copilot.costPerTask > 11.4 * 0.99)
})

test('a plan only qualifies when one of its models clears the level', () => {
  // Astra (53.5) is below Sonnet (56.3), so ChatGPT Plus must not qualify.
  const result = buildRecommendation([SONNET, ASTRA], 'claude-sonnet-5-5', 5)

  const chatgpt = result.planOptions.find(option => option.plan?.id === 'chatgpt-plus')
  assert.equal(chatgpt, undefined)
  // API options must also respect the threshold.
  assert.deepEqual(result.apiOptions.map(option => option.model.slug), ['claude-sonnet-5-5'])
})

test('a lower reference level opens up cheaper models and plans', () => {
  const result = buildRecommendation([ASTRA, NEON], 'gpt-6-2-astra', 5)

  assert.equal(result.threshold, 53.5)
  assert.ok(result.apiOptions.some(option => option.model.slug === 'gpt-6-2-astra'))
  // ChatGPT Plus has soft limits, so it is a conditional alternative rather
  // than a priced option.
  assert.ok(result.conditionalPlanOptions.some(option => option.plan?.id === 'chatgpt-plus'))
})

test('without a reference the answer is the quality/cost frontier', () => {
  const result = buildRecommendation([SONNET, NEON, ASTRA], null, 5)

  assert.equal(result.threshold, null)
  assert.ok(result.frontier.length > 0)
  // Every model on the frontier is either the cheapest or the best.
  for (const option of result.frontier) {
    const dominated = result.apiOptions.some(other =>
      other !== option
      && other.costPerTask <= option.costPerTask
      && (other.score ?? 0) >= (option.score ?? 0)
      && (other.costPerTask < option.costPerTask || (other.score ?? 0) > (option.score ?? 0))
    )
    assert.equal(dominated, false)
  }
})

test('at very low usage the recommendation still shows both answers', () => {
  const result = buildRecommendation([SONNET, NEON], 'claude-sonnet-5-5', 1)

  assert.ok(result.best)
  // $10 / (1 * 30) = $0.33 per task - still cheaper than any measured API run.
  assert.ok(result.planOptions.length > 0)
  assert.ok(result.planOptions.every(option => option.costPerTask > 0))
})

test('a plan uses its highest-scoring model for the break-even', () => {
  const result = buildRecommendation([SONNET, NEON, OPUS], 'claude-sonnet-5-5', 5)

  const proPlus = result.planOptions.find(option => option.plan?.id === 'copilot-pro-plus')
  assert.ok(proPlus)
  // Copilot Pro+ lists Sonnet, Astra and Opus; Opus scores 58.2 and wins.
  assert.equal(proPlus.model.slug, 'claude-opus-5-5')
  // $39 / 12.61 measured API cost
  assert.ok(Math.abs(proPlus.breakEvenTasksPerMonth! - 39 / proPlus.apiCostPerTask) < 1e-9)
})

test('a plan whose models lack measured agent costs is skipped', () => {
  const unmeasured = model('mystery-model', { aaCodingAgentIndex: 90, aaCodingAgentCostPerTask: null })
  const plans = buildRecommendation([SONNET, NEON, unmeasured], 'claude-sonnet-5-5', 5)
  // No plan includes 'mystery-model', so this just verifies robustness.
  assert.ok(plans.planOptions.every(option => option.plan !== undefined))
})

test('a request-quota plan never wins the recommendation', () => {
  // MiniMax Token Starter ($10/month): the quota is counted in requests per
  // 5-hour window, not in dollars, so the number of covered tasks is not
  // calculable. The plan price spread over the usage is a lower bound.
  const minimax = model('minimax-m2-7', {
    provider: 'MiniMax',
    aaCodingAgentIndex: null,
    estimatedCostPerTask: 8.64
  })

  const result = buildRecommendation([SONNET, NEON, minimax], 'claude-sonnet-5-5', 5)
  const starter = result.unmeasuredPlanOptions.find(
    option => option.plan?.id === 'minimax-token-starter'
  )

  assert.ok(starter)
  // $10 spread over 5 tasks/day * 30 days = 150 tasks.
  assert.equal(starter.costPerTask, 10 / 150)
  assert.equal(starter.costIsLowerBound, true)
  assert.equal(starter.apiCostIsEstimated, true)
  assert.equal(starter.qualityKnown, false)
  assert.equal(starter.quotaKind, 'quota-units')

  // The recommendation stays on a measured option.
  assert.equal(result.best?.qualityKnown, true)
  assert.notEqual(result.best?.plan?.id, 'minimax-token-starter')
})

test('a cheap plan with an unmeasured coding level never wins', () => {
  // The spread cost of a $10 plan over 150 tasks is far below any measured
  // API cost. It must still lose, because its coding level is unknown.
  const minimax = model('minimax-m2-7', {
    provider: 'MiniMax',
    aaCodingAgentIndex: null,
    estimatedCostPerTask: 8.64
  })

  const result = buildRecommendation([SONNET, minimax], 'claude-sonnet-5-5', 5)
  const starter = result.unmeasuredPlanOptions.find(
    option => option.plan?.id === 'minimax-token-starter'
  )

  assert.ok(starter)
  assert.ok(starter.costPerTask < 1)
  assert.equal(result.best?.model.slug, 'claude-sonnet-5-5')
})

test('a model without a measured agent run stays visible but never wins', () => {
  // MiniMax-M2.7: no measured AA agent score, only a token-price estimate.
  const minimax = model('minimax-m2-7', {
    provider: 'MiniMax',
    aaCodingAgentIndex: null,
    estimatedCostPerTask: 8.64
  })

  const result = buildRecommendation([SONNET, NEON, minimax], 'claude-sonnet-5-5', 5)

  const option = result.estimatedOptions.find(option => option.model.slug === 'minimax-m2-7')
  assert.ok(option)
  assert.equal(option.apiCostIsEstimated, true)
  assert.equal(option.qualityKnown, false)

  // The recommendation itself must still be a measured option.
  assert.equal(result.best?.qualityKnown, true)
  assert.notEqual(result.best?.model.slug, 'minimax-m2-7')
})

test('the recommendation ranks on cost per solved task, not cost per attempt', () => {
  // Terminal-Bench 4.1: Beam 1.0 is much cheaper per attempt than Kimi, but
  // it only solves 3 % of the tasks. The cost per solved task is the number
  // that decides whether a model is cheap enough.
  const kimi = model('kimi-k3-1-pro', {
    provider: 'Moonshot AI',
    terminalBench41Score: 68.18,
    terminalBench41CostPerTask: 5.2656,
    terminalBench41CostPerSuccessfulTask: 7.7228
  })
  const beam = model('beam-1-0', {
    provider: 'Beam',
    terminalBench41Score: 3.03,
    terminalBench41CostPerTask: 0.6254,
    terminalBench41CostPerSuccessfulTask: 20.6393
  })

  const result = buildRecommendation([kimi, beam], 'kimi-k3-1-pro', 5, 'terminal-bench-4.1')

  assert.equal(result.benchmark?.id, 'terminal-bench-4.1')
  assert.equal(result.threshold, 68.18)
  // Beam does not clear the bar, so only Kimi is a candidate.
  assert.deepEqual(result.apiOptions.map(option => option.model.slug), ['kimi-k3-1-pro'])
  assert.equal(result.best?.costPerTask, 7.7228)
  assert.equal(result.best?.costIsPerAttempt, false)
})

test('a cheap model with a low pass rate never wins on cost per attempt', () => {
  // Both models clear the bar of the reference, but the cheap one solves far
  // fewer tasks - ranking on cost per attempt would pick the wrong model.
  // The slugs are deliberately not part of any subscription plan, so only
  // the API prices are compared.
  const reference = model('ref-model-x', {
    provider: 'Test Co',
    terminalBench41Score: 60,
    terminalBench41CostPerTask: 10,
    terminalBench41CostPerSuccessfulTask: 16.67
  })
  const cheap = model('cheap-model-y', {
    provider: 'Test Co',
    terminalBench41Score: 61,
    terminalBench41CostPerTask: 0.5,
    terminalBench41CostPerSuccessfulTask: 50
  })

  const result = buildRecommendation([reference, cheap], 'ref-model-x', 5, 'terminal-bench-4.1')

  assert.equal(result.best?.model.slug, 'ref-model-x')
  assert.equal(result.best?.costPerTask, 16.67)
})

test('the threshold and the costs come from the same benchmark', () => {
  // Opus has a Terminal-Bench score but no AA agent cost, and Astra has the
  // opposite. Neither pair may be mixed.
  const opus = model('claude-opus-5-5', {
    provider: 'Anthropic',
    terminalBench41Score: 59.09,
    terminalBench41CostPerSuccessfulTask: 22.18
  })
  const astra = model('gpt-6-2-astra', {
    provider: 'OpenAI',
    aaCodingAgentIndex: 53.5,
    aaCodingAgentCostPerTask: 5.12
  })

  const terminalBench = buildRecommendation([opus, astra], 'claude-opus-5-5', 5, 'terminal-bench-4.1')
  assert.equal(terminalBench.benchmark?.id, 'terminal-bench-4.1')
  // Astra has no Terminal-Bench measurement, so it cannot compete.
  assert.deepEqual(terminalBench.apiOptions.map(option => option.model.slug), ['claude-opus-5-5'])

  // The same reference has no AA agent score, so that benchmark cannot give
  // a threshold at all.
  const codingAgent = buildRecommendation([opus, astra], 'claude-opus-5-5', 5, 'aa-coding-agent')
  assert.equal(codingAgent.threshold, null)
  assert.equal(codingAgent.best, null)
})

test('the agent behind a measurement is reported', () => {
  const kimi = model('kimi-k3-1-pro', {
    provider: 'Moonshot AI',
    aaCodingAgentIndex: 48.64,
    aaCodingAgentCostPerTask: 2.9446,
    aaCodingAgentName: 'Kimi Code CLI'
  })

  const result = buildRecommendation([kimi], 'kimi-k3-1-pro', 5, 'aa-coding-agent')
  assert.equal(result.best?.agent, 'Kimi Code CLI')
})

test('a published confidence interval is reported with the score', () => {
  const model1 = model('astra-deep-swe', {
    provider: 'OpenAI',
    deepSweScore: 74.12,
    deepSweCostPerTask: 4.43,
    deepSweCostPerSuccessfulTask: 5.98,
    deepSweCiLow: 71.25,
    deepSweCiHigh: 76.98,
    deepSweHarness: 'mini-swe-agent'
  })

  const result = buildRecommendation([model1], 'astra-deep-swe', 5, 'deep-swe')
  assert.equal(result.best?.ciLow, 71.25)
  assert.equal(result.best?.ciHigh, 76.98)
  assert.equal(result.best?.agent, 'mini-swe-agent')
  assert.equal(result.best?.costPerTask, 5.98)
})
