-- Data integrity constraints + pgvector HNSW indexes
-- Consolidates add-vector-indexes.sql into Drizzle migration system

-- Unique constraint: one glossary term per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_glossary_project_term
  ON glossary_entries (project_id, lower(term));

-- Unique constraint: one embedding per column
CREATE UNIQUE INDEX IF NOT EXISTS idx_column_embeddings_column_id
  ON column_embeddings (column_id);

-- pgvector HNSW indexes for embedding similarity search
-- HNSW chosen over IVFFlat: better recall at small data, no training needed, auto-scales
CREATE INDEX IF NOT EXISTS idx_column_embeddings_embedding
  ON column_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_glossary_embedding
  ON glossary_entries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_query_history_project_created
  ON query_history (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_schema_columns_table_id
  ON schema_columns (table_id);
