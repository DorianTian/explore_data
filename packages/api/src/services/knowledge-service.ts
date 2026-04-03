import { eq } from 'drizzle-orm';
import {
  knowledgeDocs,
  knowledgeChunks,
  glossaryEntries,
  type DbClient,
} from '@nl2sql/db';
import type { z } from 'zod';
import type {
  createKnowledgeDocSchema,
  createGlossaryEntrySchema,
  updateGlossaryEntrySchema,
} from '@nl2sql/shared';

type CreateDocInput = z.infer<typeof createKnowledgeDocSchema>;
type CreateGlossaryInput = z.infer<typeof createGlossaryEntrySchema>;
type UpdateGlossaryInput = z.infer<typeof updateGlossaryEntrySchema>;

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

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
        await tx.insert(knowledgeChunks).values(
          chunks.map((content, index) => ({
            docId: doc.id,
            content,
            chunkIndex: index,
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
    const [doc] = await this.db
      .select()
      .from(knowledgeDocs)
      .where(eq(knowledgeDocs.id, docId));
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

  /** Glossary — business term to SQL expression mapping */
  async createGlossaryEntry(input: CreateGlossaryInput) {
    const [row] = await this.db
      .insert(glossaryEntries)
      .values({
        projectId: input.projectId,
        term: input.term,
        sqlExpression: input.sqlExpression,
        description: input.description ?? null,
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
    return row ?? null;
  }

  async removeGlossaryEntry(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(glossaryEntries)
      .where(eq(glossaryEntries.id, id))
      .returning();
    return row !== undefined;
  }

  /** Split text into overlapping chunks for embedding */
  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    const words = text.split(/\s+/);

    if (words.length <= CHUNK_SIZE) {
      return [text];
    }

    for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
      if (chunk.trim()) chunks.push(chunk);
      if (i + CHUNK_SIZE >= words.length) break;
    }

    return chunks;
  }
}
