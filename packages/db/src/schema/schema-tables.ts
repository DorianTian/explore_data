import { pgTable, uuid, varchar, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { datasources } from './datasources.js';

export const schemaTables = pgTable('schema_tables', {
  id: uuid('id').defaultRandom().primaryKey(),
  datasourceId: uuid('datasource_id')
    .notNull()
    .references(() => datasources.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  comment: text('comment'),
  rowCount: bigint('row_count', { mode: 'number' }),
  ddl: text('ddl'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
