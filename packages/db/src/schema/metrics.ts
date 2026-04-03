import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { schemaTables } from './schema-tables.js';

export const metrics = pgTable('metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  description: text('description'),
  /** SQL expression, e.g. "SUM(order_amount)" */
  expression: text('expression').notNull(),
  /** atomic | derived | composite */
  metricType: varchar('metric_type', { length: 20 }).notNull(),
  sourceTableId: uuid('source_table_id').references(() => schemaTables.id),
  /** Default WHERE filters, e.g. [{ column: "status", op: "=", value: "completed" }] */
  filters: jsonb('filters'),
  /** Available GROUP BY dimensions */
  dimensions: text('dimensions').array(),
  /** Time granularity options */
  granularity: text('granularity').array(),
  /** For derived metrics — references to component metric IDs */
  derivedFrom: uuid('derived_from').array(),
  /** Display format: number, percentage, currency */
  format: varchar('format', { length: 20 }).default('number'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
