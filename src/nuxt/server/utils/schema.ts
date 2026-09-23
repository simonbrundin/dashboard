import { pgTable, text, varchar, integer, decimal, boolean, timestamp, index } from 'drizzle-orm/pg-core'

export const models = pgTable('models', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 500 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerLogo: varchar('provider_logo', { length: 100 }),
  intelligenceIndex: integer('intelligence_index').notNull(),
  costPerTask: decimal('cost_per_task', { precision: 10, scale: 4 }),
  inputPricePerM: decimal('input_price_per_m', { precision: 10, scale: 2 }),
  outputPricePerM: decimal('output_price_per_m', { precision: 10, scale: 2 }),
  category: varchar('category', { length: 50 }).notNull(),
  strengths: text('strengths').array(),
  contextWindow: varchar('context_window', { length: 100 }),
  openWeights: boolean('open_weights').default(false),
  speed: integer('speed'),
  latency: decimal('latency', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCategory: index('idx_models_category').on(table.category),
  idxIntelligence: index('idx_models_intelligence').on(table.intelligenceIndex),
  idxCost: index('idx_models_cost').on(table.costPerTask),
  idxSlug: index('idx_models_slug').on(table.slug),
}))
