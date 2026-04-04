import { pgTable, uuid, varchar, text, integer, timestamp, vector } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const knowledgeDocs = pgTable('knowledge_docs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  /** glossary | template | document */
  docType: varchar('doc_type', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const knowledgeChunks = pgTable('knowledge_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  docId: uuid('doc_id')
    .notNull()
    .references(() => knowledgeDocs.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  chunkIndex: integer('chunk_index').notNull(),
});

export const glossaryEntries = pgTable('glossary_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  /** Business term, e.g. "活跃用户" */
  term: varchar('term', { length: 100 }).notNull(),
  /** SQL expression mapping, e.g. "WHERE last_login > NOW() - INTERVAL '30 days'" */
  sqlExpression: text('sql_expression').notNull(),
  description: text('description'),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const columnEmbeddings = pgTable('column_embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  columnId: uuid('column_id').notNull(),
  /** "{table}.{column} — {comment}" */
  textRepresentation: text('text_representation').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
