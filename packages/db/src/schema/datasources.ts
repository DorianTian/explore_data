import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const datasources = pgTable('datasources', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  dialect: varchar('dialect', { length: 20 }).notNull(),
  connectionConfig: jsonb('connection_config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
