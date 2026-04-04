# NL2SQL V3 Enterprise Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure NL2SQL platform from business-domain-based datasources to engine-type-based datasources with enterprise-grade data warehouse layering (DWD/DWS/DIM/ADS), dual-stage verification loop, LLM-driven chart recommendation, rich SSE streaming, and optimized UI.

**Architecture:** 5-phase refactor — (1) DB schema migration adding engine_type/layer/domain fields, (2) seed data restructured as warehouse-layered tables per engine type with physical PostgreSQL tables, (3) engine pipeline enhanced with scoring-based verification loops and metric fast path, (4) frontend restructured to 2-tab artifact panel with virtual scrolling, (5) full-chain integration.

**Tech Stack:** Drizzle ORM + PostgreSQL + pgvector, Claude Sonnet/Haiku, OpenAI embeddings, Next.js 16 + React 19, @tanstack/react-virtual, ECharts 6, Zustand 5.

---

## Phase Dependency Graph

```
Phase 1 (Data Foundation)
  └── Phase 2 (Seed & Physical Tables)
        ├── Phase 3 (Engine Pipeline) ←── can start Task 8/9 after Phase 1
        └── Phase 4 (Frontend)        ←── can start Task 10/11/12 after Phase 1
              └── Phase 5 (Integration)
```

---

## Phase 1: Data Foundation

### Task 1: DB Schema Migration

**Files:**
- Modify: `packages/db/src/schema/datasources.ts`
- Modify: `packages/db/src/schema/schema-tables.ts`
- Modify: `packages/shared/src/constants/dialects.ts`
- Create: `packages/db/drizzle/0005_engine_type_layer_domain.sql` (auto-generated)

- [ ] **Step 1: Add engine types constant**

```typescript
// packages/shared/src/constants/dialects.ts
export const SQL_DIALECTS = ['mysql', 'postgresql', 'hive', 'sparksql', 'flinksql'] as const;
export type SqlDialect = (typeof SQL_DIALECTS)[number];

// New: engine types for datasource classification
export const ENGINE_TYPES = ['hive', 'iceberg', 'spark', 'mysql', 'doris'] as const;
export type EngineType = (typeof ENGINE_TYPES)[number];

// New: warehouse layer classification
export const WAREHOUSE_LAYERS = ['ods', 'dwd', 'dws', 'dim', 'ads'] as const;
export type WarehouseLayer = (typeof WAREHOUSE_LAYERS)[number];

// New: business domain tags
export const BUSINESS_DOMAINS = ['trade', 'user', 'product', 'risk'] as const;
export type BusinessDomain = (typeof BUSINESS_DOMAINS)[number];
```

- [ ] **Step 2: Add engineType to datasources table**

```typescript
// packages/db/src/schema/datasources.ts
import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const datasources = pgTable('datasources', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  dialect: varchar('dialect', { length: 20 }).notNull(),
  engineType: varchar('engine_type', { length: 20 }).notNull().default('mysql'),
  connectionConfig: jsonb('connection_config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Add layer and domain to schema_tables**

```typescript
// packages/db/src/schema/schema-tables.ts
import { pgTable, uuid, varchar, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { datasources } from './datasources.js';

export const schemaTables = pgTable('schema_tables', {
  id: uuid('id').defaultRandom().primaryKey(),
  datasourceId: uuid('datasource_id')
    .notNull()
    .references(() => datasources.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  comment: text('comment'),
  rowCount: bigint('row_count', { mode: 'number' }),
  ddl: text('ddl'),
  layer: varchar('layer', { length: 10 }),       // 'ods'|'dwd'|'dws'|'dim'|'ads'
  domain: varchar('domain', { length: 50 }),      // 'trade'|'user'|'product'|'risk'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 4: Generate and apply migration**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm db:generate`
Verify: New migration file appears in `packages/db/drizzle/`
Run: `pnpm db:migrate`
Expected: Migration applies cleanly, `datasources.engine_type` defaults to `'mysql'`, `schema_tables.layer`/`domain` nullable.

- [ ] **Step 5: Update shared types**

Modify `packages/shared/src/types/database.ts` — add `engineType: string` to `Datasource` interface, add `layer?: string` and `domain?: string` to `SchemaTable` interface.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/datasources.ts packages/db/src/schema/schema-tables.ts packages/shared/src/constants/dialects.ts packages/shared/src/types/database.ts packages/db/drizzle/
git commit -m "feat: add engine_type to datasources, layer/domain to schema_tables"
```

---

### Task 2: Update API Layer for New Fields

**Files:**
- Modify: `packages/api/src/routes/datasources.ts` — accept `engineType` in create/update
- Modify: `packages/api/src/routes/schema.ts` — accept `layer`/`domain` in table listing, add filter params
- Modify: `packages/shared/src/schemas/datasource.ts` — add `engineType` to Zod schema

- [ ] **Step 1: Update datasource Zod schema**

Add `engineType: z.enum(['hive', 'iceberg', 'spark', 'mysql', 'doris'])` to `createDatasourceSchema` in `packages/shared/src/schemas/datasource.ts`.

- [ ] **Step 2: Update datasource route**

In `packages/api/src/routes/datasources.ts`, pass `engineType` through in POST and PATCH handlers.

- [ ] **Step 3: Update schema table listing route**

In `packages/api/src/routes/schema.ts`, the `GET /api/schema/tables` endpoint should:
- Accept optional `layer` and `domain` query params for filtering
- Return `layer` and `domain` fields in the response

- [ ] **Step 4: Update DDL ingest to accept layer/domain**

In `packages/api/src/routes/schema.ts`, the `POST /api/schema/ingest/ddl` should accept optional `layer` and `domain` fields to attach to ingested tables.

- [ ] **Step 5: Verify**

Run: `pnpm dev:api` — server starts without errors.
Run: `curl -s http://localhost:3100/health | jq .`
Expected: `{ "status": "ok" }`

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/datasources.ts packages/api/src/routes/schema.ts packages/shared/src/schemas/
git commit -m "feat: API accepts engineType, layer, domain fields"
```

---

## Phase 2: Seed Data & Physical Tables

### Task 3: Redesign Seed Architecture (Engine-Type Based)

**Files:**
- Rewrite: `packages/api/src/seed/domains/types.ts` — now `EngineSeedDefinition`
- Delete: `packages/api/src/seed/domains/ecommerce.ts` through `data-governance.ts` (7 old domain files)
- Create: `packages/api/src/seed/engines/hive.ts` — DWD/DWS heavy, offline analytics
- Create: `packages/api/src/seed/engines/mysql.ts` — ODS/DIM heavy, operational store
- Create: `packages/api/src/seed/engines/doris.ts` — ADS/DWS heavy, OLAP real-time
- Create: `packages/api/src/seed/engines/iceberg.ts` — DWD/DWS, lakehouse
- Create: `packages/api/src/seed/engines/spark.ts` — DWS/ADS, compute engine
- Create: `packages/api/src/seed/engines/index.ts` — barrel export
- Rewrite: `packages/api/src/seed/index.ts` — new orchestrator

- [ ] **Step 1: Define new seed types**

```typescript
// packages/api/src/seed/engines/types.ts
export interface ColumnDef {
  name: string;
  dataType: string;
  comment: string;
  isPrimaryKey?: boolean;
  isNullable?: boolean;
  isPii?: boolean;
  sampleValues?: string[];
  referencesTable?: string;
  referencesColumn?: string;
}

export interface TableDef {
  name: string;
  comment: string;
  layer: 'ods' | 'dwd' | 'dws' | 'dim' | 'ads';
  domain: 'trade' | 'user' | 'product' | 'risk';
  columns: ColumnDef[];
}

export interface MetricDef {
  name: string;
  displayName: string;
  expression: string;
  metricType: 'atomic' | 'derived' | 'composite';
  sourceTable: string;
  filters?: Array<{ column: string; op: string; value: string }>;
  dimensions?: string[];
  granularity?: string[];
  format?: 'number' | 'percentage' | 'currency';
  description?: string;
}

export interface GlossaryDef {
  term: string;
  sqlExpression: string;
  description: string;
}

export interface EngineSeedDefinition {
  /** Engine type — maps to datasource.engineType */
  engineType: 'hive' | 'iceberg' | 'spark' | 'mysql' | 'doris';
  /** Display name for the datasource */
  name: string;
  /** Description */
  description: string;
  /** SQL dialect for this engine */
  dialect: string;
  /** PostgreSQL schema name for physical tables */
  pgSchema: string;
  /** Table definitions — grouped by layer */
  tables: TableDef[];
  /** Metric definitions — primarily from ADS tables */
  metrics: MetricDef[];
  /** Glossary entries */
  glossary: GlossaryDef[];
}
```

- [ ] **Step 2: Table naming convention**

All seed tables follow this naming pattern:
```
{layer}_{domain}_{entity}_{freq_or_suffix}
```

Examples:
| Engine | Layer | Example Table | Comment |
|--------|-------|---------------|---------|
| Hive | DWD | `dwd_trade_order_di` | 交易订单明细-日增量 |
| Hive | DWS | `dws_trade_seller_1d` | 商家交易汇总-日粒度 |
| MySQL | DIM | `dim_user_profile` | 用户画像维度表 |
| MySQL | ODS | `ods_trade_order_df` | 订单原始数据-日全量 |
| Doris | ADS | `ads_trade_gmv_dashboard` | GMV 看板指标表 |
| Doris | DWS | `dws_user_retention_7d` | 用户留存汇总-7日 |
| Iceberg | DWD | `dwd_user_behavior_di` | 用户行为明细-日增量 |
| Spark | DWS | `dws_product_funnel_1d` | 商品转化漏斗-日粒度 |

- [ ] **Step 3: Write Hive engine seed**

`packages/api/src/seed/engines/hive.ts` — Export `hiveSeed: EngineSeedDefinition` with:
- engineType: `'hive'`, dialect: `'hive'`, pgSchema: `'dw_hive'`
- ~200 tables: DWD (80) + DWS (60) + DIM (30) + ADS (30)
- 4 domains: trade (60), user (50), product (50), risk (40)
- ~20 metrics from ADS tables
- ~10 glossary entries

Each table must have:
- 5-20 columns with realistic data types (BIGINT, STRING, DECIMAL, TIMESTAMP)
- Chinese comments on every column
- `sampleValues` for categorical columns
- FK references where tables relate

- [ ] **Step 4: Write MySQL engine seed**

`packages/api/src/seed/engines/mysql.ts` — Export `mysqlSeed: EngineSeedDefinition` with:
- engineType: `'mysql'`, dialect: `'mysql'`, pgSchema: `'dw_mysql'`
- ~150 tables: ODS (50) + DIM (60) + DWD (20) + DWS (20)
- MySQL is the operational source — heavy on dimension tables and raw data

- [ ] **Step 5: Write Doris engine seed**

`packages/api/src/seed/engines/doris.ts` — Export `dorisSeed: EngineSeedDefinition` with:
- engineType: `'doris'`, dialect: `'mysql'` (Doris uses MySQL protocol), pgSchema: `'dw_doris'`
- ~180 tables: ADS (70) + DWS (60) + DWD (30) + DIM (20)
- Doris is the OLAP query engine — heavy on pre-aggregated metrics and dashboards

- [ ] **Step 6: Write Iceberg engine seed**

`packages/api/src/seed/engines/iceberg.ts` — Export `icebergSeed: EngineSeedDefinition` with:
- engineType: `'iceberg'`, dialect: `'sparksql'`, pgSchema: `'dw_iceberg'`
- ~180 tables: DWD (80) + DWS (50) + DIM (30) + ADS (20)
- Iceberg is the lakehouse format — heavy on detail-level data with time travel

- [ ] **Step 7: Write Spark engine seed**

`packages/api/src/seed/engines/spark.ts` — Export `sparkSeed: EngineSeedDefinition` with:
- engineType: `'spark'`, dialect: `'sparksql'`, pgSchema: `'dw_spark'`
- ~150 tables: DWS (60) + ADS (40) + DWD (30) + DIM (20)
- Spark is compute-focused — heavy on aggregated/computed results

- [ ] **Step 8: Rewrite seed orchestrator**

```typescript
// packages/api/src/seed/index.ts
import { hiveSeed, mysqlSeed, dorisSeed, icebergSeed, sparkSeed } from './engines/index.js';

const ALL_ENGINES = [hiveSeed, mysqlSeed, dorisSeed, icebergSeed, sparkSeed];

async function seed(db: DbClient) {
  // 1. Create project
  const project = await createProject(db, 'NL2SQL Enterprise Platform');

  // 2. For each engine: create datasource + ingest tables + metrics + glossary
  for (const engine of ALL_ENGINES) {
    const ds = await createDatasource(db, {
      projectId: project.id,
      name: engine.name,
      dialect: engine.dialect,
      engineType: engine.engineType,
      connectionConfig: {
        host: 'localhost',
        port: 5432,
        database: 'nl2sql',
        schema: engine.pgSchema,  // For QueryExecutor to SET search_path
      },
    });

    // Ingest tables with layer/domain metadata
    for (const table of engine.tables) {
      await ingestTable(db, ds.id, table);  // Sets schema_tables.layer & .domain
    }

    // Create metrics linked to ADS tables
    for (const metric of engine.metrics) {
      await createMetric(db, project.id, ds.id, metric);
    }

    // Glossary entries
    for (const entry of engine.glossary) {
      await createGlossaryEntry(db, project.id, entry);
    }
  }

  // 3. Generate embeddings for all columns
  await generateAllEmbeddings(db, project.id);
}
```

- [ ] **Step 9: Commit**

```bash
git add packages/api/src/seed/
git commit -m "feat: restructure seed from business-domain to engine-type based"
```

---

### Task 4: Physical Table DDL + Sample Data

**Files:**
- Create: `packages/api/src/seed/physical-tables.ts` — DDL generator from seed metadata
- Create: `packages/api/src/seed/sample-data.ts` — realistic sample data generator

- [ ] **Step 1: Create PostgreSQL schemas for each engine**

```typescript
// packages/api/src/seed/physical-tables.ts
import type { Pool } from 'pg';
import type { EngineSeedDefinition, TableDef, ColumnDef } from './engines/types.js';

const PG_TYPE_MAP: Record<string, string> = {
  'BIGINT': 'BIGINT',
  'INT': 'INTEGER',
  'INTEGER': 'INTEGER',
  'SMALLINT': 'SMALLINT',
  'STRING': 'TEXT',
  'VARCHAR': 'VARCHAR(255)',
  'TEXT': 'TEXT',
  'DECIMAL': 'NUMERIC(18,2)',
  'DOUBLE': 'DOUBLE PRECISION',
  'FLOAT': 'REAL',
  'BOOLEAN': 'BOOLEAN',
  'DATE': 'DATE',
  'TIMESTAMP': 'TIMESTAMP',
  'DATETIME': 'TIMESTAMP',
  'JSON': 'JSONB',
  'ARRAY<STRING>': 'TEXT[]',
};

export async function createPhysicalTables(pool: Pool, engines: EngineSeedDefinition[]) {
  for (const engine of engines) {
    // Create schema
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${engine.pgSchema}`);

    // Create tables
    for (const table of engine.tables) {
      const ddl = generateDDL(engine.pgSchema, table);
      await pool.query(ddl);
    }
  }
}

function generateDDL(schema: string, table: TableDef): string {
  const cols = table.columns.map((col) => {
    const pgType = PG_TYPE_MAP[col.dataType.toUpperCase()] ?? 'TEXT';
    const nullable = col.isNullable === false ? ' NOT NULL' : '';
    const pk = col.isPrimaryKey ? ' PRIMARY KEY' : '';
    return `  ${col.name} ${pgType}${nullable}${pk}`;
  });

  return `CREATE TABLE IF NOT EXISTS ${schema}.${table.name} (\n${cols.join(',\n')}\n)`;
}
```

- [ ] **Step 2: Sample data generator**

```typescript
// packages/api/src/seed/sample-data.ts
import type { Pool } from 'pg';
import type { EngineSeedDefinition, TableDef } from './engines/types.js';

const ROWS_PER_TABLE = 100;

export async function insertSampleData(pool: Pool, engines: EngineSeedDefinition[]) {
  for (const engine of engines) {
    for (const table of engine.tables) {
      const rows = generateRows(table, ROWS_PER_TABLE);
      if (rows.length === 0) continue;

      const columns = table.columns.map((c) => c.name);
      const placeholders = rows.map(
        (_, ri) =>
          `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(', ')})`
      ).join(', ');

      const values = rows.flatMap((row) => columns.map((col) => row[col]));

      await pool.query(
        `INSERT INTO ${engine.pgSchema}.${table.name} (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      );
    }
  }
}
```

The `generateRows()` function must produce realistic data:
- **Temporal columns**: Distribute across last 90 days (`2026-01-04` to `2026-04-04`)
- **Amount/money columns**: Normal distribution, mean depends on context (order=200, refund=50)
- **Categorical columns**: Use `sampleValues` from column definition
- **ID columns**: Sequential BigInt starting from domain-specific offset
- **User/product IDs**: Shared across tables within same domain for JOIN-ability
- **Status columns**: Weighted distribution (completed: 70%, pending: 20%, cancelled: 10%)

- [ ] **Step 3: Wire into seed orchestrator**

After seeding metadata, call `createPhysicalTables()` then `insertSampleData()` using the same pool.

- [ ] **Step 4: Test seed**

Run: `pnpm db:seed`
Verify: 
```sql
-- Check physical tables exist
SELECT schemaname, tablename FROM pg_tables WHERE schemaname LIKE 'dw_%' ORDER BY 1, 2;
-- Should show ~860 tables across 5 schemas

-- Check sample data
SELECT COUNT(*) FROM dw_hive.dwd_trade_order_di;
-- Should return 100

-- Check cross-table JOIN works
SELECT o.order_id, u.user_name
FROM dw_hive.dwd_trade_order_di o
JOIN dw_mysql.dim_user_profile u ON o.user_id = u.user_id
LIMIT 5;
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/seed/
git commit -m "feat: physical table DDL + sample data for all 5 engine types"
```

---

### Task 5: Metric Table Alignment

**Files:**
- Modify engine seed files: Ensure ADS tables have matching `MetricDef` entries
- The metrics must reference ADS table names as `sourceTable`

- [ ] **Step 1: Define core metrics per engine**

Each engine's ADS tables define pre-computed metrics. Example for Doris:

```typescript
// In packages/api/src/seed/engines/doris.ts — metrics array
const metrics: MetricDef[] = [
  {
    name: 'gmv_total',
    displayName: 'GMV 总额',
    expression: 'SUM(gmv_amount)',
    metricType: 'atomic',
    sourceTable: 'ads_trade_gmv_dashboard',
    dimensions: ['ds', 'channel', 'category_name'],
    granularity: ['day', 'week', 'month'],
    format: 'currency',
    description: '成交总金额(GMV)，包含已付款和待付款订单',
  },
  {
    name: 'dau',
    displayName: '日活跃用户数',
    expression: 'COUNT(DISTINCT user_id)',
    metricType: 'atomic',
    sourceTable: 'ads_user_active_dashboard',
    dimensions: ['ds', 'platform', 'region'],
    granularity: ['day', 'week', 'month'],
    format: 'number',
    description: '日活跃用户数(DAU)，每日去重UV',
  },
  // ... 20+ more metrics covering trade, user, product, risk domains
];
```

- [ ] **Step 2: Ensure ADS tables have metric-queryable structure**

Every ADS table referenced by a metric must have:
- A `ds` (date string) column for time-based queries
- The dimension columns listed in `MetricDef.dimensions`
- The value columns used in `MetricDef.expression`

Example: `ads_trade_gmv_dashboard` must have columns: `ds`, `channel`, `category_name`, `gmv_amount`, `order_count`, `avg_order_value`.

- [ ] **Step 3: Insert pre-computed metric data in physical tables**

The sample data for ADS tables should have pre-aggregated values:
```sql
-- ads_trade_gmv_dashboard sample row
INSERT INTO dw_doris.ads_trade_gmv_dashboard (ds, channel, category_name, gmv_amount, order_count, avg_order_value)
VALUES ('2026-04-01', '直营', '电子产品', 1520000.00, 7600, 200.00);
```

Time series should span 90 days × channel combinations = ~500 rows per ADS metric table.

- [ ] **Step 4: Verify metric → physical table chain**

```sql
-- Metric says: SUM(gmv_amount) FROM ads_trade_gmv_dashboard
SELECT SUM(gmv_amount) FROM dw_doris.ads_trade_gmv_dashboard WHERE ds >= '2026-03-01';
-- Should return a realistic number
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/seed/engines/
git commit -m "feat: align metrics with ADS physical tables, 90-day sample data"
```

---

## Phase 3: Engine Pipeline

### Task 6: Dual-Stage Verification Loop with Scoring

**Files:**
- Rewrite: `packages/engine/src/sql-verifier.ts` → `packages/engine/src/verification-loop.ts`
- Modify: `packages/engine/src/types.ts` — add `VerificationScore`, `VerificationRound`
- Modify: `packages/engine/src/pipeline.ts` — replace single verify with loop
- Modify: `packages/engine/src/config.ts` — add verification config

- [ ] **Step 1: Define verification types**

```typescript
// Add to packages/engine/src/types.ts

export interface VerificationDimension {
  name: string;
  weight: number;
  score: number;
  issues: string[];
}

export interface VerificationScore {
  total: number;
  dimensions: VerificationDimension[];
  passed: boolean;
}

export interface VerificationRound {
  round: number;
  sql: string;
  score: VerificationScore;
  staticIssues: string[];
  semanticIssues: string[];
  suggestedFix?: string;
}
```

- [ ] **Step 2: Add verification config**

```typescript
// Add to packages/engine/src/config.ts
export const VERIFICATION = {
  maxRounds: 3,
  passThreshold: 90,
  dimensions: {
    correctness: 35,    // table/column existence, JOIN validity, type compat
    completeness: 25,   // answers the question, no missing conditions
    efficiency: 15,     // no unnecessary subqueries, proper limits
    safety: 15,         // no DML/DDL, has LIMIT, no cartesian product
    dialect: 10,        // matches target engine SQL dialect
  },
} as const;
```

- [ ] **Step 3: Implement static checker**

```typescript
// packages/engine/src/verification-loop.ts

import type { SchemaContext, VerificationScore, VerificationDimension } from './types.js';
import { SqlValidator } from './sql-validator.js';

/**
 * Stage 1: Static analysis — AST + metadata check (zero LLM cost).
 * Returns issues that can be detected without semantic understanding.
 */
export function staticCheck(
  sql: string,
  schema: SchemaContext,
  dialect: string,
): { issues: string[]; autoScore: Partial<Record<string, number>> } {
  const issues: string[] = [];
  const autoScore: Partial<Record<string, number>> = {};

  const validator = new SqlValidator(dialect);
  const result = validator.validate(sql);

  // Safety: check for DML/DDL
  if (result.statementType && result.statementType !== 'select') {
    issues.push(`Safety: detected ${result.statementType} statement, only SELECT allowed`);
    autoScore.safety = 0;
  }

  // Correctness: check table/column existence
  const schemaTableNames = new Set(schema.tables.map((t) => t.name.toLowerCase()));
  for (const ref of result.tablesReferenced ?? []) {
    if (!schemaTableNames.has(ref.toLowerCase())) {
      issues.push(`Correctness: table "${ref}" not found in schema`);
    }
  }

  // Safety: check for LIMIT
  if (!sql.toLowerCase().includes('limit')) {
    issues.push('Safety: missing LIMIT clause — may return too many rows');
  }

  // Validation errors from AST parser
  for (const err of result.errors ?? []) {
    issues.push(`${err.severity}: ${err.message}`);
  }

  return { issues, autoScore };
}
```

- [ ] **Step 4: Implement LLM semantic checker with scoring**

```typescript
// In packages/engine/src/verification-loop.ts

const SCORING_PROMPT = `You are a SQL verification expert. Score the SQL on 5 dimensions.

## Scoring Dimensions (total 100)
- correctness (35): Tables/columns exist, JOINs correct, types compatible
- completeness (25): Answers the user's question fully, no missing conditions
- efficiency (15): No unnecessary subqueries, proper indexing hints, result size controlled
- safety (15): No DML/DDL, has LIMIT, no cartesian products
- dialect (10): Follows target SQL dialect conventions

## Output JSON
{
  "dimensions": [
    { "name": "correctness", "score": 0-35, "issues": ["..."] },
    { "name": "completeness", "score": 0-25, "issues": ["..."] },
    { "name": "efficiency", "score": 0-15, "issues": ["..."] },
    { "name": "safety", "score": 0-15, "issues": ["..."] },
    { "name": "dialect", "score": 0-10, "issues": ["..."] }
  ],
  "total": 0-100,
  "suggestedFix": "corrected SQL if total < 90, null otherwise"
}`;

export async function semanticCheck(
  client: Anthropic,
  userQuery: string,
  sql: string,
  schemaDesc: string,
  dialect: string,
): Promise<{ score: VerificationScore; suggestedFix?: string }> {
  // LLM call with SCORING_PROMPT
  // Parse response into VerificationScore
  // Return score + optional fix
}
```

- [ ] **Step 5: Implement verification loop orchestrator**

```typescript
// In packages/engine/src/verification-loop.ts

export async function runVerificationLoop(params: {
  client: Anthropic;
  sql: string;
  userQuery: string;
  schema: SchemaContext;
  dialect: string;
  onProgress?: ProgressCallback;
}): Promise<{
  finalSql: string;
  rounds: VerificationRound[];
  finalScore: VerificationScore;
}> {
  const rounds: VerificationRound[] = [];
  let currentSql = params.sql;

  for (let round = 1; round <= VERIFICATION.maxRounds; round++) {
    params.onProgress?.('verification', `验证第 ${round} 轮...`);

    // Stage 1: Static check (0ms cost)
    const { issues: staticIssues, autoScore } = staticCheck(currentSql, params.schema, params.dialect);

    // If static check finds critical issues, skip LLM and regenerate immediately
    if (staticIssues.some((i) => i.startsWith('Correctness: table'))) {
      rounds.push({
        round,
        sql: currentSql,
        score: { total: 0, dimensions: [], passed: false },
        staticIssues,
        semanticIssues: [],
        suggestedFix: undefined,
      });
      // Request regeneration from caller
      break;
    }

    // Stage 2: LLM semantic check (~2s cost)
    const { score, suggestedFix } = await semanticCheck(
      params.client,
      params.userQuery,
      currentSql,
      formatSchemaForVerification(params.schema),
      params.dialect,
    );

    // Apply static check overrides
    for (const [dim, val] of Object.entries(autoScore)) {
      const d = score.dimensions.find((d) => d.name === dim);
      if (d && val !== undefined) d.score = Math.min(d.score, val);
    }
    score.total = score.dimensions.reduce((sum, d) => sum + d.score, 0);
    score.passed = score.total >= VERIFICATION.passThreshold;

    rounds.push({
      round,
      sql: currentSql,
      score,
      staticIssues,
      semanticIssues: score.dimensions.flatMap((d) => d.issues),
      suggestedFix,
    });

    params.onProgress?.('verification', `第 ${round} 轮评分: ${score.total}/100`);

    // Pass threshold → done
    if (score.passed) break;

    // Apply fix for next round
    if (suggestedFix) {
      currentSql = suggestedFix;
    } else {
      break; // No fix suggestion, can't improve
    }
  }

  const lastRound = rounds[rounds.length - 1];
  return {
    finalSql: lastRound?.suggestedFix ?? currentSql,
    rounds,
    finalScore: lastRound?.score ?? { total: 0, dimensions: [], passed: false },
  };
}
```

- [ ] **Step 6: Integrate into pipeline**

In `packages/engine/src/pipeline.ts`, replace the single `SqlVerifier.verify()` call (around line 380-410) with `runVerificationLoop()`. Wire `onProgress` for each round. Return `finalSql` and `confidence = finalScore.total / 100`.

Push verification events via SSE:
```typescript
sendSSE(res, 'verification', {
  round: round.round,
  score: round.score.total,
  passed: round.score.passed,
  issues: round.semanticIssues,
});
```

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/verification-loop.ts packages/engine/src/types.ts packages/engine/src/config.ts packages/engine/src/pipeline.ts
git commit -m "feat: dual-stage verification loop with 5-dimension scoring (pass >= 90)"
```

---

### Task 7: Enhanced Metric Resolution

**Files:**
- Modify: `packages/engine/src/pipeline.ts` — `tryMetricResolution()` rewrite
- Modify: `packages/engine/src/types.ts` — `PipelineResult` gains `metricData` field

- [ ] **Step 1: Add embedding-based metric matching**

Current metric resolution uses word-boundary regex — replace with embedding similarity:

```typescript
// In packages/engine/src/pipeline.ts

private async tryMetricResolution(
  projectId: string,
  datasourceId: string,
  userQuery: string,
  onProgress?: ProgressCallback,
): Promise<PipelineResult | null> {
  onProgress?.('metric_resolution', '匹配业务指标...');

  // 1. Load all metrics for this project
  const metrics = await this.loadMetrics(projectId);
  if (metrics.length === 0) return null;

  // 2. Embedding-based matching (if OpenAI key available)
  let matched: MetricMatch | null = null;
  if (this.embeddingService) {
    const queryEmb = await this.embeddingService.embedSingle(userQuery);
    // Compare against metric name + displayName + description embeddings
    // Find top match with similarity > 0.85
    matched = await this.findBestMetricMatch(queryEmb, metrics);
  } else {
    // Fallback to regex matching (existing logic)
    matched = this.regexMetricMatch(userQuery, metrics);
  }

  if (!matched) return null;

  // 3. Build SQL against the physical ADS table
  const sourceTable = await this.loadSourceTable(matched.metric.sourceTableId);
  if (!sourceTable) return null;

  // Resolve fully-qualified table name: dw_doris.ads_trade_gmv_dashboard
  const datasource = await this.loadDatasource(datasourceId);
  const pgSchema = (datasource?.connectionConfig as any)?.schema;
  const fqTableName = pgSchema ? `${pgSchema}.${sourceTable.name}` : sourceTable.name;

  const sql = this.buildMetricSql(matched.metric, fqTableName, userQuery);

  // 4. Execute directly against physical table
  onProgress?.('metric_resolution', `命中指标「${matched.metric.displayName}」，直接查询...`);

  return {
    resolvedVia: 'metric',
    sql,
    explanation: `命中业务指标「${matched.metric.displayName}」: ${matched.metric.description}`,
    confidence: 0.95,
    tablesUsed: [sourceTable.name],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/engine/src/pipeline.ts packages/engine/src/types.ts
git commit -m "feat: embedding-based metric resolution + direct ADS table query"
```

---

### Task 8: LLM-Driven Chart Recommendation

**Files:**
- Rewrite: `packages/engine/src/chart-recommender.ts` — keep as fallback
- Rewrite: `packages/engine/src/chart-selector.ts` — enhanced LLM chart recommendation
- Create: `packages/engine/src/chart-verifier.ts` — chart config verification loop
- Modify: `packages/engine/src/types.ts` — new `ChartConfig` type

- [ ] **Step 1: Define unified ChartConfig**

```typescript
// Add to packages/engine/src/types.ts

export type ChartType =
  | 'metric_card'
  | 'line'
  | 'bar'
  | 'horizontal_bar'
  | 'pie'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'grouped_bar'
  | 'table';

export interface ChartConfig {
  chartType: ChartType;
  title: string;
  xField?: string;
  yField?: string[];
  categoryField?: string;
  valueField?: string;
  series?: Array<{ name: string; field: string; type?: string }>;
  sort?: 'asc' | 'desc';
  limit?: number;
  stacked?: boolean;
}
```

- [ ] **Step 2: Enhance ChartSelector with result sample**

```typescript
// packages/engine/src/chart-selector.ts

const ENHANCED_CHART_PROMPT = `You are a data visualization expert. Given the user's query, SQL structure, and result data sample, recommend the optimal chart configuration.

## Available Chart Types
- metric_card: Single KPI value (total users, GMV)
- line: Time series trends
- bar: Category comparison (vertical)
- horizontal_bar: Ranking/TOP-N (horizontal)
- pie: Part-of-whole (≤6 categories)
- area: Stacked time trends
- scatter: Correlation between 2 numeric vars
- heatmap: 2D density
- grouped_bar: Multi-metric category comparison
- table: Detail data or fallback

## Decision Logic
1. User asks "趋势/变化/走势" + has time column → line/area
2. User asks "排名/TOP" → horizontal_bar with sort desc + limit
3. User asks "占比/分布" → pie (≤6 cat) or bar
4. User asks "多少/总共" + single number → metric_card
5. Time + multiple metrics → area (stacked) or line (overlaid)
6. 2 numeric cols, no time → scatter
7. 2 categorical + 1 numeric → heatmap

## Output JSON
{
  "chartType": "line",
  "title": "chart title in Chinese",
  "xField": "column_name",
  "yField": ["col1", "col2"],
  "categoryField": null,
  "valueField": null,
  "sort": null,
  "limit": null,
  "stacked": false,
  "reason": "推荐理由"
}`;

export class ChartSelector {
  async select(
    userQuery: string,
    sql: string,
    columns: Array<{ name: string; dataType: string }>,
    sampleRows: Record<string, unknown>[],
  ): Promise<ChartConfig & { reason: string }> {
    // Send all 3 signals: query intent + SQL structure + data sample
    const userContent = `用户查询: "${userQuery}"

SQL:
${sql}

返回列: ${columns.map((c) => `${c.name}(${c.dataType})`).join(', ')}
行数: ${sampleRows.length}
数据样本(前5行):
${JSON.stringify(sampleRows.slice(0, 5), null, 0)}`;

    // LLM call with ENHANCED_CHART_PROMPT
    // Parse and return ChartConfig
  }
}
```

- [ ] **Step 3: Add chart verification (scoring)**

```typescript
// packages/engine/src/chart-verifier.ts

const CHART_SCORING_PROMPT = `Score this chart configuration on 4 dimensions (total 100):
- type_fit (40): Chart type matches data structure and user intent
- field_mapping (30): x/y/category fields correctly mapped to columns
- readability (20): Title, sorting, limit are reasonable
- fallback (10): Correctly falls back to table when unsure

Output JSON: { "total": 0-100, "issues": ["..."], "suggestedFix": {...} or null }`;

export async function verifyChart(
  client: Anthropic,
  chartConfig: ChartConfig,
  userQuery: string,
  columns: Array<{ name: string; dataType: string }>,
): Promise<{ score: number; issues: string[]; suggestedFix?: ChartConfig }> {
  // Single verification round for chart
  // If score < 90, return suggestedFix
}
```

- [ ] **Step 4: Wire into query route**

In `packages/api/src/routes/query.ts`, replace the `ChartRecommender` usage (lines 278-285) with:

```typescript
// After SQL execution succeeds
const { ChartSelector, verifyChart } = await import('@nl2sql/engine');
const selector = new ChartSelector(process.env.ANTHROPIC_API_KEY);

// Run in parallel with SQL execution result streaming
const chartConfig = await selector.select(
  parsed.data.query,
  finalResult.sql,
  execResult.columns,
  execResult.rows.slice(0, 10),
);

// Verify chart config
const verification = await verifyChart(client, chartConfig, parsed.data.query, execResult.columns);
const finalChart = verification.score >= 90 ? chartConfig : (verification.suggestedFix ?? chartConfig);

sendSSE(res, 'chart', { ...finalChart, score: verification.score });
```

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/chart-selector.ts packages/engine/src/chart-verifier.ts packages/engine/src/types.ts packages/api/src/routes/query.ts
git commit -m "feat: LLM-driven chart recommendation with verification scoring"
```

---

### Task 9: Rich SSE Events (Thinking Content)

**Files:**
- Modify: `packages/engine/src/types.ts` — expand `ProgressCallback` to accept `detail` param
- Modify: `packages/engine/src/pipeline.ts` — send thinking content at each step
- Modify: `packages/engine/src/schema-linker.ts` — emit linking details
- Modify: `packages/engine/src/schema-reranker.ts` — emit reranking results
- Modify: `packages/engine/src/verification-loop.ts` — emit verification details
- Modify: `packages/api/src/routes/query.ts` — expand SSE event types

- [ ] **Step 1: Expand callback types**

```typescript
// packages/engine/src/types.ts

/** Progress callback with optional structured detail for thinking content */
export type ProgressCallback = (
  step: string,
  message: string,
  detail?: StepDetail,
) => void;

export interface StepDetail {
  /** Thinking/reasoning content to display */
  thinking?: string;
  /** Structured data from this step */
  data?: unknown;
}
```

- [ ] **Step 2: Emit thinking in pipeline steps**

Example for schema linking:
```typescript
// packages/engine/src/schema-linker.ts — inside linkSchema()

onProgress?.('schema_linking', '匹配数据模型...', {
  thinking: `Embedding search found ${candidateTables.length} candidate tables.\nTop matches:\n${
    candidateTables.slice(0, 5).map((t) => `  - ${t.name} (similarity: ${t.score.toFixed(3)})`).join('\n')
  }`,
});

// After FK expansion:
onProgress?.('schema_linking', `选中 ${finalTables.length} 张表`, {
  thinking: `FK expansion added ${expandedCount} related tables.\nFinal schema: ${finalTables.map((t) => t.name).join(', ')}`,
  data: { tables: finalTables.map((t) => t.name), totalColumns: totalCols },
});
```

Example for verification loop:
```typescript
// After each round
onProgress?.('verification', `第 ${round} 轮评分: ${score.total}/100`, {
  thinking: `Scoring breakdown:\n${
    score.dimensions.map((d) => `  ${d.name}: ${d.score}/${VERIFICATION.dimensions[d.name]} ${d.issues.length ? '⚠ ' + d.issues.join('; ') : '✓'}`).join('\n')
  }${score.passed ? '\n✅ Passed verification' : '\n❌ Below threshold, regenerating...'}`,
});
```

- [ ] **Step 3: Expand SSE event format**

```typescript
// packages/api/src/routes/query.ts — in onProgress callback

onProgress: (step, message, detail) => {
  sendSSE(res, 'status', {
    step,
    message,
    thinking: detail?.thinking,
    data: detail?.data,
  });
},
```

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/pipeline.ts packages/engine/src/schema-linker.ts packages/engine/src/schema-reranker.ts packages/engine/src/verification-loop.ts packages/api/src/routes/query.ts
git commit -m "feat: rich SSE events with thinking content per pipeline step"
```

---

## Phase 4: Frontend

### Task 10: Artifact Panel Restructure (4 → 2 Tabs)

**Files:**
- Rewrite: `packages/web/src/components/panel/artifact-panel.tsx`
- Create: `packages/web/src/components/panel/result-tab.tsx` — unified result view
- Create: `packages/web/src/components/panel/schema-tab.tsx` — schema + ER toggle
- Modify: `packages/web/src/stores/panel-store.ts` — new tab types
- Modify: `packages/web/src/hooks/use-sse-stream.ts` — auto-open result tab

- [ ] **Step 1: Update panel store**

```typescript
// packages/web/src/stores/panel-store.ts

export type ArtifactTab = 'result' | 'schema';  // Was: 'schema' | 'sql' | 'result' | 'chart'

// openArtifact default tab changes to 'result'
openArtifact: (messageId, tab) =>
  set({ selectedMessageId: messageId, isOpen: true, artifactTab: tab ?? 'result' }),
```

- [ ] **Step 2: Create ResultTab component**

```typescript
// packages/web/src/components/panel/result-tab.tsx
// Layout: SQL (collapsible) → Chart → Data Table, all in one scrollable view

export function ResultTab({ message }: { message: ChatMessage }) {
  const [sqlExpanded, setSqlExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full p-4">
      {/* SQL Section — collapsible, shows 2-line preview when collapsed */}
      {message.sql && (
        <section>
          <button onClick={() => setSqlExpanded(!sqlExpanded)} className="...">
            <span>SQL</span>
            <Icon name={sqlExpanded ? 'chevron-up' : 'chevron-down'} />
          </button>
          {sqlExpanded ? (
            <SqlEditor value={message.sql} height={200} onRun={handleRerun} />
          ) : (
            <pre className="text-xs text-muted truncate">{message.sql.slice(0, 120)}...</pre>
          )}
        </section>
      )}

      {/* Chart Section — renders based on LLM recommendation */}
      {message.chartRecommendation && (
        <section className="min-h-[300px]">
          <SmartChart config={message.chartRecommendation} data={message.executionResult} />
        </section>
      )}

      {/* Data Table Section */}
      {message.executionResult && (
        <section>
          <DataTable
            rows={message.executionResult.rows}
            columns={message.executionResult.columns}
          />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create SchemaTab component**

```typescript
// packages/web/src/components/panel/schema-tab.tsx
// Schema Browser + ER Diagram toggle

export function SchemaTab({ filterTables }: { filterTables?: string[] }) {
  const [viewMode, setViewMode] = useState<'tree' | 'er'>('tree');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b">
        <ToggleGroup value={viewMode} onValueChange={setViewMode}>
          <ToggleGroupItem value="tree">树形</ToggleGroupItem>
          <ToggleGroupItem value="er">ER图</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex-1 overflow-hidden">
        {viewMode === 'tree' ? (
          <SchemaBrowser filterTables={filterTables} />
        ) : (
          <ERDiagram filterTables={filterTables} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite ArtifactPanel**

```typescript
// packages/web/src/components/panel/artifact-panel.tsx

export function ArtifactPanel() {
  const { artifactTab, setArtifactTab, selectedMessageId } = usePanelStore();
  const message = useChatStore((s) => s.messages.find((m) => m.id === selectedMessageId));

  return (
    <div className="flex flex-col h-full border-l bg-card">
      {/* Tab bar — only 2 tabs */}
      <div className="flex items-center border-b px-4 h-10">
        <button
          className={cn('tab', artifactTab === 'result' && 'active')}
          onClick={() => setArtifactTab('result')}
        >
          Result
        </button>
        <button
          className={cn('tab', artifactTab === 'schema' && 'active')}
          onClick={() => setArtifactTab('schema')}
        >
          Schema
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {artifactTab === 'result' && message ? (
          <ResultTab message={message} />
        ) : (
          <SchemaTab filterTables={message?.tablesUsed} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update SSE hook**

In `packages/web/src/hooks/use-sse-stream.ts`, change `openArtifact(assistantMessageId, 'sql')` to `openArtifact(assistantMessageId, 'result')` — when results come in, auto-open the Result tab.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/panel/ packages/web/src/stores/panel-store.ts packages/web/src/hooks/use-sse-stream.ts
git commit -m "feat: artifact panel 4→2 tabs (Result + Schema)"
```

---

### Task 11: Schema Browser Virtualization

**Files:**
- Rewrite: `packages/web/src/components/panel/schema-browser.tsx`
- Add dependency: `@tanstack/react-virtual`

- [ ] **Step 1: Install dependency**

Run: `cd packages/web && pnpm add @tanstack/react-virtual`

- [ ] **Step 2: Restructure schema store for layer/domain grouping**

```typescript
// packages/web/src/stores/schema-store.ts — add grouping logic

interface SchemaTable {
  id: string;
  name: string;
  comment: string | null;
  layer?: string;   // NEW
  domain?: string;  // NEW
  columns: SchemaColumn[];
}

// Derived selector for grouped tables
export function useGroupedTables() {
  const tables = useSchemaStore((s) => s.tables);
  return useMemo(() => {
    const groups = new Map<string, SchemaTable[]>();
    for (const t of tables) {
      const key = t.layer?.toUpperCase() ?? 'OTHER';
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    }
    return groups;
  }, [tables]);
}
```

- [ ] **Step 3: Implement virtualized tree with layer grouping**

```typescript
// packages/web/src/components/panel/schema-browser.tsx

import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedSchemaTree({ tables, searchQuery }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['DWD', 'DWS']));
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // Build flat list from grouped structure for virtualization
  const flatItems = useMemo(() => {
    const items: FlatItem[] = [];
    for (const [layer, group] of groupedTables) {
      items.push({ type: 'group', layer, count: group.length });
      if (expandedGroups.has(layer)) {
        for (const table of group) {
          items.push({ type: 'table', table });
          if (expandedTables.has(table.id)) {
            for (const col of table.columns) {
              items.push({ type: 'column', column: col, tableId: table.id });
            }
          }
        }
      }
    }
    return items;
  }, [groupedTables, expandedGroups, expandedTables]);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const item = flatItems[i];
      return item.type === 'group' ? 36 : item.type === 'table' ? 32 : 28;
    },
  });

  return (
    <div ref={parentRef} className="overflow-y-auto h-full">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const item = flatItems[vi.index];
          return (
            <div
              key={vi.key}
              style={{ position: 'absolute', top: vi.start, height: vi.size, width: '100%' }}
            >
              {item.type === 'group' && <GroupHeader {...item} />}
              {item.type === 'table' && <TableRow {...item} />}
              {item.type === 'column' && <ColumnRow {...item} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add fuzzy search**

```typescript
// Debounced search with name + comment matching
const filtered = useMemo(() => {
  if (!searchQuery) return tables;
  const q = searchQuery.toLowerCase();
  return tables.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.comment?.toLowerCase().includes(q) ||
      t.columns.some(
        (c) => c.name.toLowerCase().includes(q) || c.comment?.toLowerCase().includes(q),
      ),
  );
}, [tables, searchQuery]);
```

- [ ] **Step 5: Lazy-load column details**

Schema store initially fetches only table list (name, comment, layer, domain). Column details loaded on demand when a table is expanded:

```typescript
// In schema-store.ts
loadColumns: async (tableId: string) => {
  const existing = get().tables.find((t) => t.id === tableId);
  if (existing?.columns.length) return; // Already loaded

  const res = await apiFetch(`/api/schema/tables/${tableId}`);
  if (res.success) {
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === tableId ? { ...t, columns: res.data.columns } : t,
      ),
    }));
  }
},
```

- [ ] **Step 6: Update API to return layer/domain in table list**

In `packages/api/src/routes/schema.ts`, the `GET /api/schema/tables` endpoint must include `layer` and `domain` in the response.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/panel/schema-browser.tsx packages/web/src/stores/schema-store.ts packages/web/package.json pnpm-lock.yaml packages/api/src/routes/schema.ts
git commit -m "feat: virtualized schema browser with layer grouping and lazy column loading"
```

---

### Task 12: Streaming Indicator Enrichment

**Files:**
- Rewrite: `packages/web/src/components/chat/streaming-indicator.tsx`
- Modify: `packages/web/src/stores/chat-store.ts` — expand `PipelineStepEntry`

- [ ] **Step 1: Expand step entry types**

```typescript
// packages/web/src/stores/chat-store.ts

export interface PipelineStepEntry {
  step: string;
  message: string;
  thinking?: string;    // NEW: reasoning content
  data?: unknown;       // NEW: structured data
  completed?: boolean;  // NEW: step completion flag
}
```

- [ ] **Step 2: Update SSE event handling**

```typescript
// packages/web/src/hooks/use-sse-stream.ts — in handleEvent

case 'status': {
  const entry: PipelineStepEntry = {
    step: data.step as string,
    message: data.message as string,
    thinking: data.thinking as string | undefined,
    data: data.data,
  };
  setPipelineStatus(assistantMessageId, {
    currentStep: entry.step,
    message: entry.message,
    steps: [],
  }, entry);
  break;
}
```

Update `setPipelineStatus` in chat-store to handle thinking content updates — if the same step appears again, update its thinking content rather than appending a new entry.

- [ ] **Step 3: Rewrite StreamingIndicator with collapsible sections**

```typescript
// packages/web/src/components/chat/streaming-indicator.tsx

export function StreamingIndicator({ messageId }: { messageId: string }) {
  const message = useChatStore((s) => s.messages.find((m) => m.id === messageId));
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  if (!message?.isStreaming) return null;
  const steps = message.pipelineStatus?.steps ?? [];
  if (steps.length === 0) return <LoadingDots />;

  return (
    <div className="space-y-1 py-2">
      {steps.map((entry, i) => {
        const isLast = i === steps.length - 1;
        const isExpanded = expandedSteps.has(i) || isLast;
        const hasTh = !!entry.thinking;
        const label = entry.message || STEP_LABELS[entry.step] || entry.step;

        return (
          <div key={`${entry.step}-${i}`}>
            {/* Step header — click to expand/collapse */}
            <button
              className="flex items-center gap-2 w-full text-left"
              onClick={() => hasTh && toggleExpand(i)}
            >
              {isLast ? <PulsingDot /> : <CheckIcon />}
              <span className={`text-sm ${isLast ? 'text-foreground' : 'text-muted'}`}>
                {label}
              </span>
              {hasTh && !isLast && (
                <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} />
              )}
            </button>

            {/* Thinking content — collapsible */}
            {hasTh && isExpanded && (
              <div className="ml-4 mt-1 text-xs text-muted font-mono whitespace-pre-wrap bg-muted/30 rounded p-2">
                {entry.thinking}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/chat/streaming-indicator.tsx packages/web/src/stores/chat-store.ts packages/web/src/hooks/use-sse-stream.ts
git commit -m "feat: streaming indicator with collapsible thinking content per step"
```

---

### Task 13: Smart Chart Renderer

**Files:**
- Create: `packages/web/src/components/panel/smart-chart.tsx` — unified chart renderer
- Create: `packages/web/src/components/panel/metric-card.tsx` — KPI metric card
- Modify: `packages/web/src/components/panel/result-tab.tsx` — use SmartChart

- [ ] **Step 1: Create MetricCard component**

```typescript
// packages/web/src/components/panel/metric-card.tsx

interface MetricCardProps {
  title: string;
  value: string | number;
  format?: 'number' | 'percentage' | 'currency';
  trend?: { direction: 'up' | 'down'; value: string };
}

export function MetricCard({ title, value, format, trend }: MetricCardProps) {
  const formatted = formatValue(value, format);

  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border">
      <span className="text-sm text-muted mb-2">{title}</span>
      <span className="text-4xl font-bold text-foreground">{formatted}</span>
      {trend && (
        <span className={cn('text-sm mt-2', trend.direction === 'up' ? 'text-emerald-500' : 'text-red-500')}>
          {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create SmartChart component**

```typescript
// packages/web/src/components/panel/smart-chart.tsx

import dynamic from 'next/dynamic';
import { MetricCard } from './metric-card';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface SmartChartProps {
  config: ChartConfig;
  data: {
    rows: Record<string, unknown>[];
    columns: Array<{ name: string; dataType: string }>;
  };
}

export function SmartChart({ config, data }: SmartChartProps) {
  if (config.chartType === 'metric_card') {
    return (
      <MetricCard
        title={config.title}
        value={data.rows[0]?.[config.valueField ?? config.yField?.[0] ?? ''] as number}
      />
    );
  }

  if (config.chartType === 'table') {
    return null; // DataTable handles this in ResultTab
  }

  const option = buildEChartsOption(config, data);
  return <ReactECharts option={option} style={{ height: 360 }} opts={{ renderer: 'svg' }} notMerge />;
}

function buildEChartsOption(config: ChartConfig, data: SmartChartProps['data']): EChartsOption {
  const { rows } = data;
  const baseOption = {
    title: { text: config.title, textStyle: { fontSize: 14, color: '#e5e7eb' } },
    tooltip: { trigger: 'axis' as const },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
  };

  switch (config.chartType) {
    case 'line':
    case 'area':
      return {
        ...baseOption,
        xAxis: { type: 'category', data: rows.map((r) => r[config.xField!]) },
        yAxis: { type: 'value' },
        series: (config.yField ?? []).map((f) => ({
          name: f,
          type: 'line',
          data: rows.map((r) => r[f]),
          ...(config.chartType === 'area' ? { areaStyle: {} } : {}),
          ...(config.stacked ? { stack: 'total' } : {}),
        })),
      };

    case 'bar':
    case 'horizontal_bar':
      // ... similar pattern with xAxis/yAxis swapped for horizontal
      
    case 'pie':
      return {
        ...baseOption,
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          data: rows.map((r) => ({
            name: r[config.categoryField!],
            value: r[config.yField?.[0] ?? ''],
          })),
        }],
      };

    case 'scatter':
      return {
        ...baseOption,
        xAxis: { type: 'value', name: config.xField },
        yAxis: { type: 'value', name: config.yField?.[0] },
        series: [{ type: 'scatter', data: rows.map((r) => [r[config.xField!], r[config.yField![0]]]) }],
      };

    case 'heatmap':
      // ... heatmap rendering

    case 'grouped_bar':
      // ... grouped bar rendering

    default:
      return baseOption;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/panel/smart-chart.tsx packages/web/src/components/panel/metric-card.tsx packages/web/src/components/panel/result-tab.tsx
git commit -m "feat: smart chart renderer with metric card and all chart types"
```

---

## Phase 5: Integration & Full-Chain

### Task 14: End-to-End Integration

**Files:**
- Modify: `packages/api/src/routes/query.ts` — wire new verification + chart pipeline
- Modify: `packages/engine/src/pipeline.ts` — use fully-qualified table names
- Modify: `packages/engine/src/query-executor.ts` — support schema-qualified execution

- [ ] **Step 1: Fully-qualified table names in SQL generation**

The SQL generator must produce `dw_hive.dwd_trade_order_di` instead of bare `dwd_trade_order_di`. This is done by:

1. Loading the datasource's `connectionConfig.schema` (e.g., `dw_hive`)
2. Passing it into `GenerationContext` as a new `schemaPrefix` field
3. Instructing the SQL generation prompt to prefix all table references

```typescript
// In packages/engine/src/types.ts — add to GenerationContext
export interface GenerationContext {
  // ... existing fields
  /** PostgreSQL schema prefix for fully-qualified table names */
  schemaPrefix?: string;
}
```

In `SqlGenerator` prompt, add instruction:
```
All table names must be fully qualified with schema prefix "${schemaPrefix}".
Example: SELECT * FROM ${schemaPrefix}.dwd_trade_order_di
```

- [ ] **Step 2: QueryExecutor schema support**

```typescript
// packages/engine/src/query-executor.ts
// Before executing, if connectionConfig.schema exists, SET search_path
async execute(sql: string, config: ExecutionConfig, opts?: ExecutionOptions) {
  const pool = this.getOrCreatePool(config);
  const client = await pool.connect();
  try {
    if (config.schema) {
      await client.query(`SET search_path TO ${config.schema}, public`);
    }
    // ... existing execution logic
  } finally {
    client.release();
  }
}
```

- [ ] **Step 3: Update stream endpoint flow**

The final stream endpoint in `packages/api/src/routes/query.ts` now flows:

```
1. pipeline.run() — with onProgress/onToken for thinking content
2. Verification loop — sends 'verification' SSE events with scores
3. SQL Execution — sends 'execution_result'
4. Chart Recommendation (LLM) — parallel with insight
5. Chart Verification — sends 'chart' with score
6. Data Insight — sends 'insight_token' stream
7. Persist to DB
8. 'done' event
```

- [ ] **Step 4: Fix streamDataInsight bug**

In `packages/api/src/routes/query.ts` line 446, change `sendSSE(res, ...)` to `sendSSE(stream, ...)` — the function parameter is named `stream` but the body uses the closure `res`. Fix:

```typescript
// Line 446: Change res to stream
sendSSE(stream, 'insight_token', { text: delta });
```

- [ ] **Step 5: Full-chain smoke test**

Start both services:
```bash
pnpm dev:api & pnpm dev:web
```

Test queries to verify full chain:
1. **Metric hit**: "GMV 总额是多少" → should resolve via metric, query `dw_doris.ads_trade_gmv_dashboard`, return metric_card chart
2. **Simple query**: "最近7天每天的订单数量" → should generate `SELECT ds, COUNT(*) FROM dw_hive.dwd_trade_order_di WHERE ds >= ... GROUP BY ds`, return line chart
3. **Complex query**: "各渠道本月 GMV 同比增长率 TOP 10" → should go through agent path, return horizontal_bar
4. **Verification test**: Observe SSE events include verification rounds with scores

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: full-chain integration — engine-type datasources, verification loop, smart charts"
```

---

## Summary: File Change Matrix

| Package | Files Created | Files Modified | Files Deleted |
|---------|--------------|----------------|---------------|
| `db` | 1 (migration) | 2 (datasources.ts, schema-tables.ts) | 0 |
| `shared` | 0 | 2 (dialects.ts, database.ts) | 0 |
| `api` | 4 (physical-tables.ts, sample-data.ts, engines/*.ts) | 4 (seed/index.ts, routes/query.ts, routes/schema.ts, routes/datasources.ts) | 7 (old domain files) |
| `engine` | 2 (verification-loop.ts, chart-verifier.ts) | 7 (types.ts, config.ts, pipeline.ts, chart-selector.ts, schema-linker.ts, schema-reranker.ts, query-executor.ts) | 0 |
| `web` | 4 (result-tab.tsx, schema-tab.tsx, smart-chart.tsx, metric-card.tsx) | 5 (panel-store.ts, chat-store.ts, artifact-panel.tsx, schema-browser.tsx, streaming-indicator.tsx, use-sse-stream.ts) | 0 |
| **Total** | **11** | **20** | **7** |

## Execution Order (Dependency-Safe)

```
Task 1  → Task 2  → Task 3 → Task 4 → Task 5    (sequential: data foundation → seed)
                  ↘ Task 10 → Task 11              (parallel: frontend UI after schema change)
                  ↘ Task 12 → Task 13              (parallel: frontend streaming + charts)
           Task 5 → Task 6 → Task 7               (sequential: verification → metric)
                  → Task 8 → Task 9               (sequential: chart → SSE)
                             → Task 14             (final: integration)
```

Tasks 10-13 can start after Task 2 completes (they only need the new types). Tasks 6-9 need Tasks 3-5 complete for testing against real data.
