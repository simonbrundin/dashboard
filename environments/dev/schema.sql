-- Models table for AI model comparison data
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    provider VARCHAR(255) NOT NULL,
    provider_logo VARCHAR(100),
    intelligence_index INTEGER NOT NULL,
    cost_per_task DECIMAL(10, 4) NOT NULL,
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
