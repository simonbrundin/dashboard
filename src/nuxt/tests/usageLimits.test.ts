import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ModelData } from '../app/data/models.ts'
import {
  getModelUsageLimits,
  usageLimitRows,
  usageLimitSummary
} from '../app/utils/usageLimits.ts'

/** Number formatting uses a non-breaking space, which tests normalise. */
function normalise(text: string): string {
  return text.replace(/\u00a0/g, ' ')
}

function model(overrides: Partial<ModelData>): ModelData {
  return {
    id: 'id',
    name: 'Model',
    slug: 'model',
    provider: 'Provider',
    ...overrides
  } as ModelData
}

test('läser de publicerade gränserna för en leverantörs modell', () => {
  const limits = getModelUsageLimits(
    model({ provider: 'Anthropic', slug: 'claude-sonnet-5-5' })
  )

  assert.equal(limits.notPublished, false)
  assert.equal(limits.api?.rpm, 4000)
  assert.equal(limits.api?.tpm, 2000000)
  assert.equal(limits.api?.monthlyUsdCap, 500)
  assert.equal(limits.api?.tier, 'Start')
})

test('håller dagsgränsen skild från minutgränsen', () => {
  const limits = getModelUsageLimits(model({ provider: 'Kimi', slug: 'kimi-k3' }))

  assert.equal(limits.api?.rpm, 3)
  assert.equal(limits.api?.tpm, 500000)
  assert.equal(limits.api?.tpd, 1500000)

  const day = usageLimitRows(limits).find(row => row.period === 'dag')
  assert.ok(day?.text.includes('1,5M tokens/dag'))
  assert.ok(!day?.text.includes('anrop/min'))
})

test('visar att dagsgränsen blir obegränsad vid högre nivå', () => {
  const limits = getModelUsageLimits(model({ provider: 'Kimi', slug: 'kimi-k3' }))
  const day = usageLimitRows(limits).find(row => row.period === 'dag')
  assert.ok(day?.text.includes('obegränsat vid högre nivå'))
})

test('visar månadsgränsen från den lägsta nivån som har en', () => {
  const limits = getModelUsageLimits(model({ provider: 'OpenAI', slug: 'gpt-6-luna' }))
  assert.equal(limits.api?.monthlyUsdCap, 100)
  assert.equal(limits.api?.tier, 'Build')
  assert.equal(limits.api?.rpm, 5000)
  assert.equal(limits.api?.tpm, 2000000)
})

test('markerar en leverantör utan publicerade siffror som ej publicerad', () => {
  const limits = getModelUsageLimits(model({ provider: 'Google', slug: 'gemini-4-neon' }))

  assert.equal(limits.notPublished, true)
  assert.equal(limits.api, null)
  assert.ok(limits.notPublishedReason?.includes('AI Studio'))
  assert.equal(usageLimitSummary(limits), 'ej publicerade')
})

test('hittar inte på en gräns för okänd leverantör', () => {
  const limits = getModelUsageLimits(model({ provider: 'Some Lab', slug: 'mystery' }))

  assert.equal(limits.api, null)
  assert.equal(limits.notPublished, false)
  assert.deepEqual(usageLimitRows(limits), [])
})

test('väljer den profil som matchar modellens slug', () => {
  const luna = getModelUsageLimits(model({ provider: 'OpenAI', slug: 'gpt-6-luna' }))
  const astra = getModelUsageLimits(model({ provider: 'OpenAI', slug: 'gpt-6-2-astra' }))

  assert.equal(luna.api?.tpm, 2000000)
  assert.equal(astra.api?.tpm, 1000000)
  assert.equal(luna.api?.rpm, 5000)
  assert.equal(astra.api?.rpm, 5000)
})

test('lägger till kvoten från de planer modellen ingår i', () => {
  const limits = getModelUsageLimits(
    model({ provider: 'MiniMax', slug: 'minimax-m2-7', name: 'MiniMax-M2.7' })
  )

  const quota = limits.plans.find(plan => plan.plan.id === 'minimax-token-starter')
  assert.ok(quota)
  assert.equal(quota?.kind, 'quota-units')
  assert.equal(quota?.value, 1500)
  assert.equal(quota?.window, '5 h')
  assert.ok(normalise(quota?.label ?? '').includes('1 500 anrop/5 h'))
})

test('markerar en plankvot utan publicerat värde som ej kvantifierad', () => {
  const limits = getModelUsageLimits(
    model({ provider: 'MiniMax', slug: 'minimax-m3-1-flash', name: 'MiniMax-M3.1-Flash' })
  )

  const planRows = usageLimitRows(limits).filter(row => row.period === 'plan')
  assert.ok(planRows.length > 0)
  assert.ok(planRows.every(row => row.unquantified))
})

test('visar en dollar-denominerad plankvot som månadsgräns', () => {
  const limits = getModelUsageLimits(
    model({ provider: 'Anthropic', slug: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' })
  )

  const credits = usageLimitRows(limits).find(row => row.text.includes('Copilot Pro'))
  assert.ok(normalise(credits?.text ?? '').includes('$15/mån i credits'))
})

test('en prenumeration täcker alla reasoning-effort-nivåer av samma modell', () => {
  const base = getModelUsageLimits(
    model({ provider: 'Anthropic', slug: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' })
  )
  const high = getModelUsageLimits(
    model({ provider: 'Anthropic', slug: 'claude-sonnet-5-5-high', name: 'Claude Sonnet 5.5' })
  )

  assert.ok(base.plans.length > 0)
  assert.equal(high.plans.length, base.plans.length)
  assert.ok(high.plans.some(quota => quota.plan.id === 'copilot-pro'))
})

test('en modell som inte ingår i planen får ingen plankvot', () => {
  const limits = getModelUsageLimits(
    model({ provider: 'Anthropic', slug: 'claude-3-haiku', name: 'Claude 3 Haiku' })
  )

  assert.equal(limits.plans.length, 0)
})
