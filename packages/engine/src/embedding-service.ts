import OpenAI from 'openai';

/**
 * Embedding service — wraps OpenAI text-embedding-3-small for:
 * 1. Schema linking (column embedding → query similarity)
 * 2. Knowledge retrieval (RAG)
 * 3. Glossary matching
 */
export class EmbeddingService {
  private client: OpenAI;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL ?? process.env.OPENAI_BASE_URL ?? undefined,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });

    return response.data.map((d) => d.embedding);
  }

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
  }

  /** Cosine similarity between two vectors */
  cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /** Find top-K most similar items from a list of embeddings */
  findTopK(
    queryEmbedding: number[],
    items: Array<{ embedding: number[]; index: number }>,
    k: number,
  ): Array<{ index: number; score: number }> {
    const scored = items.map((item) => ({
      index: item.index,
      score: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }
}
