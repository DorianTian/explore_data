import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { conversations } from './conversations.js';
import { datasources } from './datasources.js';

export const widgets = pgTable('widgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, {
    onDelete: 'set null',
  }),
  messageId: uuid('message_id'),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  naturalLanguage: text('natural_language').notNull(),
  sql: text('sql').notNull(),
  chartType: varchar('chart_type', { length: 30 }).notNull(),
  chartConfig: jsonb('chart_config').notNull(),
  dataSnapshot: jsonb('data_snapshot'),
  datasourceId: uuid('datasource_id')
    .notNull()
    .references(() => datasources.id),
  isLive: boolean('is_live').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
