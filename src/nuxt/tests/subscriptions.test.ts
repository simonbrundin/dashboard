import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ModelData } from '../app/data/models.ts'
import { SUBSCRIPTION_PLANS } from '../app/data/subscriptions.ts'
import { compareSubscriptionPlans } from '../app/utils/subscriptions.ts'

function model(slug: string, overrides: Partial<ModelData> = {}): ModelData {
  return {
    id: `id-${slug}`,
    slug,
    name: slug,
    provider: 'Test',
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

function findRow(rows: ReturnType<typeof compareSubscriptionPlans>['rows'], planId: string, slug: string) {
  const row = rows.find(r => r.plan.id === planId && r.model.slug === slug)
  assert.ok(row, `row for ${planId}/${slug}`)
  return row
}

test('break-even is the plan price divided by the measured API cost', () => {
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 10 })
  ], 0)

  const row = findRow(rows.rows, 'claude-pro', 'claude-sonnet-5-5')
  assert.equal(row.apiCostPerTask, 10)
  assert.equal(row.apiCostIsEstimated, false)
  // $20/month / $10 per task
  assert.equal(row.breakEvenTasksPerMonth, 2)
  assert.equal(row.effectiveCostPerTask, null)
})

test('a plan with API credits reports what the credits cover', () => {
  // Claude Max includes $100/month of API credits, consumed at list price.
  const rows = compareSubscriptionPlans([
    model('claude-opus-5-5', { aaCodingAgentCostPerTask: 12.61 })
  ], 5)

  const row = findRow(rows.rows, 'claude-max', 'claude-opus-5-5')
  assert.equal(row.apiCreditsUsdPerMonth, 100)
  // $100 of credits / $12.61 per task
  assert.equal(row.apiCreditCoveredTasks, 100 / 12.61)
})

test('a plan without API credits reports none', () => {
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 11.4 })
  ], 5)

  const row = findRow(rows.rows, 'claude-pro', 'claude-sonnet-5-5')
  assert.equal(row.apiCreditsUsdPerMonth, null)
  assert.equal(row.apiCreditCoveredTasks, null)
})

test('a soft-limit plan only gives a lower bound cost per task', () => {
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 10 })
  ], 5)

  const row = findRow(rows.rows, 'claude-pro', 'claude-sonnet-5-5')
  // $20 / 150 tasks - only if the 5-hour limits hold.
  assert.equal(row.costPerTaskAtUsage, 20 / 150)
  assert.equal(row.costIsLowerBound, true)
  // The limit cannot be converted into a dollar amount.
  assert.equal(row.includedTasksPerMonth, null)
  assert.equal(row.hasOverage, false)
})

test('effective cost per task spreads the plan over the usage level', () => {
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 10 })
  ], 5)

  const row = findRow(rows.rows, 'claude-pro', 'claude-sonnet-5-5')
  // $20 / (5 * 30 tasks)
  assert.equal(row.effectiveCostPerTask, 20 / 150)
  // $0.133 < $10 -> the plan is cheaper at this usage
  assert.equal(row.cheaperThanApi, true)
})

test('a plan is more expensive than the API at low usage levels', () => {
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 0.1 })
  ], 1)

  const row = findRow(rows.rows, 'claude-pro', 'claude-sonnet-5-5')
  // $20 / 30 tasks = $0.67 per task > $0.10 API
  assert.equal(row.cheaperThanApi, false)
  assert.ok(row.breakEvenTasksPerMonth! > 30)
})

test('an estimate is only used when the agent cost is not measured', () => {
  const rows = compareSubscriptionPlans([
    model('gemini-4-neon', { estimatedCostPerTask: 2.5 })
  ], 5)

  const row = findRow(rows.rows, 'google-ai-pro', 'gemini-4-neon')
  assert.equal(row.apiCostPerTask, 2.5)
  assert.equal(row.apiCostIsEstimated, true)
  assert.equal(row.breakEvenTasksPerMonth, 19.99 / 2.5)
})

test('plans without any model data are skipped', () => {
  const rows = compareSubscriptionPlans([], 5)
  assert.equal(rows.rows.length, 0)
})

test('every plan carries a verification date and source URL', () => {
  for (const plan of SUBSCRIPTION_PLANS) {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(plan.priceVerifiedDate), plan.id)
    assert.ok(plan.priceSourceUrl.startsWith('https://'), plan.id)
    assert.ok(plan.pricePerMonth > 0, plan.id)
    assert.ok(plan.modelSlugs.length > 0, plan.id)
  }
})

test('rows are sorted by effective cost per task', () => {
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 11.4 }),
    model('gpt-6-2-astra', { aaCodingAgentCostPerTask: 5.12 }),
    model('gemini-4-neon', { aaCodingAgentCostPerTask: 6.86 })
  ], 5)

  const costs = rows.rows.map(r => r.effectiveCostPerTask)
  for (let i = 1; i < costs.length; i++) {
    assert.ok(costs[i]! >= costs[i - 1]!)
  }
})

test('a credits plan converts its included credits to agent tasks', () => {
  // Copilot Pro: $10/month, 1 500 AI credits ($15) included; a task costs $5.
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 5 })
  ], 5)

  const row = findRow(rows.rows, 'copilot-pro', 'claude-sonnet-5-5')
  assert.equal(row.plan.quota?.kind, 'credits-usd')
  assert.equal(row.plan.quota?.amountUsdPerMonth, 15)
  // $15 included / $5 per task
  assert.equal(row.includedTasksPerMonth, 3)
  // The allowance is worth more than the plan price, so the plan beats the
  // API above the break-even.
  assert.equal(row.breakEvenTasksPerMonth, 10 / 5)
  // The cost is exact, not a lower bound.
  assert.equal(row.costIsLowerBound, false)
})

test('a credits plan adds list-price overage beyond the included quota', () => {
  // 150 tasks/month at $5 = $750 of API work; $15 included -> $10 + $735.
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 5 })
  ], 5)

  const row = findRow(rows.rows, 'copilot-pro', 'claude-sonnet-5-5')
  assert.equal(row.hasOverage, true)
  assert.equal(row.totalMonthlyCostAtUsage, 10 + (150 - 3) * 5)
  // $745 / 150 tasks is still below the plain API cost ($750), because the
  // included credit value ($15) exceeds the $10 plan price.
  assert.equal(row.costPerTaskAtUsage, (10 + 147 * 5) / 150)
  assert.equal(row.cheaperThanApi, true)
})

test('a credits plan never costs more than list price once the allowance is used', () => {
  // Copilot Pro includes $15 of credits for $10, so any usage past the
  // allowance stays below the plain API cost - the overage is list price.
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 5 })
  ], 1)

  const row = findRow(rows.rows, 'copilot-pro', 'claude-sonnet-5-5')
  // 30 tasks at $5 = $150, well past the $15 allowance.
  assert.equal(row.totalMonthlyCostAtUsage, 10 + 27 * 5)
  assert.equal(row.costPerTaskAtUsage, (10 + 27 * 5) / 30)
  assert.equal(row.cheaperThanApi, true)
})

test('a credits plan is more expensive than the API below the included allowance', () => {
  // A single $500 task: the $10 flat price dominates the $15 allowance.
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 500 })
  ], 1)

  const row = findRow(rows.rows, 'copilot-pro', 'claude-sonnet-5-5')
  assert.equal(row.hasOverage, true)
  // 30 tasks * $500 = $15 000; $10 + $14 985 of overage.
  assert.equal(row.totalMonthlyCostAtUsage, 10 + (30 - 15 / 500) * 500)
  assert.ok(row.costPerTaskAtUsage! < row.apiCostPerTask!)
})

test('a request-quota plan cannot claim a number of covered tasks', () => {
  // MiniMax Token Starter: the quota is counted in requests per 5-hour
  // window, not in dollars, and one agent task is many requests. The number
  // of covered tasks is therefore not calculable.
  const rows = compareSubscriptionPlans([
    model('minimax-m2-7', { estimatedCostPerTask: 8.64 })
  ], 5)

  const row = findRow(rows.rows, 'minimax-token-starter', 'minimax-m2-7')
  assert.equal(row.plan.quota?.kind, 'quota-units')
  assert.equal(row.plan.quota?.requestsPerWindow, 1500)
  assert.equal(row.plan.quota?.windowHours, 5)
  assert.equal(row.includedTasksPerMonth, null)
  // The plan price spread over the usage is a lower bound, and it is below
  // the API cost only because the quota is assumed to hold.
  assert.equal(row.costIsLowerBound, true)
  assert.equal(row.costPerTaskAtUsage, 10 / 150)
})

test('soft-limit plans do not get an invented quota value', () => {
  const rows = compareSubscriptionPlans([
    model('claude-sonnet-5-5', { aaCodingAgentCostPerTask: 10 })
  ], 5)

  for (const planId of ['claude-pro', 'claude-max', 'chatgpt-plus', 'google-ai-pro']) {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId)
    assert.equal(plan?.quota?.kind, 'soft-limits', planId)
    assert.equal(plan?.quota?.amountUsdPerMonth, undefined, planId)
  }

  const row = findRow(rows.rows, 'claude-pro', 'claude-sonnet-5-5')
  assert.equal(row.includedTasksPerMonth, null)
  assert.equal(row.hasOverage, false)
})
