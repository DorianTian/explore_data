/**
 * Production-only seed expansion: 290 → 2000 tables.
 *
 * Reads existing datasources, generates additional table definitions via
 * combinatorial domain×area×layer expansion, creates physical PostgreSQL
 * tables and inserts sample data (100 rows each).
 *
 * Idempotent: skips tables whose name already exists in the datasource.
 *
 * Usage: DATABASE_URL=<prod_url> npx tsx packages/api/src/seed/seed-expand.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

import pg from 'pg';
import { createDbClient } from '@nl2sql/db';
import { datasources, schemaTables, schemaColumns } from '@nl2sql/db';
import { ENGINE_CONFIGS } from './expand/engine-config.js';
import { generateExpandTables } from './expand/table-registry.js';
import type { TableDef, ColumnDef } from './engines/types.js';

/* ═══════════════════════════════════════════════
 * Physical table helpers (adapted from physical-tables.ts)
 * ═══════════════════════════════════════════════ */

const PG_TYPE_MAP: Record<string, string> = {
  BIGINT: 'BIGINT', INT: 'INTEGER', INTEGER: 'INTEGER', SMALLINT: 'SMALLINT',
  TINYINT: 'SMALLINT', STRING: 'TEXT', 'VARCHAR(255)': 'VARCHAR(255)', TEXT: 'TEXT',
  'DECIMAL(18,2)': 'NUMERIC(18,2)', DOUBLE: 'DOUBLE PRECISION', FLOAT: 'REAL',
  BOOLEAN: 'BOOLEAN', DATE: 'DATE', TIMESTAMP: 'TIMESTAMP', DATETIME: 'TIMESTAMP',
  JSON: 'JSONB', JSONB: 'JSONB', ENUM: 'VARCHAR(50)',
};

function toPgType(seedType: string): string {
  const upper = seedType.toUpperCase();
  if (PG_TYPE_MAP[upper]) return PG_TYPE_MAP[upper];
  const vMatch = upper.match(/^VARCHAR\((\d+)\)$/);
  if (vMatch) return `VARCHAR(${vMatch[1]})`;
  const dMatch = upper.match(/^DECIMAL\((\d+),(\d+)\)$/);
  if (dMatch) return `NUMERIC(${dMatch[1]},${dMatch[2]})`;
  return 'TEXT';
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

/* ═══════════════════════════════════════════════
 * Sample data generation
 * ═══════════════════════════════════════════════ */

function generateValue(col: ColumnDef, index: number, _domain: string): unknown {
  const upper = col.dataType.toUpperCase();

  if (col.sampleValues?.length) return col.sampleValues[index % col.sampleValues.length];
  if (col.isPrimaryKey) return index + 1;
  if (col.name.endsWith('_id') || col.referencesTable) return (index % 50) + 1;

  if (col.name === 'ds' || col.name === 'stat_date') {
    const base = new Date('2026-01-04');
    const d = new Date(base.getTime() + Math.floor((index / 100) * 90) * 86400000);
    return d.toISOString().slice(0, 10);
  }

  if (['DATETIME', 'TIMESTAMP'].includes(upper)) {
    const base = new Date('2026-01-04T00:00:00Z');
    const offset = Math.floor((index / 100) * 90 * 86400000) + Math.floor(Math.random() * 86400000);
    return new Date(base.getTime() + offset).toISOString().replace('T', ' ').slice(0, 19);
  }
  if (upper === 'DATE') {
    const base = new Date('2026-01-04');
    const d = new Date(base.getTime() + Math.floor((index / 100) * 90) * 86400000);
    return d.toISOString().slice(0, 10);
  }

  if (['BIGINT', 'INT', 'INTEGER', 'SMALLINT', 'TINYINT'].includes(upper)) {
    if (col.name.includes('count') || col.name.includes('num') || col.name.includes('qty'))
      return Math.floor(Math.random() * 500) + 1;
    if (col.name.includes('score') || col.name.includes('rating'))
      return Math.floor(Math.random() * 100) + 1;
    if (col.name.includes('position') || col.name.includes('rank'))
      return index + 1;
    return Math.floor(Math.random() * 10000) + 1;
  }

  if (upper.includes('DECIMAL') || upper === 'DOUBLE' || upper === 'FLOAT' || upper === 'DOUBLE PRECISION') {
    if (col.name.includes('rate') || col.name.includes('ratio') || col.name.includes('pct') || col.name.includes('change'))
      return Number((Math.random() * 100).toFixed(2));
    if (col.name.includes('amount') || col.name.includes('price') || col.name.includes('fee') || col.name.includes('revenue'))
      return Number((Math.random() * 5000 + 10).toFixed(2));
    if (col.name.includes('score'))
      return Number((Math.random() * 100).toFixed(2));
    return Number((Math.random() * 1000).toFixed(2));
  }

  if (upper === 'BOOLEAN') return Math.random() > 0.3;

  // Text-based columns — heuristic matching
  if (col.name.includes('phone') || col.name.includes('mobile'))
    return `138${String(10000000 + index).slice(-8)}`;
  if (col.name.includes('email'))
    return `user${index + 1}@example.com`;
  if (col.name.includes('url') || col.name.includes('link') || col.name.includes('logo'))
    return `https://cdn.example.com/${col.name}/${index + 1}.png`;
  if (col.name.includes('ip'))
    return `192.168.${index % 255}.${(index * 7 + 1) % 255}`;
  if (col.name.endsWith('_no') || col.name.endsWith('_code')) {
    const prefix = col.name.replace(/_(no|code)$/, '').toUpperCase().slice(0, 3);
    return `${prefix}${String(index + 1).padStart(12, '0')}`;
  }
  if (col.name.includes('content') || col.name.includes('detail') ||
      col.name.includes('remark') || col.name.includes('description')) {
    const texts = ['商品质量很好', '性价比不错', '物流很快', '包装完整', '客服态度好', '推荐购买', '使用体验一般', '做工精细'];
    return texts[index % texts.length];
  }
  if (col.name.includes('name') || col.name.includes('title'))
    return `${col.comment?.slice(0, 4) ?? col.name}_${index + 1}`;

  // Status/type enums
  if (col.name.includes('status'))
    return ['active', 'inactive', 'pending'][index % 3];
  if (col.name.endsWith('_type'))
    return ['type_a', 'type_b', 'type_c'][index % 3];
  if (col.name.endsWith('_level') || col.name.endsWith('_tier'))
    return ['high', 'medium', 'low'][index % 3];

  // Fallback
  if (col.comment) return `${col.comment.slice(0, 6)}_${index + 1}`;
  return `${col.name}_${index + 1}`;
}

async function insertSampleRows(
  pool: pg.Pool,
  pgSchema: string,
  table: TableDef,
  rowCount: number,
): Promise<number> {
  const columns = table.columns.map((col) => `"${col.name}"`);
  const batchSize = 25;
  let inserted = 0;

  for (let batch = 0; batch < rowCount; batch += batchSize) {
    const chunkSize = Math.min(batchSize, rowCount - batch);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let ri = 0; ri < chunkSize; ri++) {
      const rowPlaceholders = columns.map((_, ci) => `$${ri * columns.length + ci + 1}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      for (const col of table.columns) {
        values.push(generateValue(col, batch + ri, table.domain));
      }
    }

    await pool.query(
      `INSERT INTO "${pgSchema}"."${table.name}" (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values,
    );
    inserted += chunkSize;
  }

  return inserted;
}

/* ═══════════════════════════════════════════════
 * Main
 * ═══════════════════════════════════════════════ */

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const db = createDbClient(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    console.log('=== Seed Expand: 290 → 2000 tables ===\n');

    // 1. Read existing state
    console.log('[1/3] Reading existing datasources and tables...');
    const allDs = await db.select().from(datasources);
    const allTables = await db
      .select({ name: schemaTables.name, datasourceId: schemaTables.datasourceId })
      .from(schemaTables);

    let grandTotalNew = 0;
    let grandTotalRows = 0;

    for (const engineConfig of ENGINE_CONFIGS) {
      // Match datasource by pgSchema stored in connectionConfig
      const ds = allDs.find((d) => {
        const cfg = d.connectionConfig as Record<string, unknown> | null;
        return cfg && (cfg as { schema?: string }).schema === engineConfig.pgSchema;
      });

      if (!ds) {
        console.log(`  SKIP: No datasource for pgSchema="${engineConfig.pgSchema}"`);
        continue;
      }

      const existingNames = new Set(
        allTables.filter((t) => t.datasourceId === ds.id).map((t) => t.name),
      );

      // 2. Generate new tables
      console.log(`\n[${engineConfig.engineType}] ${existingNames.size} existing → target ${engineConfig.targetTotal}`);
      const newTables = generateExpandTables(engineConfig, existingNames.size, existingNames);

      if (newTables.length === 0) {
        console.log(`  Already at target, skipping.`);
        continue;
      }

      console.log(`  Generating ${newTables.length} new tables...`);

      // 3. Insert metadata + create physical tables + sample data
      let tableCount = 0;
      let rowCount = 0;

      for (const tableDef of newTables) {
        try {
          // Metadata: schema_tables
          const [tableRow] = await db.insert(schemaTables).values({
            datasourceId: ds.id,
            name: tableDef.name,
            comment: tableDef.comment,
            rowCount: 100,
            layer: tableDef.layer,
            domain: tableDef.domain,
          }).returning();

          // Metadata: schema_columns
          if (tableDef.columns.length > 0) {
            await db.insert(schemaColumns).values(
              tableDef.columns.map((col, idx) => ({
                tableId: tableRow.id,
                name: col.name,
                dataType: col.dataType,
                comment: col.comment,
                isPrimaryKey: col.isPrimaryKey ?? false,
                isNullable: col.isNullable ?? true,
                isPii: col.isPii ?? false,
                sampleValues: col.sampleValues ?? null,
                ordinalPosition: idx + 1,
              })),
            );
          }

          // Physical table DDL
          const ddl = generateDDL(engineConfig.pgSchema, tableDef);
          await pool.query(ddl);

          // Sample data (100 rows)
          const rows = await insertSampleRows(pool, engineConfig.pgSchema, tableDef, 100);
          rowCount += rows;
          tableCount++;

          if (tableCount % 50 === 0) {
            console.log(`    ... ${tableCount}/${newTables.length} tables done`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(`  FAIL: ${tableDef.name}: ${msg}\n`);
        }
      }

      console.log(`  Done: +${tableCount} tables, +${rowCount} rows`);
      grandTotalNew += tableCount;
      grandTotalRows += rowCount;
    }

    console.log(`\n=== Summary: +${grandTotalNew} new tables, +${grandTotalRows} sample rows ===`);
    console.log('=== Seed expand complete! ===');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed expand failed:', err);
  process.exit(1);
});
