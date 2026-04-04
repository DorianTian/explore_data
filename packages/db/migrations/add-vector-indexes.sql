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
