import { eq } from 'drizzle-orm';
import {
  schemaTables,
  schemaColumns,
  schemaRelationships,
  type DbClient,
} from '@nl2sql/db';
import type { SchemaContext } from './types.js';

/**
 * Schema Linker — resolves which tables/columns are relevant to a user query.
 *
 * Phase 3 approach: keyword matching + full schema for small schemas.
 * Future: embedding-based recall + LLM rerank (two-stage) for large schemas.
 */
export class SchemaLinker {
  constructor(private db: DbClient) {}

  /** Load full schema for a datasource and format for LLM context */
  async loadSchema(datasourceId: string): Promise<SchemaContext> {
    const tables = await this.db
      .select()
      .from(schemaTables)
      .where(eq(schemaTables.datasourceId, datasourceId));

    const schemaContext: SchemaContext = {
      tables: [],
      relationships: [],
    };

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

      if (fromTable && toTable) {
        const fromCol = await this.db
          .select()
          .from(schemaColumns)
          .where(eq(schemaColumns.id, rel.fromColumnId));
        const toCol = await this.db
          .select()
          .from(schemaColumns)
          .where(eq(schemaColumns.id, rel.toColumnId));

        if (fromCol[0] && toCol[0]) {
          schemaContext.relationships.push({
            fromTable: fromTable.name,
            fromColumn: fromCol[0].name,
            toTable: toTable.name,
            toColumn: toCol[0].name,
          });
        }
      }
    }

    return schemaContext;
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
      if (table.comment) {
        tableComment = `-- ${table.comment}\n`;
      }

      parts.push(`${tableComment}CREATE TABLE ${table.name} (\n${colDefs.join(',\n')}\n);`);
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
