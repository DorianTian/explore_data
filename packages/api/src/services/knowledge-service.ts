import { eq } from 'drizzle-orm';
import { knowledgeDocs, knowledgeChunks, glossaryEntries, type DbClient } from '@nl2sql/db';
import type { z } from 'zod';
import type {
  createKnowledgeDocSchema,
  createGlossaryEntrySchema,
  updateGlossaryEntrySchema,
} from '@nl2sql/shared';

type CreateDocInput = z.infer<typeof createKnowledgeDocSchema>;
type CreateGlossaryInput = z.infer<typeof createGlossaryEntrySchema>;
type UpdateGlossaryInput = z.infer<typeof updateGlossaryEntrySchema>;

/** Chunk size in characters (not words — supports Chinese text without spaces) */
const CHUNK_SIZE = 800;
/** Overlap in characters for context continuity */
const CHUNK_OVERLAP = 100;

/** Try to get embedding service — returns null if no API key */
async function getEmbeddingService() {
  if (!process.env.OPENAI_API_KEY) return null;
  const { EmbeddingService } = await import('@nl2sql/engine');
  return new EmbeddingService(process.env.OPENAI_API_KEY, process.env.OPENAI_BASE_URL);
}

export class KnowledgeService {
  constructor(private db: DbClient) {}

  /** Create a knowledge doc and split into chunks for RAG */
  async createDoc(input: CreateDocInput) {
    return this.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(knowledgeDocs)
        .values({
          projectId: input.projectId,
          title: input.title,
          content: input.content,
          docType: input.docType,
        })
        .returning();

      const chunks = this.splitIntoChunks(input.content);
      if (chunks.length > 0) {
        // Generate chunk embeddings if API key available
        let chunkEmbeddings: Array<number[] | null> = chunks.map(() => null);
        try {
          const embService = await getEmbeddingService();
          if (embService) {
            const vectors = await embService.embed(chunks);
            chunkEmbeddings = vectors;
          }
        } catch {
          // Best-effort embedding
        }

        await tx.insert(knowledgeChunks).values(
          chunks.map((content, index) => ({
            docId: doc.id,
            content,
            chunkIndex: index,
            embedding: chunkEmbeddings[index] ?? null,
          })),
        );
      }

      return { doc, chunkCount: chunks.length };
    });
  }

  async listDocs(projectId: string) {
    return this.db
      .select()
      .from(knowledgeDocs)
      .where(eq(knowledgeDocs.projectId, projectId))
      .orderBy(knowledgeDocs.createdAt);
  }

  async getDoc(docId: string) {
    const [doc] = await this.db.select().from(knowledgeDocs).where(eq(knowledgeDocs.id, docId));
    if (!doc) return null;

    const chunks = await this.db
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.docId, docId))
      .orderBy(knowledgeChunks.chunkIndex);

    return { doc, chunks };
  }

  async removeDoc(docId: string): Promise<boolean> {
    const [row] = await this.db
      .delete(knowledgeDocs)
      .where(eq(knowledgeDocs.id, docId))
      .returning();
    return row !== undefined;
  }

  /** Glossary — business term to SQL expression mapping, auto-generates embedding */
  async createGlossaryEntry(input: CreateGlossaryInput) {
    // Build embedding text: "活跃用户 — 30天内有登录行为的用户. SQL: WHERE last_login > ..."
    let embeddingText = input.term;
    if (input.description) embeddingText += ` — ${input.description}`;
    embeddingText += `. SQL: ${input.sqlExpression}`;

    let embedding: number[] | null = null;
    try {
      const embService = await getEmbeddingService();
      if (embService) {
        embedding = await embService.embedSingle(embeddingText);
      }
    } catch {
      // Embedding generation is best-effort
    }

    const [row] = await this.db
      .insert(glossaryEntries)
      .values({
        projectId: input.projectId,
        term: input.term,
        sqlExpression: input.sqlExpression,
        description: input.description ?? null,
        embedding,
      })
      .returning();
    return row;
  }

  async listGlossary(projectId: string) {
    return this.db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.projectId, projectId))
      .orderBy(glossaryEntries.term);
  }

  async updateGlossaryEntry(id: string, input: UpdateGlossaryInput) {
    const [row] = await this.db
      .update(glossaryEntries)
      .set(input)
      .where(eq(glossaryEntries.id, id))
      .returning();

    if (!row) return null;

    // Re-generate embedding when term or SQL expression changes
    if (input.term !== undefined || input.sqlExpression !== undefined || input.description !== undefined) {
      try {
        const embService = await getEmbeddingService();
        if (embService) {
          let embeddingText = row.term;
          if (row.description) embeddingText += ` — ${row.description}`;
          embeddingText += `. SQL: ${row.sqlExpression}`;

          const embedding = await embService.embedSingle(embeddingText);
          await this.db
            .update(glossaryEntries)
            .set({ embedding })
            .where(eq(glossaryEntries.id, id));
        }
      } catch {
        // Embedding re-generation is best-effort
      }
    }

    return row;
  }

  async removeGlossaryEntry(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(glossaryEntries)
      .where(eq(glossaryEntries.id, id))
      .returning();
    return row !== undefined;
  }

  /** Split text into overlapping chunks for embedding (character-based, supports Chinese) */
  private splitIntoChunks(text: string): string[] {
    if (text.length <= CHUNK_SIZE) {
      return [text.trim()].filter(Boolean);
    }

    // Split on sentence boundaries: Chinese (。！？；) and English (. ! ? ;) plus newlines
    const sentences = text.split(/(?<=[。！？；\.\!\?\n])\s*/);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      // If a single sentence exceeds CHUNK_SIZE, split it at CHUNK_SIZE boundaries
      if (sentence.length > CHUNK_SIZE) {
        // Flush whatever we have first
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        for (let i = 0; i < sentence.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          const slice = sentence.slice(i, i + CHUNK_SIZE).trim();
          if (slice) chunks.push(slice);
          if (i + CHUNK_SIZE >= sentence.length) break;
        }
        continue;
      }

      // Would adding this sentence exceed the limit?
      if (currentChunk.length + sentence.length > CHUNK_SIZE) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        // Start new chunk with overlap from end of previous chunk
        const overlap = currentChunk.slice(-CHUNK_OVERLAP);
        currentChunk = overlap + sentence;
      } else {
        currentChunk += sentence;
      }
    }

    // Flush remaining
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
