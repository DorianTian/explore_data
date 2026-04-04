/**
 * V3 Seed orchestrator — seeds 5 engine-type based datasources with
 * DWD/DWS/DIM/ADS layered tables, physical PostgreSQL tables, and sample data.
 *
 * Usage: tsx packages/api/src/seed/index.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

import { eq } from 'drizzle-orm';
import pg from 'pg';
import {
  projects,
  datasources,
  schemaTables,
  schemaColumns,
  schemaRelationships,
  metrics,
  glossaryEntries,
  conversations,
  messages,
  queryHistory,
  knowledgeDocs,
  knowledgeChunks,
  columnEmbeddings,
  widgets,
  dashboards,
  dashboardWidgets,
  favorites,
} from '@nl2sql/db';
import { createDbClient, type DbClient } from '@nl2sql/db';
import { hiveSeed, mysqlSeed, dorisSeed, icebergSeed, sparkSeed } from './engines/index.js';
import type { EngineSeedDefinition } from './engines/types.js';
import { createPhysicalSchemas, createPhysicalTables, insertSampleData } from './physical-tables.js';

const ALL_ENGINES: EngineSeedDefinition[] = [hiveSeed, mysqlSeed, dorisSeed, icebergSeed, sparkSeed];

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const db = createDbClient(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    console.log('=== NL2SQL V3 Enterprise Seed ===\n');

    // 1. Clean existing data
    console.log('[1/6] Cleaning existing data...');
    await cleanAll(db);
    // Also drop physical schemas
    for (const engine of ALL_ENGINES) {
      await pool.query(`DROP SCHEMA IF EXISTS "${engine.pgSchema}" CASCADE`);
    }

    // 2. Create project
    console.log('[2/6] Creating project...');
    const [project] = await db
      .insert(projects)
      .values({ name: 'NL2SQL Enterprise Platform', description: '企业级 NL2SQL 智能查询平台' })
      .returning();
    console.log(`  Project: ${project.id}`);

    // 3. Seed each engine
    console.log('[3/6] Seeding engine datasources and metadata...');
    let totalTables = 0;
    let totalMetrics = 0;
    let totalGlossary = 0;

    for (const engine of ALL_ENGINES) {
      console.log(`  Engine: ${engine.name} (${engine.engineType})...`);

      // Create datasource
      const [ds] = await db
        .insert(datasources)
        .values({
          projectId: project.id,
          name: engine.name,
          dialect: engine.dialect,
          engineType: engine.engineType,
          connectionConfig: {
            host: 'localhost',
            port: 5432,
            database: 'nl2sql',
            username: 'postgres',
            schema: engine.pgSchema,
          },
        })
        .returning();

      // Ingest tables with layer/domain
      const tableIdMap = new Map<string, string>();
      const columnIdMap = new Map<string, string>();

      for (const tableDef of engine.tables) {
        const [table] = await db
          .insert(schemaTables)
          .values({
            datasourceId: ds.id,
            name: tableDef.name,
            comment: tableDef.comment,
            rowCount: 100,
            layer: tableDef.layer,
            domain: tableDef.domain,
          })
          .returning();

        tableIdMap.set(tableDef.name, table.id);

        // Insert columns
        if (tableDef.columns.length > 0) {
          const insertedCols = await db
            .insert(schemaColumns)
            .values(
              tableDef.columns.map((col, idx) => ({
                tableId: table.id,
                name: col.name,
                dataType: col.dataType,
                comment: col.comment,
                isPrimaryKey: col.isPrimaryKey ?? false,
                isNullable: col.isNullable ?? true,
                isPii: col.isPii ?? false,
                sampleValues: col.sampleValues ?? null,
                ordinalPosition: idx + 1,
              })),
            )
            .returning();

          for (const col of insertedCols) {
            columnIdMap.set(`${tableDef.name}.${col.name}`, col.id);
          }
        }

        totalTables++;
      }

      // Insert FK relationships
      for (const tableDef of engine.tables) {
        for (const col of tableDef.columns) {
          if (col.referencesTable && col.referencesColumn) {
            const fromTableId = tableIdMap.get(tableDef.name);
            const fromColId = columnIdMap.get(`${tableDef.name}.${col.name}`);
            const toTableId = tableIdMap.get(col.referencesTable);
            const toColId = columnIdMap.get(`${col.referencesTable}.${col.referencesColumn}`);

            if (fromTableId && fromColId && toTableId && toColId) {
              await db.insert(schemaRelationships).values({
                datasourceId: ds.id,
                fromTableId,
                fromColumnId: fromColId,
                toTableId,
                toColumnId: toColId,
                relationshipType: 'fk',
              });
            }
          }
        }
      }

      // Insert metrics
      for (const metricDef of engine.metrics) {
        const sourceTableId = tableIdMap.get(metricDef.sourceTable) ?? null;
        await db.insert(metrics).values({
          projectId: project.id,
          name: metricDef.name,
          displayName: metricDef.displayName,
          description: metricDef.description ?? null,
          expression: metricDef.expression,
          metricType: metricDef.metricType,
          sourceTableId,
          filters: metricDef.filters ?? null,
          dimensions: metricDef.dimensions ?? null,
          granularity: metricDef.granularity ?? null,
          format: metricDef.format ?? 'number',
        });
        totalMetrics++;
      }

      // Insert glossary
      for (const entry of engine.glossary) {
        await db.insert(glossaryEntries).values({
          projectId: project.id,
          term: entry.term,
          sqlExpression: entry.sqlExpression,
          description: entry.description,
        });
        totalGlossary++;
      }

      console.log(`    ${engine.tables.length} tables, ${engine.metrics.length} metrics, ${engine.glossary.length} glossary`);
    }

    console.log(`  Total: ${totalTables} tables, ${totalMetrics} metrics, ${totalGlossary} glossary\n`);

    // 4. Create physical tables
    console.log('[4/6] Creating physical PostgreSQL schemas and tables...');
    await createPhysicalSchemas(pool, ALL_ENGINES);
    const physicalCount = await createPhysicalTables(pool, ALL_ENGINES);
    console.log(`  Created ${physicalCount} physical tables\n`);

    // 5. Insert sample data
    console.log('[5/6] Inserting sample data (100 rows per table)...');
    const rowCount = await insertSampleData(pool, ALL_ENGINES, 100);
    console.log(`  Inserted ${rowCount} total rows\n`);

    // 6. Generate embeddings (best-effort)
    console.log('[6/6] Generating column embeddings (best-effort)...');
    if (process.env.OPENAI_API_KEY) {
      try {
        const { SchemaLinker } = await import('@nl2sql/engine');
        const dsRows = await db.select().from(datasources).where(eq(datasources.projectId, project.id));
        let embCount = 0;
        for (const dsRow of dsRows) {
          const linker = new SchemaLinker(db, process.env.OPENAI_API_KEY!, process.env.OPENAI_BASE_URL);
          embCount += await linker.generateColumnEmbeddings(dsRow.id);
        }
        console.log(`  Generated ${embCount} embeddings\n`);
      } catch (err: unknown) {
        console.log(`  Embedding generation skipped: ${err instanceof Error ? err.message : String(err)}\n`);
      }
    } else {
      console.log('  OPENAI_API_KEY not set, skipping embeddings\n');
    }

    console.log('=== Seed complete! ===');
  } finally {
    await pool.end();
  }
}

async function cleanAll(db: DbClient) {
  // Delete in reverse dependency order
  await db.delete(dashboardWidgets);
  await db.delete(dashboards);
  await db.delete(favorites);
  await db.delete(widgets);
  await db.delete(columnEmbeddings);
  await db.delete(knowledgeChunks);
  await db.delete(knowledgeDocs);
  await db.delete(glossaryEntries);
  await db.delete(queryHistory);
  await db.delete(messages);
  await db.delete(conversations);
  await db.delete(metrics);
  await db.delete(schemaRelationships);
  await db.delete(schemaColumns);
  await db.delete(schemaTables);
  await db.delete(datasources);
  await db.delete(projects);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
