import type { TableDef, ColumnDef } from './domains/types.js';

/**
 * Generate a MySQL-compatible DDL string from a table definition.
 * Uses COMMENT syntax for annotations.
 */
export function generateDdl(table: TableDef): string {
  const columns = table.columns.map((col) => {
    const parts: string[] = [`  ${col.name} ${col.dataType}`];

    if (col.isPrimaryKey) parts.push('PRIMARY KEY');
    if (col.isNullable === false && !col.isPrimaryKey) parts.push('NOT NULL');
    if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
    if (col.referencesTable && col.referencesColumn) {
      parts.push(`REFERENCES ${col.referencesTable}(${col.referencesColumn})`);
    }
    parts.push(`COMMENT '${escapeComment(col.comment)}'`);

    return parts.join(' ');
  });

  return `CREATE TABLE ${table.name} (\n${columns.join(',\n')}\n) COMMENT='${escapeComment(table.comment)}';`;
}

export function generateDomainDdl(tables: TableDef[]): string {
  return tables.map(generateDdl).join('\n\n');
}

function escapeComment(text: string): string {
  return text.replace(/'/g, "''");
}

/** Column definition helpers for concise table definitions */
export const col = {
  id: (comment = 'ID'): ColumnDef => ({
    name: 'id',
    dataType: 'BIGINT',
    comment,
    isPrimaryKey: true,
  }),
  fk: (name: string, refTable: string, comment: string, refColumn = 'id'): ColumnDef => ({
    name,
    dataType: 'BIGINT',
    comment,
    isNullable: false,
    referencesTable: refTable,
    referencesColumn: refColumn,
  }),
  varchar: (
    name: string,
    len: number,
    comment: string,
    opts: Partial<ColumnDef> = {},
  ): ColumnDef => ({
    name,
    dataType: `VARCHAR(${len})`,
    comment,
    ...opts,
  }),
  text: (name: string, comment: string): ColumnDef => ({
    name,
    dataType: 'TEXT',
    comment,
  }),
  int: (name: string, comment: string, opts: Partial<ColumnDef> = {}): ColumnDef => ({
    name,
    dataType: 'INT',
    comment,
    ...opts,
  }),
  bigint: (name: string, comment: string, opts: Partial<ColumnDef> = {}): ColumnDef => ({
    name,
    dataType: 'BIGINT',
    comment,
    ...opts,
  }),
  decimal: (name: string, precision: string, comment: string): ColumnDef => ({
    name,
    dataType: `DECIMAL(${precision})`,
    comment,
  }),
  bool: (name: string, comment: string, defaultVal = 'false'): ColumnDef => ({
    name,
    dataType: 'BOOLEAN',
    comment,
    defaultValue: defaultVal,
  }),
  date: (name: string, comment: string): ColumnDef => ({
    name,
    dataType: 'DATE',
    comment,
  }),
  timestamp: (name: string, comment: string, defaultVal?: string): ColumnDef => ({
    name,
    dataType: 'TIMESTAMP',
    comment,
    defaultValue: defaultVal,
  }),
  json: (name: string, comment: string): ColumnDef => ({
    name,
    dataType: 'JSONB',
    comment,
  }),
  status: (comment: string, values: string): ColumnDef => ({
    name: 'status',
    dataType: 'VARCHAR(30)',
    comment: `${comment}: ${values}`,
  }),
  createdAt: (): ColumnDef => ({
    name: 'created_at',
    dataType: 'TIMESTAMP',
    comment: '创建时间',
    defaultValue: 'CURRENT_TIMESTAMP',
  }),
  updatedAt: (): ColumnDef => ({
    name: 'updated_at',
    dataType: 'TIMESTAMP',
    comment: '更新时间',
    defaultValue: 'CURRENT_TIMESTAMP',
  }),
  ds: (): ColumnDef => ({
    name: 'ds',
    dataType: 'DATE',
    comment: '数据分区日期',
    isNullable: false,
  }),
  etlTime: (): ColumnDef => ({
    name: 'etl_time',
    dataType: 'TIMESTAMP',
    comment: 'ETL 处理时间',
    defaultValue: 'CURRENT_TIMESTAMP',
  }),
};

/**
 * Generate a batch of metric summary tables from a pattern.
 * Used for DWS layer where many tables share similar structures.
 */
export function generateSummaryTable(
  prefix: string,
  entity: string,
  entityComment: string,
  layer: 'dws' | 'ads',
  dimensions: Array<{ name: string; comment: string }>,
  metrics: Array<{ name: string; type: string; comment: string }>,
): TableDef {
  return {
    name: `${prefix}_${entity}`,
    comment: entityComment,
    layer,
    columns: [
      col.id(`${entityComment} ID`),
      col.ds(),
      ...dimensions.map((d) => col.varchar(d.name, 100, d.comment)),
      ...metrics.map((m) =>
        m.type === 'decimal'
          ? col.decimal(m.name, '18,4', m.comment)
          : col.bigint(m.name, m.comment),
      ),
      col.etlTime(),
    ],
  };
}
