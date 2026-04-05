import { eq, inArray, sql } from 'drizzle-orm';
import {
  schemaTables,
  schemaColumns,
  schemaRelationships,
  columnEmbeddings,
  type DbClient,
} from '@nl2sql/db';
import { EmbeddingService } from './embedding-service.js';
import type { SchemaContext, ProgressCallback } from './types.js';

/**
 * Schema Linker — resolves which tables/columns are relevant to a user query.
 *
 * Two-stage embedding approach:
 * Stage 1 (coarse): Table-level embedding recall — which tables are relevant?
 * Stage 2 (fine): Column-level embedding recall — which columns within those tables?
 *
 * For small schemas (<50 columns), returns everything (LLM handles it).
 */
export class SchemaLinker {
  private embeddingService: EmbeddingService | null;

  constructor(
    private db: DbClient,
    openaiApiKey?: string,
    openaiBaseUrl?: string,
  ) {
    this.embeddingService = openaiApiKey ? new EmbeddingService(openaiApiKey, openaiBaseUrl) : null;
  }

  async loadSchema(datasourceId: string): Promise<SchemaContext> {
    const tables = await this.db
      .select()
      .from(schemaTables)
      .where(eq(schemaTables.datasourceId, datasourceId));

    const schemaContext: SchemaContext = { tables: [], relationships: [] };

    // Batch load ALL columns for this datasource's tables in one query
    const tableIds = tables.map((t) => t.id);
    const allColumns =
      tableIds.length > 0
        ? await this.db
            .select()
            .from(schemaColumns)
            .where(inArray(schemaColumns.tableId, tableIds))
            .orderBy(schemaColumns.ordinalPosition)
        : [];

    // Group columns by tableId for O(1) lookup
    const columnsByTableId = new Map<string, typeof allColumns>();
    for (const col of allColumns) {
      const group = columnsByTableId.get(col.tableId);
      if (group) {
        group.push(col);
      } else {
        columnsByTableId.set(col.tableId, [col]);
      }
    }

    // Build column-by-id map for relationship resolution (no extra queries)
    const columnById = new Map<string, (typeof allColumns)[number]>();
    for (const col of allColumns) {
      columnById.set(col.id, col);
    }

    for (const table of tables) {
      const columns = columnsByTableId.get(table.id) ?? [];

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

      const fromCol = columnById.get(rel.fromColumnId);
      const toCol = columnById.get(rel.toColumnId);

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

  async linkSchema(
    datasourceId: string,
    userQuery: string,
    onProgress?: ProgressCallback,
  ): Promise<SchemaContext> {
    const fullSchema = await this.loadSchema(datasourceId);

    const totalColumns = fullSchema.tables.reduce((sum, t) => sum + t.columns.length, 0);

    if (totalColumns <= 50 || !this.embeddingService) {
      onProgress?.(
        'schema_linking',
        `Small schema (${totalColumns} columns), returning full schema`,
        {
          thinking: `Total tables: ${fullSchema.tables.length}, columns: ${totalColumns}. Below threshold (50), skipping embedding filter.`,
        },
      );
      return fullSchema;
    }

    return this.twoStageEmbeddingFilter(fullSchema, datasourceId, userQuery, onProgress);
  }

  /**
   * Generate and store column embeddings for a datasource.
   * Uses natural language bilingual format for optimal matching.
   */
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

      // Build natural language bilingual text for embedding
      const texts = columns.map((col) =>
        EmbeddingService.buildColumnText({
          tableName: table.name,
          tableComment: table.comment,
          columnName: col.name,
          columnComment: col.comment,
          dataType: col.dataType,
          sampleValues: col.sampleValues,
          isPrimaryKey: col.isPrimaryKey,
        }),
      );

      if (texts.length === 0) continue;

      const embeddings = await this.embeddingService.embed(texts);

      for (let i = 0; i < columns.length; i++) {
        // Delete existing embedding for this column (upsert pattern)
        await this.db.delete(columnEmbeddings).where(eq(columnEmbeddings.columnId, columns[i].id));

        await this.db.insert(columnEmbeddings).values({
          columnId: columns[i].id,
          textRepresentation: texts[i],
          embedding: embeddings[i],
        });

        count++;
      }
    }

    return count;
  }

  /**
   * Two-stage embedding filter using pgvector native distance queries.
   * Scales to 2000+ tables / 20K+ columns.
   *
   * Stage 1: pgvector cosine distance query — find top-K relevant columns in DB
   * Stage 2: Include FK-connected tables for complete context
   */
  private async twoStageEmbeddingFilter(
    fullSchema: SchemaContext,
    datasourceId: string,
    userQuery: string,
    onProgress?: ProgressCallback,
  ): Promise<SchemaContext> {
    if (!this.embeddingService) return fullSchema;

    const queryEmbedding = await this.embeddingService.embedSingle(userQuery);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    // Stage 1: pgvector native cosine distance query
    // Uses <=> operator for cosine distance (1 - cosine_similarity)
    // Only searches columns belonging to this datasource via JOIN
    const topColumns = await this.db.execute<{
      column_id: string;
      text_representation: string;
      distance: number;
    }>(sql`
      SELECT ce.column_id, ce.text_representation,
             ce.embedding <=> ${vectorStr}::vector AS distance
      FROM column_embeddings ce
      INNER JOIN schema_columns sc ON sc.id = ce.column_id
      INNER JOIN schema_tables st ON st.id = sc.table_id
      WHERE st.datasource_id = ${datasourceId}
        AND ce.embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT 30
    `);

    if (!topColumns.rows || topColumns.rows.length === 0) return fullSchema;

    // Extract table names from top-K columns
    const relevantTableNames = new Set<string>();
    const candidateScores: Array<{ table: string; column: string; distance: number }> = [];
    for (const row of topColumns.rows) {
      const tableMatch = row.text_representation.match(/^Table:\s*(\S+)/);
      if (tableMatch) {
        const tableName = tableMatch[1].toLowerCase();
        relevantTableNames.add(tableName);
        candidateScores.push({
          table: tableName,
          column: row.text_representation.slice(0, 80),
          distance: row.distance,
        });
      }
    }

    const preExpansionCount = relevantTableNames.size;

    // Stage 2: Include FK-connected tables
    const fkExpanded: string[] = [];
    for (const rel of fullSchema.relationships) {
      if (
        relevantTableNames.has(rel.fromTable.toLowerCase()) &&
        !relevantTableNames.has(rel.toTable.toLowerCase())
      ) {
        relevantTableNames.add(rel.toTable.toLowerCase());
        fkExpanded.push(`${rel.fromTable} -> ${rel.toTable}`);
      }
      if (
        relevantTableNames.has(rel.toTable.toLowerCase()) &&
        !relevantTableNames.has(rel.fromTable.toLowerCase())
      ) {
        relevantTableNames.add(rel.fromTable.toLowerCase());
        fkExpanded.push(`${rel.toTable} -> ${rel.fromTable}`);
      }
    }

    // Emit thinking details
    const topCandidates = candidateScores
      .slice(0, 10)
      .map((c) => `  ${c.table}: dist=${c.distance.toFixed(4)} (${c.column})`)
      .join('\n');

    onProgress?.(
      'schema_linking',
      `Embedding recall: ${preExpansionCount} tables, FK expansion: +${fkExpanded.length}`,
      {
        thinking: `Top candidate columns by similarity:\n${topCandidates}\n\nFK expansion: ${fkExpanded.length > 0 ? fkExpanded.join(', ') : 'none'}`,
        data: {
          embeddingRecall: preExpansionCount,
          fkExpansion: fkExpanded.length,
          totalTables: relevantTableNames.size,
        },
      },
    );

    const filtered: SchemaContext = {
      tables: fullSchema.tables.filter((t) => relevantTableNames.has(t.name.toLowerCase())),
      relationships: fullSchema.relationships.filter(
        (r) =>
          relevantTableNames.has(r.fromTable.toLowerCase()) &&
          relevantTableNames.has(r.toTable.toLowerCase()),
      ),
    };

    return filtered.tables.length > 0 ? filtered : fullSchema;
  }

  formatAsDdl(schema: SchemaContext): string {
    const parts: string[] = [];

    for (const table of schema.tables) {
      const colDefs = table.columns.map((col) => {
        let def = `  ${col.name} ${col.dataType}`;
        if (col.isPrimaryKey) def += ' PRIMARY KEY';
        if (col.comment) def += ` -- ${col.comment}`;
        if (col.sampleValues && col.sampleValues.length > 0) {
          def += `, e.g. ${col.sampleValues
            .slice(0, 3)
            .map((v) => `'${v}'`)
            .join(', ')}`;
        }
        return def;
      });

      let tableComment = '';
      if (table.comment) tableComment = `-- ${table.comment}\n`;
      parts.push(`${tableComment}CREATE TABLE ${table.name} (\n${colDefs.join(',\n')}\n);`);
    }

    if (schema.relationships.length > 0) {
      parts.push('\n-- Relationships:');
      for (const rel of schema.relationships) {
        parts.push(`-- ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}`);
      }
    }

    return parts.join('\n\n');
  }
}
