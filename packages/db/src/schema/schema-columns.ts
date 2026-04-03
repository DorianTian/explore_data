import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { schemaTables } from './schema-tables.js';

export const schemaColumns = pgTable('schema_columns', {
  id: uuid('id').defaultRandom().primaryKey(),
  tableId: uuid('table_id')
    .notNull()
    .references(() => schemaTables.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  dataType: varchar('data_type', { length: 50 }).notNull(),
  comment: text('comment'),
  sampleValues: text('sample_values').array(),
  isPrimaryKey: boolean('is_primary_key').default(false).notNull(),
  isNullable: boolean('is_nullable').default(true).notNull(),
  isPii: boolean('is_pii').default(false).notNull(),
  ordinalPosition: integer('ordinal_position').notNull(),
});
