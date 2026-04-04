import { eq } from 'drizzle-orm';
import {
  schemaTables,
  schemaColumns,
  schemaRelationships,
  columnEmbeddings,
  type DbClient,
} from '@nl2sql/db';
import type { DdlParseResult } from '@nl2sql/shared';
import { DdlParser } from './ddl-parser.js';

interface IngestResult {
  tables: Array<{
    table: typeof schemaTables.$inferSelect;
    columns: Array<typeof schemaColumns.$inferSelect>;
  }>;
  relationships: Array<typeof schemaRelationships.$inferSelect>;
  embeddingCount?: number;
}

/**
 * Ingest-oriented schema service.
 * Users feed DDL → platform parses and stores everything.
 * Users only annotate (comment, PII, sample values) after ingest.
 */
export class SchemaService {
  private ddlParser = new DdlParser();

  constructor(private db: DbClient) {}

  /** Ingest DDL — parse and store all tables, columns, and FK relationships */
  async ingestDdl(datasourceId: string, ddl: string): Promise<IngestResult> {
    const parsed = this.ddlParser.parseMultiple(ddl);
    if (parsed.length === 0) {
      const single = this.ddlParser.parse(ddl);
      if (single) parsed.push(single);
    }

    if (parsed.length === 0) {
      throw Object.assign(new Error('No valid CREATE TABLE statements found in DDL'), {
        status: 400,
      });
    }

    const txResult = await this.db.transaction(async (tx) => {
      // Check for existing tables to avoid duplicates
      const existingTables = await tx
        .select()
        .from(schemaTables)
        .where(eq(schemaTables.datasourceId, datasourceId));
      const existingNames = new Set(existingTables.map((t) => t.name.toLowerCase()));

      const tables: IngestResult['tables'] = [];
      const tableNameToId = new Map<string, string>();
      const columnNameToId = new Map<string, string>();

      // Pre-populate maps with existing tables for cross-batch FK resolution
      for (const existing of existingTables) {
        tableNameToId.set(existing.name.toLowerCase(), existing.id);
        const cols = await tx
          .select()
          .from(schemaColumns)
          .where(eq(schemaColumns.tableId, existing.id));
        for (const col of cols) {
          columnNameToId.set(
            `${existing.name.toLowerCase()}.${col.name.toLowerCase()}`,
            col.id,
          );
        }
      }

      for (const def of parsed) {
        // Skip tables that already exist in this datasource
        if (existingNames.has(def.tableName.toLowerCase())) continue;

        const { table, columns } = await this.insertTableWithColumns(
          tx,
          datasourceId,
          def,
        );
        tables.push({ table, columns });
        tableNameToId.set(def.tableName.toLowerCase(), table.id);
        for (const col of columns) {
          columnNameToId.set(
            `${def.tableName.toLowerCase()}.${col.name.toLowerCase()}`,
            col.id,
          );
        }
      }

      const relationships: IngestResult['relationships'] = [];
      for (const def of parsed) {
        for (const fk of def.foreignKeys) {
          const fromTableId = tableNameToId.get(def.tableName.toLowerCase());
          const fromColId = columnNameToId.get(
            `${def.tableName.toLowerCase()}.${fk.column.toLowerCase()}`,
          );
          const toTableId = tableNameToId.get(fk.referencedTable.toLowerCase());
          const toColId = columnNameToId.get(
            `${fk.referencedTable.toLowerCase()}.${fk.referencedColumn.toLowerCase()}`,
          );

          if (fromTableId && fromColId && toTableId && toColId) {
            const [rel] = await tx
              .insert(schemaRelationships)
              .values({
                datasourceId,
                fromTableId,
                fromColumnId: fromColId,
                toTableId,
                toColumnId: toColId,
                relationshipType: 'fk',
              })
              .returning();
            relationships.push(rel);
          }
        }
      }

      return { tables, relationships };
    });

    // Auto-generate column embeddings (best-effort, outside transaction)
    let embeddingCount = 0;
    if (process.env.OPENAI_API_KEY) {
      try {
        const { SchemaLinker } = await import('@nl2sql/engine');
        const linker = new SchemaLinker(
          this.db,
          process.env.OPENAI_API_KEY,
          process.env.OPENAI_BASE_URL,
        );
        embeddingCount = await linker.generateColumnEmbeddings(datasourceId);
      } catch {
        // Embedding generation is best-effort
      }
    }

    return { ...txResult, embeddingCount };
  }

  async listTables(datasourceId: string) {
    return this.db
      .select()
      .from(schemaTables)
      .where(eq(schemaTables.datasourceId, datasourceId))
      .orderBy(schemaTables.name);
  }

  async getTableWithColumns(tableId: string) {
    const [table] = await this.db
      .select()
      .from(schemaTables)
      .where(eq(schemaTables.id, tableId));
    if (!table) return null;

    const columns = await this.db
      .select()
      .from(schemaColumns)
      .where(eq(schemaColumns.tableId, tableId))
      .orderBy(schemaColumns.ordinalPosition);

    return { table, columns };
  }

  async annotateTable(tableId: string, input: { comment?: string }) {
    const [row] = await this.db
      .update(schemaTables)
      .set(input)
      .where(eq(schemaTables.id, tableId))
      .returning();
    return row ?? null;
  }

  async annotateColumn(
    columnId: string,
    input: { comment?: string; sampleValues?: string[]; isPii?: boolean },
  ) {
    const [row] = await this.db
      .update(schemaColumns)
      .set(input)
      .where(eq(schemaColumns.id, columnId))
      .returning();

    if (!row) return null;

    // Re-generate embedding for this column with updated metadata
    if (process.env.OPENAI_API_KEY && (input.comment !== undefined || input.sampleValues !== undefined)) {
      try {
        const [table] = await this.db
          .select()
          .from(schemaTables)
          .where(eq(schemaTables.id, row.tableId));

        if (table) {
          const { EmbeddingService } = await import('@nl2sql/engine');
          const embService = new EmbeddingService(
            process.env.OPENAI_API_KEY,
            process.env.OPENAI_BASE_URL,
          );

          const text = EmbeddingService.buildColumnText({
            tableName: table.name,
            tableComment: table.comment,
            columnName: row.name,
            columnComment: row.comment,
            dataType: row.dataType,
            sampleValues: row.sampleValues,
            isPrimaryKey: row.isPrimaryKey,
          });

          const embedding = await embService.embedSingle(text);

          await this.db
            .delete(columnEmbeddings)
            .where(eq(columnEmbeddings.columnId, columnId));
          await this.db.insert(columnEmbeddings).values({
            columnId,
            textRepresentation: text,
            embedding,
          });
        }
      } catch {
        // Embedding re-generation is best-effort
      }
    }

    return row;
  }

  async removeTable(tableId: string): Promise<boolean> {
    const [row] = await this.db
      .delete(schemaTables)
      .where(eq(schemaTables.id, tableId))
      .returning();
    return row !== undefined;
  }

  async listRelationships(datasourceId: string) {
    return this.db
      .select()
      .from(schemaRelationships)
      .where(eq(schemaRelationships.datasourceId, datasourceId));
  }

  private async insertTableWithColumns(
    tx: Parameters<Parameters<DbClient['transaction']>[0]>[0],
    datasourceId: string,
    def: DdlParseResult,
  ) {
    const [table] = await tx
      .insert(schemaTables)
      .values({
        datasourceId,
        name: def.tableName,
        comment: def.comment,
      })
      .returning();

    const columns = await tx
      .insert(schemaColumns)
      .values(
        def.columns.map((col, index) => ({
          tableId: table.id,
          name: col.name,
          dataType: col.dataType,
          comment: col.comment,
          isPrimaryKey: col.isPrimaryKey,
          isNullable: col.isNullable,
          isPii: false,
          ordinalPosition: index + 1,
        })),
      )
      .returning();

    return { table, columns };
  }
}
