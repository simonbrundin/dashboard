-- Models table for AI model comparison data
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY,
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
    aa_coding_agent_index DECIMAL(5, 2),
    aa_coding_agent_cost_per_task DECIMAL(10, 4),
    cost_per_task DECIMAL(10, 4),
    input_price_per_m DECIMAL(10, 2),
    output_price_per_m DECIMAL(10, 2),
    category VARCHAR(50) NOT NULL,
    strengths TEXT[],
    context_window VARCHAR(100),
    open_weights BOOLEAN DEFAULT FALSE,
    speed INTEGER,
    latency DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_models_category ON models(category);
CREATE INDEX IF NOT EXISTS idx_models_intelligence ON models(intelligence_index DESC);
CREATE INDEX IF NOT EXISTS idx_models_coding ON models(coding_index DESC);
CREATE INDEX IF NOT EXISTS idx_models_benchlm_coding ON models(benchlm_coding_score DESC);
CREATE INDEX IF NOT EXISTS idx_models_cost ON models(cost_per_task);
CREATE INDEX IF NOT EXISTS idx_models_slug ON models(slug);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS models_updated_at ON models;
CREATE TRIGGER models_updated_at
    BEFORE UPDATE ON models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
