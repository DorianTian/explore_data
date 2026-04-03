import { eq } from 'drizzle-orm';
import {
  schemaTables,
  schemaColumns,
  schemaRelationships,
  columnEmbeddings,
  type DbClient,
} from '@nl2sql/db';
import { EmbeddingService } from './embedding-service.js';
import type { SchemaContext } from './types.js';

/**
 * Schema Linker — resolves which tables/columns are relevant to a user query.
 *
 * Two-stage approach:
 * Stage 1: Embedding similarity — recall top-K candidate columns
 * Stage 2: For small schemas (<50 columns), include all; for large ones, use embedding filter
 */
export class SchemaLinker {
  private embeddingService: EmbeddingService | null;

  constructor(
    private db: DbClient,
    openaiApiKey?: string,
    openaiBaseUrl?: string,
  ) {
    this.embeddingService = openaiApiKey
      ? new EmbeddingService(openaiApiKey, openaiBaseUrl)
      : null;
  }

  /** Load full schema for a datasource */
  async loadSchema(datasourceId: string): Promise<SchemaContext> {
    const tables = await this.db
      .select()
      .from(schemaTables)
      .where(eq(schemaTables.datasourceId, datasourceId));

    const schemaContext: SchemaContext = { tables: [], relationships: [] };

    for (const table of tables) {
      const columns = await this.db
        .select()
        .from(schemaColumns)
        .where(eq(schemaColumns.tableId, table.id))
        .orderBy(schemaColumns.ordinalPosition);

      schemaContext.tables.push({
        name: table.name,
        comment: table.comment,
        columns: columns.map((c) => ({
          name: c.name,
          dataType: c.dataType,
          comment: c.comment,
          sampleValues: c.sampleValues,
          isPrimaryKey: c.isPrimaryKey,
        })),
      });
    }

    const rels = await this.db
      .select()
      .from(schemaRelationships)
      .where(eq(schemaRelationships.datasourceId, datasourceId));

    for (const rel of rels) {
      const fromTable = tables.find((t) => t.id === rel.fromTableId);
      const toTable = tables.find((t) => t.id === rel.toTableId);
      if (!fromTable || !toTable) continue;

      const [fromCol] = await this.db
        .select()
        .from(schemaColumns)
        .where(eq(schemaColumns.id, rel.fromColumnId));
      const [toCol] = await this.db
        .select()
        .from(schemaColumns)
        .where(eq(schemaColumns.id, rel.toColumnId));

      if (fromCol && toCol) {
        schemaContext.relationships.push({
          fromTable: fromTable.name,
          fromColumn: fromCol.name,
          toTable: toTable.name,
          toColumn: toCol.name,
        });
      }
    }

    return schemaContext;
  }

  /**
   * Smart schema linking — for large schemas, use embeddings to filter relevant columns.
   * For small schemas (<50 columns total), return everything.
   */
  async linkSchema(
    datasourceId: string,
    userQuery: string,
  ): Promise<SchemaContext> {
    const fullSchema = await this.loadSchema(datasourceId);

    const totalColumns = fullSchema.tables.reduce(
      (sum, t) => sum + t.columns.length,
      0,
    );

    // Small schema — return everything, LLM can handle it
    if (totalColumns <= 50 || !this.embeddingService) {
      return fullSchema;
    }

    // Large schema — use embedding similarity to filter
    return this.filterByEmbedding(fullSchema, datasourceId, userQuery);
  }

  /** Generate and store column embeddings for a datasource */
  async generateColumnEmbeddings(datasourceId: string): Promise<number> {
    if (!this.embeddingService) {
      throw new Error('OpenAI API key required for embedding generation');
    }

    const tables = await this.db
      .select()
      .from(schemaTables)
      .where(eq(schemaTables.datasourceId, datasourceId));

    let count = 0;

    for (const table of tables) {
      const columns = await this.db
        .select()
        .from(schemaColumns)
        .where(eq(schemaColumns.tableId, table.id));

      const texts = columns.map((col) => {
        let text = `${table.name}.${col.name}`;
        if (col.comment) text += ` — ${col.comment}`;
        if (col.dataType) text += ` (${col.dataType})`;
        if (col.sampleValues && col.sampleValues.length > 0) {
          text += `, e.g. ${col.sampleValues.slice(0, 3).join(', ')}`;
        }
        return text;
      });

      if (texts.length === 0) continue;

      const embeddings = await this.embeddingService.embed(texts);

      for (let i = 0; i < columns.length; i++) {
        // Upsert column embedding
        await this.db
          .insert(columnEmbeddings)
          .values({
            columnId: columns[i].id,
            textRepresentation: texts[i],
            embedding: embeddings[i],
          })
          .onConflictDoNothing();

        count++;
      }
    }

    return count;
  }

  private async filterByEmbedding(
    fullSchema: SchemaContext,
    datasourceId: string,
    userQuery: string,
  ): Promise<SchemaContext> {
    if (!this.embeddingService) return fullSchema;

    const queryEmbedding = await this.embeddingService.embedSingle(userQuery);

    // Load stored column embeddings
    const storedEmbeddings = await this.db
      .select()
      .from(columnEmbeddings);

    if (storedEmbeddings.length === 0) return fullSchema;

    const items = storedEmbeddings
      .filter((e) => e.embedding !== null)
      .map((e, index) => ({
        embedding: e.embedding as number[],
        index,
        textRepresentation: e.textRepresentation,
      }));

    // Get top-30 most relevant columns
    const topK = this.embeddingService.findTopK(
      queryEmbedding,
      items,
      30,
    );

    const relevantTexts = new Set(
      topK.map((k) => items[k.index].textRepresentation.split('.')[0].toLowerCase()),
    );

    // Filter schema to only include tables with relevant columns
    const filtered: SchemaContext = {
      tables: fullSchema.tables.filter((t) =>
        relevantTexts.has(t.name.toLowerCase()),
      ),
      relationships: fullSchema.relationships.filter(
        (r) =>
          relevantTexts.has(r.fromTable.toLowerCase()) ||
          relevantTexts.has(r.toTable.toLowerCase()),
      ),
    };

    return filtered.tables.length > 0 ? filtered : fullSchema;
  }

  /** Format schema as DDL for LLM prompt (most natural format for LLMs) */
  formatAsDdl(schema: SchemaContext): string {
    const parts: string[] = [];

    for (const table of schema.tables) {
      const colDefs = table.columns.map((col) => {
        let def = `  ${col.name} ${col.dataType}`;
        if (col.isPrimaryKey) def += ' PRIMARY KEY';
        if (col.comment) def += ` -- ${col.comment}`;
        if (col.sampleValues && col.sampleValues.length > 0) {
          def += `, e.g. ${col.sampleValues.slice(0, 3).map((v) => `'${v}'`).join(', ')}`;
        }
        return def;
      });

      let tableComment = '';
      if (table.comment) tableComment = `-- ${table.comment}\n`;
      parts.push(
        `${tableComment}CREATE TABLE ${table.name} (\n${colDefs.join(',\n')}\n);`,
      );
    }

    if (schema.relationships.length > 0) {
      parts.push('\n-- Relationships:');
      for (const rel of schema.relationships) {
        parts.push(
          `-- ${rel.fromTable}.${rel.fromColumn} -> ${rel.toTable}.${rel.toColumn}`,
        );
      }
    }

    return parts.join('\n\n');
  }
}
