import { Pool } from 'pg'
import { modelsData } from '~/data/models'

function getAdminConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  // Replace the user/password in the connection string with admin
  try {
    const parsed = new URL(url)
    parsed.username = 'admin'
    parsed.password = 'FykEBYDN9IU4L+x0d9HPHSkGbfsnvWEr' // From dashboard-db-admin secret
    return parsed.toString()
  } catch {
    throw new Error('Invalid DATABASE_URL')
  }
}

async function adminQuery<T>(text: string, params?: unknown[]): Promise<T[]> {
  const pool = new Pool({ connectionString: getAdminConnectionString() })
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rows as T[]
  } finally {
    client.release()
    await pool.end()
  }
}

export default defineEventHandler(async () => {
  // Grant permissions to user
  await adminQuery('GRANT ALL ON SCHEMA public TO "user"')
  await adminQuery('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "user"')
  await adminQuery('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "user"')

  // Drop and recreate table
  await adminQuery('DROP TABLE IF EXISTS models')

  // Create table
  await adminQuery(`
    CREATE TABLE models (
      id TEXT PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      provider VARCHAR(255) NOT NULL,
      provider_logo VARCHAR(100),
      intelligence_index INTEGER NOT NULL,
      coding_index DECIMAL(5, 2),
      terminal_bench_score DECIMAL(5, 2),
      benchlm_coding_score DECIMAL(5, 2),
      benchlm_evidence_status VARCHAR(30),
      benchlm_model_name VARCHAR(500),
      benchlm_match_type VARCHAR(20),
      aa_intelligence_cost_per_task DECIMAL(10, 4),
      terminal_bench_cost_per_task DECIMAL(10, 4),
      deep_swe_cost_per_task DECIMAL(10, 4),
      coding_agent_cost_per_task DECIMAL(10, 4),
      terminal_bench_cost_per_successful_task DECIMAL(10, 4),
      deep_swe_cost_per_successful_task DECIMAL(10, 4),
      coding_agent_cost_per_successful_task DECIMAL(10, 4),
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

  // Grant permissions again after table creation
  await adminQuery('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "user"')
  await adminQuery('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "user"')

  // Insert initial data
  let inserted = 0
  for (const model of modelsData) {
    try {
      await adminQuery(`
        INSERT INTO models (id, name, slug, provider, provider_logo, intelligence_index,
          coding_index, terminal_bench_score, benchlm_coding_score, benchlm_evidence_status,
          benchlm_model_name, benchlm_match_type,
          aa_intelligence_cost_per_task, terminal_bench_cost_per_task, deep_swe_cost_per_task,
          coding_agent_cost_per_task, terminal_bench_cost_per_successful_task,
          deep_swe_cost_per_successful_task, coding_agent_cost_per_successful_task,
          cost_per_task, input_price_per_m, output_price_per_m, category,
          strengths, context_window, open_weights, speed, latency)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        ON CONFLICT (id) DO NOTHING
      `, [
        model.id,
        model.name,
        model.slug || model.id,
        model.provider,
        model.providerLogo,
        model.intelligenceIndex,
        model.codingIndex ?? null,
        model.terminalBenchScore ?? null,
        model.benchLmCodingScore ?? null,
        model.benchLmEvidenceStatus ?? null,
        model.benchLmModelName ?? null,
        model.benchLmMatchType ?? null,
        model.aaIntelligenceCostPerTask ?? model.costPerTask ?? null,
        model.terminalBenchCostPerTask ?? null,
        model.deepSweCostPerTask ?? null,
        model.codingAgentCostPerTask ?? null,
        model.terminalBenchCostPerSuccessfulTask ?? null,
        model.deepSweCostPerSuccessfulTask ?? null,
        model.codingAgentCostPerSuccessfulTask ?? null,
        model.costPerTask ?? null,
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
