import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { datasources } from './datasources.js';
import { schemaTables } from './schema-tables.js';
import { schemaColumns } from './schema-columns.js';

export const schemaRelationships = pgTable('schema_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  datasourceId: uuid('datasource_id')
    .notNull()
    .references(() => datasources.id, { onDelete: 'cascade' }),
  fromTableId: uuid('from_table_id')
    .notNull()
    .references(() => schemaTables.id),
  fromColumnId: uuid('from_column_id')
    .notNull()
    .references(() => schemaColumns.id),
  toTableId: uuid('to_table_id')
    .notNull()
    .references(() => schemaTables.id),
  toColumnId: uuid('to_column_id')
    .notNull()
    .references(() => schemaColumns.id),
  relationshipType: varchar('relationship_type', { length: 20 }).notNull(),
});
