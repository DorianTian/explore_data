import type { Pool } from 'pg';
import type { EngineSeedDefinition, TableDef, ColumnDef } from './engines/types.js';

/**
 * Map seed data types to PostgreSQL types.
 * All engines' tables are physically created in PostgreSQL for demo execution.
 */
const PG_TYPE_MAP: Record<string, string> = {
  BIGINT: 'BIGINT',
  INT: 'INTEGER',
  INTEGER: 'INTEGER',
  SMALLINT: 'SMALLINT',
  TINYINT: 'SMALLINT',
  STRING: 'TEXT',
  'VARCHAR(255)': 'VARCHAR(255)',
  TEXT: 'TEXT',
  'DECIMAL(18,2)': 'NUMERIC(18,2)',
  DOUBLE: 'DOUBLE PRECISION',
  FLOAT: 'REAL',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  TIMESTAMP: 'TIMESTAMP',
  DATETIME: 'TIMESTAMP',
  JSON: 'JSONB',
  JSONB: 'JSONB',
  ENUM: 'VARCHAR(50)',
  'ARRAY<STRING>': 'TEXT[]',
  'MAP<STRING,STRING>': 'JSONB',
};

function toPgType(seedType: string): string {
  const upper = seedType.toUpperCase();
  return PG_TYPE_MAP[upper] ?? 'TEXT';
}

function generateDDL(pgSchema: string, table: TableDef): string {
  const cols = table.columns.map((col) => {
    const pgType = toPgType(col.dataType);
    const nullable = col.isNullable === false ? ' NOT NULL' : '';
    const pk = col.isPrimaryKey ? ' PRIMARY KEY' : '';
    return `  "${col.name}" ${pgType}${nullable}${pk}`;
  });

  return `CREATE TABLE IF NOT EXISTS "${pgSchema}"."${table.name}" (\n${cols.join(',\n')}\n)`;
}

export async function createPhysicalSchemas(pool: Pool, engines: EngineSeedDefinition[]): Promise<void> {
  for (const engine of engines) {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${engine.pgSchema}"`);
  }
}

export async function createPhysicalTables(pool: Pool, engines: EngineSeedDefinition[]): Promise<number> {
  let count = 0;
  for (const engine of engines) {
    for (const table of engine.tables) {
      const ddl = generateDDL(engine.pgSchema, table);
      try {
        await pool.query(ddl);
        count++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[physical-tables] Failed to create ${engine.pgSchema}.${table.name}: ${msg}\n`);
      }
    }
  }
  return count;
}

/**
 * Generate realistic sample data for a single table.
 * Returns rows as arrays of column values.
 */
function generateRows(table: TableDef, rowCount: number): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, unknown> = {};
    for (const col of table.columns) {
      row[col.name] = generateValue(col, i, rowCount, table.domain);
    }
    rows.push(row);
  }

  return rows;
}

function generateValue(
  col: ColumnDef,
  index: number,
  totalRows: number,
  domain: string,
): unknown {
  const upper = col.dataType.toUpperCase();

  // If has sample values, pick from them
  if (col.sampleValues && col.sampleValues.length > 0) {
    return col.sampleValues[index % col.sampleValues.length];
  }

  // Primary key — sequential
  if (col.isPrimaryKey) {
    return domainIdOffset(domain) + index + 1;
  }

  // FK / ID references
  if (col.name.endsWith('_id') || col.referencesTable) {
    return (index % 50) + 1;
  }

  // Date partition column
  if (col.name === 'ds') {
    return dateOffset(index, totalRows);
  }

  // Temporal columns
  if (['DATETIME', 'TIMESTAMP'].includes(upper)) {
    return timestampOffset(index, totalRows);
  }
  if (upper === 'DATE') {
    return dateOffset(index, totalRows);
  }

  // Numeric columns — generate realistic distributions
  if (['BIGINT', 'INT', 'INTEGER', 'SMALLINT', 'TINYINT'].includes(upper)) {
    if (col.name.includes('count') || col.name.includes('num')) {
      return Math.floor(Math.random() * 500) + 1;
    }
    if (col.name.includes('rank')) {
      return index + 1;
    }
    return Math.floor(Math.random() * 10000) + 1;
  }

  if (['DECIMAL(18,2)', 'DOUBLE', 'FLOAT'].includes(upper)) {
    if (col.name.includes('rate') || col.name.includes('ratio')) {
      return Number((Math.random() * 100).toFixed(2));
    }
    if (col.name.includes('amount') || col.name.includes('price') || col.name.includes('gmv') || col.name.includes('revenue')) {
      return Number((Math.random() * 5000 + 10).toFixed(2));
    }
    if (col.name.includes('score')) {
      return Number((Math.random() * 100).toFixed(2));
    }
    return Number((Math.random() * 1000).toFixed(2));
  }

  if (upper === 'BOOLEAN') {
    return Math.random() > 0.3;
  }

  // Text fallback
  if (col.name.includes('name') || col.name.includes('title')) {
    return `${col.comment?.slice(0, 4) ?? col.name}_${index + 1}`;
  }

  if (col.name.includes('desc') || col.name.includes('remark') || col.name.includes('reason')) {
    return `${col.comment ?? col.name} #${index + 1}`;
  }

  return `val_${index + 1}`;
}

function domainIdOffset(domain: string): number {
  const offsets: Record<string, number> = { trade: 100000, user: 200000, product: 300000, risk: 400000 };
  return offsets[domain] ?? 500000;
}

function dateOffset(index: number, totalRows: number): string {
  const base = new Date('2026-01-04');
  const daySpan = 90;
  const dayOffset = Math.floor((index / totalRows) * daySpan);
  const d = new Date(base.getTime() + dayOffset * 86400000);
  return d.toISOString().slice(0, 10);
}

function timestampOffset(index: number, totalRows: number): string {
  const base = new Date('2026-01-04T00:00:00Z');
  const msSpan = 90 * 86400000;
  const msOffset = Math.floor((index / totalRows) * msSpan);
  const hourJitter = Math.floor(Math.random() * 86400000);
  return new Date(base.getTime() + msOffset + hourJitter).toISOString().replace('T', ' ').slice(0, 19);
}

export async function insertSampleData(
  pool: Pool,
  engines: EngineSeedDefinition[],
  rowsPerTable = 100,
): Promise<number> {
  let totalInserted = 0;

  for (const engine of engines) {
    for (const table of engine.tables) {
      try {
        const rows = generateRows(table, rowsPerTable);
        if (rows.length === 0) continue;

        const columns = table.columns.map((col) => `"${col.name}"`);
        const batchSize = 25;

        for (let batch = 0; batch < rows.length; batch += batchSize) {
          const chunk = rows.slice(batch, batch + batchSize);
          const values: unknown[] = [];
          const placeholders: string[] = [];

          for (let ri = 0; ri < chunk.length; ri++) {
            const row = chunk[ri];
            const rowPlaceholders = columns.map(
              (_, ci) => `$${ri * columns.length + ci + 1}`,
            );
            placeholders.push(`(${rowPlaceholders.join(', ')})`);
            for (const col of table.columns) {
              values.push(row[col.name]);
            }
          }

          await pool.query(
            `INSERT INTO "${engine.pgSchema}"."${table.name}" (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
            values,
          );
        }

        totalInserted += rows.length;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[sample-data] Failed ${engine.pgSchema}.${table.name}: ${msg}\n`);
      }
    }
  }

  return totalInserted;
}
