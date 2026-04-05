/**
 * Centralized engine configuration — model names, timeouts, thresholds.
 * Single source of truth; no hardcoded values scattered across files.
 */

export const MODEL = {
  /** Primary generation model — high quality, higher latency */
  generation: 'claude-sonnet-4-20250514',
  /** Fast classification/routing model — low latency, lower cost */
  classification: 'claude-haiku-4-5-20251001',
} as const;

export const TIMEOUT = {
  /** Classification / routing / decomposition calls */
  fast: 15_000,
  /** SQL generation / verification calls */
  generation: 30_000,
  /** Agent orchestrator tool-use loop (longer for multi-turn) */
  agent: 45_000,
  /** Chart selection */
  chart: 10_000,
} as const;

export const SCHEMA_LINKING = {
  /** Below this column count, return full schema (no embedding needed) */
  smallSchemaThreshold: 50,
  /** Top-K columns to retrieve from pgvector */
  topK: 30,
  /** Skip LLM reranking below this table count */
  rerankThreshold: 5,
  /** Max columns to include in table-level embedding text */
  tableTextMaxColumns: 15,
} as const;

export const RAG = {
  /** Cosine distance threshold — lower = more similar (0=identical, 2=opposite) */
  distanceThreshold: 0.7,
  /** Number of knowledge chunks to retrieve */
  topK: 5,
  /** Chunk size in characters (NOT words — supports Chinese) */
  chunkSize: 800,
  /** Overlap in characters */
  chunkOverlap: 100,
} as const;

export const PIPELINE = {
  /** Max agent tool-use turns */
  maxAgentTurns: 8,
  /** Max generate → review → fix iterations in agent path */
  maxGenerationLoops: 3,
  /** Confidence threshold below which SqlVerifier is triggered */
  verificationThreshold: 0.95,
  /** Max conversation history turns sent to LLM */
  maxHistoryTurns: 4,
  /** Max few-shot examples */
  maxFewShotExamples: 5,
  /** Default row limit for query execution */
  defaultRowLimit: 1000,
  /** Default query execution timeout */
  defaultQueryTimeout: 30_000,
} as const;

export const VALIDATION = {
  maxSubqueryDepth: 3,
  maxJoinCount: 5,
} as const;

export const VERIFICATION = {
  maxRounds: 3,
  passThreshold: 90,
} as const;
