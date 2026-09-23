import { query } from '../utils/db'
import { modelsData } from '~/data/models'

export default defineEventHandler(async () => {
  // Create table if not exists
  await query(`
    CREATE TABLE IF NOT EXISTS models (
      id UUID PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      provider VARCHAR(255) NOT NULL,
      provider_logo VARCHAR(100),
      intelligence_index INTEGER NOT NULL,
      cost_per_task DECIMAL(10, 4),
      input_price_per_m DECIMAL(10, 2),
      output_price_per_m DECIMAL(10, 2),
      category VARCHAR(50) NOT NULL,
      strengths TEXT,
      context_window VARCHAR(100),
      open_weights BOOLEAN DEFAULT FALSE,
      speed INTEGER,
      latency DECIMAL(10, 2),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // Insert initial data
  let inserted = 0
  for (const model of modelsData) {
    try {
      await query(`
        INSERT INTO models (id, name, slug, provider, provider_logo, intelligence_index,
          cost_per_task, input_price_per_m, output_price_per_m, category,
          strengths, context_window, open_weights, speed, latency)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO NOTHING
      `, [
        model.id,
        model.name,
        model.slug || model.id,
        model.provider,
        model.providerLogo,
        model.intelligenceIndex,
        model.costPerTask || null,
        model.inputPricePerM || null,
        model.outputPricePerM || null,
        model.category,
        model.strengths.join(','),
        model.contextWindow,
        model.openWeights,
        model.speed || null,
        model.latency || null
      ])
      inserted++
    } catch (e) {
      console.error(`Failed to insert ${model.name}:`, e)
    }
  }

  return { success: true, inserted }
})
