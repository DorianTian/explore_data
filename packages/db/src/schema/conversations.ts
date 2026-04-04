import { pgTable, uuid, varchar, text, real, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  generatedSql: text('generated_sql'),
  executionResult: jsonb('execution_result'),
  chartConfig: jsonb('chart_config'),
  confidence: real('confidence'),
  schemaUsed: jsonb('schema_used'),
  metricsUsed: uuid('metrics_used').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const queryHistory = pgTable('query_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  naturalLanguage: text('natural_language').notNull(),
  generatedSql: text('generated_sql').notNull(),
  correctedSql: text('corrected_sql'),
  wasAccepted: real('was_accepted'),
  tablesUsed: text('tables_used').array(),
  columnsUsed: text('columns_used').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
