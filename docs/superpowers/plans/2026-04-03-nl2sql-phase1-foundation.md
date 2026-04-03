# NL2SQL Platform — Phase 1: Foundation & Schema Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working monorepo with API server that supports project creation, datasource registration, and schema management (manual input + DDL parsing).

**Architecture:** pnpm monorepo with three packages — `shared` (types + validation), `db` (Drizzle ORM + PostgreSQL), `api` (Koa.js server). Schema-first design with Zod schemas driving both runtime validation and TypeScript types. All services use dependency injection via constructor params for testability.

**Tech Stack:** TypeScript 5.x, pnpm workspace, Koa.js, Drizzle ORM, PostgreSQL 17, Zod, Vitest, pino logger

---

## Phase Overview (Full Project)

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **1 (this plan)** | Monorepo + DB + API + Schema CRUD + DDL Parser | Users can register projects, datasources, and upload/parse schemas |
| 2 | Metrics Layer + Knowledge Base + RAG | Users can define metrics and upload knowledge docs |
| 3 | NL2SQL Engine (intent → schema linking → SQL gen) | Natural language → SQL generation pipeline |
| 4 | ANTLR4 SQL Validation + Query Execution Sandbox | Safe SQL validation and sandboxed execution |
| 5 | Conversation Management + Visualization (ECharts) | Multi-turn chat + auto-chart from results |
| 6 | Frontend (Next.js) | Complete web application |

---

## File Structure (Phase 1)

```
nl2sql/
├── package.json                          # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── .env
├── .env.example
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── schemas/
│   │       │   ├── project.ts            # Zod schemas for project
│   │       │   ├── datasource.ts         # Zod schemas for datasource
│   │       │   ├── schema-table.ts       # Zod schemas for table/column
│   │       │   └── index.ts
│   │       ├── types/
│   │       │   ├── database.ts           # DB entity types (inferred from Zod)
│   │       │   ├── api.ts                # API request/response types
│   │       │   └── index.ts
│   │       ├── constants/
│   │       │   └── dialects.ts           # Supported SQL dialects
│   │       └── index.ts
│   ├── db/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── schema/
│   │       │   ├── projects.ts
│   │       │   ├── datasources.ts
│   │       │   ├── schema-tables.ts
│   │       │   ├── schema-columns.ts
│   │       │   ├── schema-relationships.ts
│   │       │   └── index.ts
│   │       ├── client.ts
│   │       └── index.ts
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── middleware/
│           │   ├── error-handler.ts
│           │   ├── request-logger.ts
│           │   └── index.ts
│           ├── routes/
│           │   ├── health.ts
│           │   ├── projects.ts
│           │   ├── datasources.ts
│           │   ├── schema.ts
│           │   └── index.ts
│           ├── services/
│           │   ├── project-service.ts
│           │   ├── datasource-service.ts
│           │   ├── schema-service.ts
│           │   ├── ddl-parser.ts
│           │   └── index.ts
│           ├── tests/
│           │   ├── setup.ts
│           │   ├── helpers.ts
│           │   ├── services/
│           │   │   ├── project-service.test.ts
│           │   │   ├── datasource-service.test.ts
│           │   │   ├── schema-service.test.ts
│           │   │   └── ddl-parser.test.ts
│           │   └── routes/
│           │       ├── health.test.ts
│           │       ├── projects.test.ts
│           │       ├── datasources.test.ts
│           │       └── schema.test.ts
│           ├── app.ts
│           └── server.ts
```

---

## Task 1: Monorepo Bootstrap

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`
- Create: `packages/api/package.json`, `packages/api/tsconfig.json`

- [ ] **Step 1: Initialize git and create workspace root configs**

```bash
cd ~/Desktop/workspace/projects/nl2sql
git init
```

`package.json`:
```json
{
  "name": "nl2sql",
  "private": true,
  "scripts": {
    "dev:api": "pnpm --filter @nl2sql/api dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "format": "prettier --write \"packages/*/src/**/*.ts\"",
    "format:check": "prettier --check \"packages/*/src/**/*.ts\"",
    "db:generate": "pnpm --filter @nl2sql/db generate",
    "db:migrate": "pnpm --filter @nl2sql/db migrate"
  },
  "devDependencies": {
    "prettier": "^3.5.0",
    "typescript": "^5.8.0"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2024"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.env
*.log
.DS_Store
drizzle/
```

`.env.example`:
```
DATABASE_URL=postgresql://tianqiyin:@localhost:5432/nl2sql
API_PORT=3100
LOG_LEVEL=info
```

- [ ] **Step 2: Create shared package skeleton**

`packages/shared/package.json`:
```json
{
  "name": "@nl2sql/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/shared/src/index.ts`:
```typescript
export * from './schemas/index.js';
export * from './types/index.js';
export * from './constants/dialects.js';
```

- [ ] **Step 3: Create db package skeleton**

`packages/db/package.json`:
```json
{
  "name": "@nl2sql/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0",
    "pg": "^8.16.0",
    "@nl2sql/shared": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.0",
    "@types/pg": "^8.11.0",
    "typescript": "^5.8.0"
  }
}
```

`packages/db/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create api package skeleton**

`packages/api/package.json`:
```json
{
  "name": "@nl2sql/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "koa": "^2.16.0",
    "@koa/router": "^13.1.0",
    "@koa/cors": "^5.0.0",
    "koa-bodyparser": "^4.4.0",
    "pino": "^9.6.0",
    "zod": "^3.24.0",
    "@nl2sql/shared": "workspace:*",
    "@nl2sql/db": "workspace:*"
  },
  "devDependencies": {
    "@types/koa": "^2.15.0",
    "@types/koa__router": "^12.0.0",
    "@types/koa__cors": "^5.0.0",
    "@types/koa-bodyparser": "^4.3.0",
    "tsx": "^4.19.0",
    "vitest": "^3.1.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0",
    "typescript": "^5.8.0"
  }
}
```

`packages/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Install dependencies and verify**

```bash
cd ~/Desktop/workspace/projects/nl2sql
cp .env.example .env
pnpm install
pnpm --filter @nl2sql/shared build
```

Expected: install succeeds, shared builds with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: bootstrap pnpm monorepo with shared, db, api packages"
```

---

## Task 2: Shared Types & Validation Schemas

**Files:**
- Create: `packages/shared/src/constants/dialects.ts`
- Create: `packages/shared/src/schemas/project.ts`
- Create: `packages/shared/src/schemas/datasource.ts`
- Create: `packages/shared/src/schemas/schema-table.ts`
- Create: `packages/shared/src/schemas/index.ts`
- Create: `packages/shared/src/types/database.ts`
- Create: `packages/shared/src/types/api.ts`
- Create: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Define SQL dialect constants**

`packages/shared/src/constants/dialects.ts`:
```typescript
export const SQL_DIALECTS = [
  'mysql',
  'postgresql',
  'hive',
  'sparksql',
  'flinksql',
] as const;

export type SqlDialect = (typeof SQL_DIALECTS)[number];
```

- [ ] **Step 2: Define Zod schemas for all entities**

`packages/shared/src/schemas/project.ts`:
```typescript
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const projectIdSchema = z.object({
  id: z.string().uuid(),
});
```

`packages/shared/src/schemas/datasource.ts`:
```typescript
import { z } from 'zod';
import { SQL_DIALECTS } from '../constants/dialects.js';

export const connectionConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().optional(),
  ssl: z.boolean().default(false),
});

export const createDatasourceSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  dialect: z.enum(SQL_DIALECTS),
  connectionConfig: connectionConfigSchema.optional(),
});

export const updateDatasourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  connectionConfig: connectionConfigSchema.optional(),
});

export const datasourceIdSchema = z.object({
  id: z.string().uuid(),
});
```

`packages/shared/src/schemas/schema-table.ts`:
```typescript
import { z } from 'zod';

export const columnDefinitionSchema = z.object({
  name: z.string().min(1).max(200),
  dataType: z.string().min(1).max(50),
  comment: z.string().max(500).optional(),
  sampleValues: z.array(z.string()).max(10).optional(),
  isPrimaryKey: z.boolean().default(false),
  isNullable: z.boolean().default(true),
  isPii: z.boolean().default(false),
});

export const createSchemaTableSchema = z.object({
  datasourceId: z.string().uuid(),
  name: z.string().min(1).max(200),
  comment: z.string().max(500).optional(),
  ddl: z.string().optional(),
  columns: z.array(columnDefinitionSchema).min(1),
});

export const createSchemaTableFromDdlSchema = z.object({
  datasourceId: z.string().uuid(),
  ddl: z.string().min(1),
});

export const updateSchemaTableSchema = z.object({
  comment: z.string().max(500).optional(),
});

export const updateColumnSchema = z.object({
  comment: z.string().max(500).optional(),
  sampleValues: z.array(z.string()).max(10).optional(),
  isPii: z.boolean().optional(),
});

export const createRelationshipSchema = z.object({
  datasourceId: z.string().uuid(),
  fromTableId: z.string().uuid(),
  fromColumnId: z.string().uuid(),
  toTableId: z.string().uuid(),
  toColumnId: z.string().uuid(),
  relationshipType: z.enum(['fk', 'implicit']),
});
```

`packages/shared/src/schemas/index.ts`:
```typescript
export * from './project.js';
export * from './datasource.js';
export * from './schema-table.js';
```

- [ ] **Step 3: Define TypeScript types derived from Zod schemas**

`packages/shared/src/types/database.ts`:
```typescript
import type { z } from 'zod';
import type {
  createProjectSchema,
  createDatasourceSchema,
  connectionConfigSchema,
  createSchemaTableSchema,
  columnDefinitionSchema,
  createRelationshipSchema,
} from '../schemas/index.js';

/** Project */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/** Datasource */
export interface Datasource {
  id: string;
  projectId: string;
  name: string;
  dialect: string;
  connectionConfig: z.infer<typeof connectionConfigSchema> | null;
  createdAt: Date;
}

export type CreateDatasourceInput = z.infer<typeof createDatasourceSchema>;

/** Schema Table */
export interface SchemaTable {
  id: string;
  datasourceId: string;
  name: string;
  comment: string | null;
  rowCount: number | null;
  ddl: string | null;
  createdAt: Date;
}

/** Schema Column */
export interface SchemaColumn {
  id: string;
  tableId: string;
  name: string;
  dataType: string;
  comment: string | null;
  sampleValues: string[] | null;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isPii: boolean;
  ordinalPosition: number;
}

export type ColumnDefinition = z.infer<typeof columnDefinitionSchema>;
export type CreateSchemaTableInput = z.infer<typeof createSchemaTableSchema>;

/** Schema Relationship */
export interface SchemaRelationship {
  id: string;
  datasourceId: string;
  fromTableId: string;
  fromColumnId: string;
  toTableId: string;
  toColumnId: string;
  relationshipType: 'fk' | 'implicit';
}

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
```

`packages/shared/src/types/api.ts`:
```typescript
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** DDL Parse Result */
export interface DdlParseResult {
  tableName: string;
  comment: string | null;
  columns: Array<{
    name: string;
    dataType: string;
    comment: string | null;
    isPrimaryKey: boolean;
    isNullable: boolean;
  }>;
  foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
}
```

`packages/shared/src/types/index.ts`:
```typescript
export * from './database.js';
export * from './api.js';
```

- [ ] **Step 4: Build shared package and verify**

```bash
cd ~/Desktop/workspace/projects/nl2sql
pnpm --filter @nl2sql/shared build
```

Expected: builds with no errors, `packages/shared/dist/` contains compiled JS + declaration files.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add Zod schemas and TypeScript types for project, datasource, schema entities"
```

---

## Task 3: Database Schema & Client

**Files:**
- Create: `packages/db/src/schema/projects.ts`
- Create: `packages/db/src/schema/datasources.ts`
- Create: `packages/db/src/schema/schema-tables.ts`
- Create: `packages/db/src/schema/schema-columns.ts`
- Create: `packages/db/src/schema/schema-relationships.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/drizzle.config.ts`

- [ ] **Step 1: Create the PostgreSQL database**

```bash
createdb nl2sql
psql -d nl2sql -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Expected: database `nl2sql` created, pgvector extension enabled.

- [ ] **Step 2: Define Drizzle schema — projects + datasources**

`packages/db/src/schema/projects.ts`:
```typescript
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

`packages/db/src/schema/datasources.ts`:
```typescript
import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const datasources = pgTable('datasources', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  dialect: varchar('dialect', { length: 20 }).notNull(),
  connectionConfig: jsonb('connection_config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Define Drizzle schema — schema tables, columns, relationships**

`packages/db/src/schema/schema-tables.ts`:
```typescript
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

`packages/db/src/schema/schema-columns.ts`:
```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { schemaTables } from './schema-tables.js';

export const schemaColumns = pgTable('schema_columns', {
  id: uuid('id').defaultRandom().primaryKey(),
  tableId: uuid('table_id')
    .notNull()
    .references(() => schemaTables.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  dataType: varchar('data_type', { length: 50 }).notNull(),
  comment: text('comment'),
  sampleValues: text('sample_values').array(),
  isPrimaryKey: boolean('is_primary_key').default(false).notNull(),
  isNullable: boolean('is_nullable').default(true).notNull(),
  isPii: boolean('is_pii').default(false).notNull(),
  ordinalPosition: integer('ordinal_position').notNull(),
});
```

`packages/db/src/schema/schema-relationships.ts`:
```typescript
import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { datasources } from './datasources.js';
import { schemaTables } from './schema-tables.js';
import { schemaColumns } from './schema-columns.js';

export const schemaRelationships = pgTable('schema_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  datasourceId: uuid('datasource_id')
    .notNull()
    .references(() => datasources.id, { onDelete: 'cascade' }),
  fromTableId: uuid('from_table_id')
    .notNull()
    .references(() => schemaTables.id),
  fromColumnId: uuid('from_column_id')
    .notNull()
    .references(() => schemaColumns.id),
  toTableId: uuid('to_table_id')
    .notNull()
    .references(() => schemaTables.id),
  toColumnId: uuid('to_column_id')
    .notNull()
    .references(() => schemaColumns.id),
  relationshipType: varchar('relationship_type', { length: 20 }).notNull(),
});
```

`packages/db/src/schema/index.ts`:
```typescript
export { projects } from './projects.js';
export { datasources } from './datasources.js';
export { schemaTables } from './schema-tables.js';
export { schemaColumns } from './schema-columns.js';
export { schemaRelationships } from './schema-relationships.js';
```

- [ ] **Step 4: Create database client and exports**

`packages/db/src/client.ts`:
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export function createDbClient(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  return drizzle(pool, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
```

`packages/db/src/index.ts`:
```typescript
export { createDbClient, type DbClient } from './client.js';
export * from './schema/index.js';
```

`packages/db/drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://tianqiyin:@localhost:5432/nl2sql',
  },
});
```

- [ ] **Step 5: Generate and run migration**

```bash
cd ~/Desktop/workspace/projects/nl2sql
pnpm --filter @nl2sql/shared build
pnpm --filter @nl2sql/db generate
DATABASE_URL="postgresql://tianqiyin:@localhost:5432/nl2sql" pnpm --filter @nl2sql/db migrate
```

Expected: migration files generated in `packages/db/drizzle/`, tables created in PostgreSQL.

Verify:
```bash
psql -d nl2sql -c "\dt"
```

Expected: tables `projects`, `datasources`, `schema_tables`, `schema_columns`, `schema_relationships` exist.

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add Drizzle schema for projects, datasources, schema tables/columns/relationships"
```

---

## Task 4: API Server Skeleton

**Files:**
- Create: `packages/api/src/middleware/error-handler.ts`
- Create: `packages/api/src/middleware/request-logger.ts`
- Create: `packages/api/src/middleware/index.ts`
- Create: `packages/api/src/routes/health.ts`
- Create: `packages/api/src/app.ts`
- Create: `packages/api/src/server.ts`
- Test: `packages/api/src/tests/setup.ts`, `packages/api/src/tests/helpers.ts`
- Test: `packages/api/src/tests/routes/health.test.ts`

- [ ] **Step 1: Write the failing health check test**

`packages/api/src/tests/setup.ts`:
```typescript
import { beforeAll, afterAll } from 'vitest';
import { createDbClient, type DbClient } from '@nl2sql/db';

let db: DbClient;

export function getTestDb(): DbClient {
  return db;
}

beforeAll(() => {
  const url = process.env.DATABASE_URL ?? 'postgresql://tianqiyin:@localhost:5432/nl2sql';
  db = createDbClient(url);
});

afterAll(async () => {
  // Pool cleanup handled by process exit in tests
});
```

`packages/api/src/tests/helpers.ts`:
```typescript
import supertest from 'supertest';
import { createApp } from '../app.js';
import { getTestDb } from './setup.js';

export function createTestAgent() {
  const db = getTestDb();
  const app = createApp(db);
  return supertest(app.callback());
}
```

`packages/api/src/tests/routes/health.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createTestAgent } from '../helpers.js';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const agent = createTestAgent();
    const res = await agent.get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Desktop/workspace/projects/nl2sql
pnpm --filter @nl2sql/api test -- --run src/tests/routes/health.test.ts
```

Expected: FAIL — `createApp` does not exist.

- [ ] **Step 3: Implement middleware + app + server**

`packages/api/src/middleware/error-handler.ts`:
```typescript
import type Koa from 'koa';
import type { Logger } from 'pino';

export function errorHandler(logger: Logger): Koa.Middleware {
  return async (ctx, next) => {
    try {
      await next();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));

      if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
        ctx.status = (error as { status: number }).status;
      } else {
        ctx.status = 500;
      }

      logger.error({ err: error, path: ctx.path, method: ctx.method }, 'request error');

      ctx.body = {
        success: false,
        error: {
          code: ctx.status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
          message: ctx.status === 500 ? 'Internal server error' : error.message,
        },
      };
    }
  };
}
```

`packages/api/src/middleware/request-logger.ts`:
```typescript
import type Koa from 'koa';
import type { Logger } from 'pino';

export function requestLogger(logger: Logger): Koa.Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;

    logger.info(
      { method: ctx.method, path: ctx.path, status: ctx.status, ms },
      'request completed',
    );
  };
}
```

`packages/api/src/middleware/index.ts`:
```typescript
export { errorHandler } from './error-handler.js';
export { requestLogger } from './request-logger.js';
```

`packages/api/src/routes/health.ts`:
```typescript
import Router from '@koa/router';

export function createHealthRouter(): Router {
  const router = new Router();

  router.get('/health', (ctx) => {
    ctx.body = { status: 'ok' };
  });

  return router;
}
```

`packages/api/src/app.ts`:
```typescript
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import pino from 'pino';
import type { DbClient } from '@nl2sql/db';
import { errorHandler, requestLogger } from './middleware/index.js';
import { createHealthRouter } from './routes/health.js';

export function createApp(db: DbClient) {
  const app = new Koa();
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

  app.context.db = db;
  app.context.logger = logger;

  app.use(errorHandler(logger));
  app.use(requestLogger(logger));
  app.use(cors());
  app.use(bodyParser());

  const healthRouter = createHealthRouter();
  app.use(healthRouter.routes());
  app.use(healthRouter.allowedMethods());

  return app;
}
```

`packages/api/src/server.ts`:
```typescript
import { createDbClient } from '@nl2sql/db';
import { createApp } from './app.js';

const port = Number(process.env.API_PORT) || 3100;
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://tianqiyin:@localhost:5432/nl2sql';

const db = createDbClient(databaseUrl);
const app = createApp(db);

app.listen(port, () => {
  app.context.logger.info({ port }, 'NL2SQL API server started');
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Desktop/workspace/projects/nl2sql
pnpm --filter @nl2sql/api test -- --run src/tests/routes/health.test.ts
```

Expected: PASS.

- [ ] **Step 5: Verify dev server starts**

```bash
cd ~/Desktop/workspace/projects/nl2sql
pnpm dev:api &
sleep 2
curl -s http://localhost:3100/health | jq .
kill %1
```

Expected: `{ "status": "ok" }`

- [ ] **Step 6: Commit**

```bash
git add packages/api/
git commit -m "feat(api): add Koa server skeleton with health check, error handler, request logger"
```

---

## Task 5: Project CRUD

**Files:**
- Create: `packages/api/src/services/project-service.ts`
- Create: `packages/api/src/routes/projects.ts`
- Modify: `packages/api/src/app.ts` (register routes)
- Test: `packages/api/src/tests/services/project-service.test.ts`
- Test: `packages/api/src/tests/routes/projects.test.ts`

- [ ] **Step 1: Write failing service tests**

`packages/api/src/tests/services/project-service.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectService } from '../../services/project-service.js';
import { getTestDb } from '../setup.js';
import { projects } from '@nl2sql/db';

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(projects);
    service = new ProjectService(db);
  });

  it('creates a project', async () => {
    const result = await service.create({ name: 'Test Project', description: 'A test' });

    expect(result.name).toBe('Test Project');
    expect(result.description).toBe('A test');
    expect(result.id).toBeDefined();
  });

  it('lists projects', async () => {
    await service.create({ name: 'P1' });
    await service.create({ name: 'P2' });

    const result = await service.list();
    expect(result).toHaveLength(2);
  });

  it('gets a project by id', async () => {
    const created = await service.create({ name: 'Findable' });
    const found = await service.getById(created.id);

    expect(found).not.toBeNull();
    expect(found!.name).toBe('Findable');
  });

  it('returns null for non-existent project', async () => {
    const found = await service.getById('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('updates a project', async () => {
    const created = await service.create({ name: 'Old Name' });
    const updated = await service.update(created.id, { name: 'New Name' });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New Name');
  });

  it('deletes a project', async () => {
    const created = await service.create({ name: 'To Delete' });
    const deleted = await service.remove(created.id);

    expect(deleted).toBe(true);

    const found = await service.getById(created.id);
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @nl2sql/api test -- --run src/tests/services/project-service.test.ts
```

Expected: FAIL — `ProjectService` does not exist.

- [ ] **Step 3: Implement ProjectService**

`packages/api/src/services/project-service.ts`:
```typescript
import { eq } from 'drizzle-orm';
import { projects, type DbClient } from '@nl2sql/db';
import type { CreateProjectInput } from '@nl2sql/shared';

export class ProjectService {
  constructor(private db: DbClient) {}

  async create(input: CreateProjectInput) {
    const [row] = await this.db
      .insert(projects)
      .values({ name: input.name, description: input.description ?? null })
      .returning();
    return row;
  }

  async list() {
    return this.db.select().from(projects).orderBy(projects.createdAt);
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(projects).where(eq(projects.id, id));
    return row ?? null;
  }

  async update(id: string, input: Partial<CreateProjectInput>) {
    const [row] = await this.db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return row ?? null;
  }

  async remove(id: string): Promise<boolean> {
    const [row] = await this.db.delete(projects).where(eq(projects.id, id)).returning();
    return row !== undefined;
  }
}
```

- [ ] **Step 4: Run service tests to verify they pass**

```bash
pnpm --filter @nl2sql/api test -- --run src/tests/services/project-service.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Write failing route tests**

`packages/api/src/tests/routes/projects.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAgent } from '../helpers.js';
import { getTestDb } from '../setup.js';
import { projects } from '@nl2sql/db';

describe('Projects API', () => {
  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(projects);
  });

  describe('POST /api/projects', () => {
    it('creates a project', async () => {
      const agent = createTestAgent();
      const res = await agent
        .post('/api/projects')
        .send({ name: 'My Project', description: 'Test' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('My Project');
    });

    it('rejects empty name', async () => {
      const agent = createTestAgent();
      const res = await agent.post('/api/projects').send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/projects', () => {
    it('lists all projects', async () => {
      const agent = createTestAgent();
      await agent.post('/api/projects').send({ name: 'P1' });
      await agent.post('/api/projects').send({ name: 'P2' });

      const res = await agent.get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns a project by id', async () => {
      const agent = createTestAgent();
      const created = await agent.post('/api/projects').send({ name: 'Find Me' });

      const res = await agent.get(`/api/projects/${created.body.data.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Find Me');
    });

    it('returns 404 for non-existent project', async () => {
      const agent = createTestAgent();
      const res = await agent.get('/api/projects/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('updates a project', async () => {
      const agent = createTestAgent();
      const created = await agent.post('/api/projects').send({ name: 'Old' });

      const res = await agent
        .patch(`/api/projects/${created.body.data.id}`)
        .send({ name: 'New' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('deletes a project', async () => {
      const agent = createTestAgent();
      const created = await agent.post('/api/projects').send({ name: 'Bye' });

      const res = await agent.delete(`/api/projects/${created.body.data.id}`);
      expect(res.status).toBe(204);
    });
  });
});
```

- [ ] **Step 6: Implement project routes and register in app**

`packages/api/src/routes/projects.ts`:
```typescript
import Router from '@koa/router';
import { createProjectSchema, updateProjectSchema, projectIdSchema } from '@nl2sql/shared';
import { ProjectService } from '../services/project-service.js';
import type { DbClient } from '@nl2sql/db';

export function createProjectRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/projects' });
  const service = new ProjectService(db);

  router.post('/', async (ctx) => {
    const parsed = createProjectSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }

    const project = await service.create(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: project };
  });

  router.get('/', async (ctx) => {
    const list = await service.list();
    ctx.body = { success: true, data: list };
  });

  router.get('/:id', async (ctx) => {
    const { id } = ctx.params;
    const parsed = projectIdSchema.safeParse({ id });
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid UUID' } };
      return;
    }

    const project = await service.getById(id);
    if (!project) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } };
      return;
    }
    ctx.body = { success: true, data: project };
  });

  router.patch('/:id', async (ctx) => {
    const parsed = updateProjectSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }

    const updated = await service.update(ctx.params.id, parsed.data);
    if (!updated) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } };
      return;
    }
    ctx.body = { success: true, data: updated };
  });

  router.delete('/:id', async (ctx) => {
    const deleted = await service.remove(ctx.params.id);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } };
      return;
    }
    ctx.status = 204;
  });

  return router;
}
```

Update `packages/api/src/app.ts` — add after health router registration:

```typescript
// Add import at top
import { createProjectRouter } from './routes/projects.js';

// Add after healthRouter.allowedMethods()
const projectRouter = createProjectRouter(db);
app.use(projectRouter.routes());
app.use(projectRouter.allowedMethods());
```

- [ ] **Step 7: Run all tests to verify they pass**

```bash
pnpm --filter @nl2sql/api test -- --run
```

Expected: all tests PASS (health + project service + project routes).

- [ ] **Step 8: Commit**

```bash
git add packages/api/
git commit -m "feat(api): add project CRUD service and routes with validation"
```

---

## Task 6: Datasource CRUD

**Files:**
- Create: `packages/api/src/services/datasource-service.ts`
- Create: `packages/api/src/routes/datasources.ts`
- Modify: `packages/api/src/app.ts` (register routes)
- Test: `packages/api/src/tests/services/datasource-service.test.ts`
- Test: `packages/api/src/tests/routes/datasources.test.ts`

- [ ] **Step 1: Write failing service tests**

`packages/api/src/tests/services/datasource-service.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DatasourceService } from '../../services/datasource-service.js';
import { ProjectService } from '../../services/project-service.js';
import { getTestDb } from '../setup.js';
import { datasources, projects } from '@nl2sql/db';

describe('DatasourceService', () => {
  let service: DatasourceService;
  let projectId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(datasources);
    await db.delete(projects);
    service = new DatasourceService(db);

    const projectService = new ProjectService(db);
    const project = await projectService.create({ name: 'Test Project' });
    projectId = project.id;
  });

  it('creates a datasource', async () => {
    const result = await service.create({
      projectId,
      name: 'Production DB',
      dialect: 'postgresql',
    });

    expect(result.name).toBe('Production DB');
    expect(result.dialect).toBe('postgresql');
    expect(result.projectId).toBe(projectId);
  });

  it('creates a datasource with connection config', async () => {
    const result = await service.create({
      projectId,
      name: 'Remote DB',
      dialect: 'mysql',
      connectionConfig: {
        host: 'db.example.com',
        port: 3306,
        database: 'analytics',
        username: 'reader',
        ssl: true,
      },
    });

    expect(result.connectionConfig).toEqual({
      host: 'db.example.com',
      port: 3306,
      database: 'analytics',
      username: 'reader',
      ssl: true,
    });
  });

  it('lists datasources by project', async () => {
    await service.create({ projectId, name: 'DS1', dialect: 'mysql' });
    await service.create({ projectId, name: 'DS2', dialect: 'postgresql' });

    const list = await service.listByProject(projectId);
    expect(list).toHaveLength(2);
  });

  it('gets a datasource by id', async () => {
    const created = await service.create({ projectId, name: 'Findable', dialect: 'hive' });
    const found = await service.getById(created.id);

    expect(found).not.toBeNull();
    expect(found!.name).toBe('Findable');
  });

  it('deletes a datasource', async () => {
    const created = await service.create({ projectId, name: 'Gone', dialect: 'mysql' });
    const deleted = await service.remove(created.id);
    expect(deleted).toBe(true);

    const found = await service.getById(created.id);
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @nl2sql/api test -- --run src/tests/services/datasource-service.test.ts
```

Expected: FAIL — `DatasourceService` does not exist.

- [ ] **Step 3: Implement DatasourceService**

`packages/api/src/services/datasource-service.ts`:
```typescript
import { eq } from 'drizzle-orm';
import { datasources, type DbClient } from '@nl2sql/db';
import type { CreateDatasourceInput } from '@nl2sql/shared';

export class DatasourceService {
  constructor(private db: DbClient) {}

  async create(input: CreateDatasourceInput) {
    const [row] = await this.db
      .insert(datasources)
      .values({
        projectId: input.projectId,
        name: input.name,
        dialect: input.dialect,
        connectionConfig: input.connectionConfig ?? null,
      })
      .returning();
    return row;
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(datasources)
      .where(eq(datasources.projectId, projectId))
      .orderBy(datasources.createdAt);
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(datasources).where(eq(datasources.id, id));
    return row ?? null;
  }

  async update(id: string, input: { name?: string; connectionConfig?: unknown }) {
    const [row] = await this.db
      .update(datasources)
      .set(input)
      .where(eq(datasources.id, id))
      .returning();
    return row ?? null;
  }

  async remove(id: string): Promise<boolean> {
    const [row] = await this.db.delete(datasources).where(eq(datasources.id, id)).returning();
    return row !== undefined;
  }
}
```

- [ ] **Step 4: Run service tests to verify they pass**

```bash
pnpm --filter @nl2sql/api test -- --run src/tests/services/datasource-service.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Write failing route tests**

`packages/api/src/tests/routes/datasources.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAgent } from '../helpers.js';
import { getTestDb } from '../setup.js';
import { datasources, projects } from '@nl2sql/db';

describe('Datasources API', () => {
  let projectId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(datasources);
    await db.delete(projects);

    const agent = createTestAgent();
    const res = await agent.post('/api/projects').send({ name: 'Test Project' });
    projectId = res.body.data.id;
  });

  describe('POST /api/datasources', () => {
    it('creates a datasource', async () => {
      const agent = createTestAgent();
      const res = await agent.post('/api/datasources').send({
        projectId,
        name: 'My DB',
        dialect: 'postgresql',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('My DB');
      expect(res.body.data.dialect).toBe('postgresql');
    });

    it('rejects invalid dialect', async () => {
      const agent = createTestAgent();
      const res = await agent.post('/api/datasources').send({
        projectId,
        name: 'Bad',
        dialect: 'oracle',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/datasources?projectId=xxx', () => {
    it('lists datasources for a project', async () => {
      const agent = createTestAgent();
      await agent.post('/api/datasources').send({ projectId, name: 'DS1', dialect: 'mysql' });
      await agent.post('/api/datasources').send({ projectId, name: 'DS2', dialect: 'hive' });

      const res = await agent.get(`/api/datasources?projectId=${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/datasources/:id', () => {
    it('returns a datasource by id', async () => {
      const agent = createTestAgent();
      const created = await agent.post('/api/datasources').send({
        projectId,
        name: 'Find Me',
        dialect: 'mysql',
      });

      const res = await agent.get(`/api/datasources/${created.body.data.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Find Me');
    });
  });

  describe('DELETE /api/datasources/:id', () => {
    it('deletes a datasource', async () => {
      const agent = createTestAgent();
      const created = await agent.post('/api/datasources').send({
        projectId,
        name: 'Bye',
        dialect: 'mysql',
      });

      const res = await agent.delete(`/api/datasources/${created.body.data.id}`);
      expect(res.status).toBe(204);
    });
  });
});
```

- [ ] **Step 6: Implement datasource routes and register in app**

`packages/api/src/routes/datasources.ts`:
```typescript
import Router from '@koa/router';
import { createDatasourceSchema, updateDatasourceSchema } from '@nl2sql/shared';
import { DatasourceService } from '../services/datasource-service.js';
import type { DbClient } from '@nl2sql/db';

export function createDatasourceRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/datasources' });
  const service = new DatasourceService(db);

  router.post('/', async (ctx) => {
    const parsed = createDatasourceSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }

    const datasource = await service.create(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: datasource };
  });

  router.get('/', async (ctx) => {
    const projectId = ctx.query.projectId as string;
    if (!projectId) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'projectId query param required' } };
      return;
    }

    const list = await service.listByProject(projectId);
    ctx.body = { success: true, data: list };
  });

  router.get('/:id', async (ctx) => {
    const datasource = await service.getById(ctx.params.id);
    if (!datasource) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Datasource not found' } };
      return;
    }
    ctx.body = { success: true, data: datasource };
  });

  router.patch('/:id', async (ctx) => {
    const parsed = updateDatasourceSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }

    const updated = await service.update(ctx.params.id, parsed.data);
    if (!updated) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Datasource not found' } };
      return;
    }
    ctx.body = { success: true, data: updated };
  });

  router.delete('/:id', async (ctx) => {
    const deleted = await service.remove(ctx.params.id);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Datasource not found' } };
      return;
    }
    ctx.status = 204;
  });

  return router;
}
```

Update `packages/api/src/app.ts` — add after project router registration:

```typescript
// Add import at top
import { createDatasourceRouter } from './routes/datasources.js';

// Add after projectRouter.allowedMethods()
const datasourceRouter = createDatasourceRouter(db);
app.use(datasourceRouter.routes());
app.use(datasourceRouter.allowedMethods());
```

- [ ] **Step 7: Run all tests**

```bash
pnpm --filter @nl2sql/api test -- --run
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/api/
git commit -m "feat(api): add datasource CRUD service and routes"
```

---

## Task 7: Schema Table & Column Management

**Files:**
- Create: `packages/api/src/services/schema-service.ts`
- Create: `packages/api/src/routes/schema.ts`
- Modify: `packages/api/src/app.ts` (register routes)
- Test: `packages/api/src/tests/services/schema-service.test.ts`
- Test: `packages/api/src/tests/routes/schema.test.ts`

- [ ] **Step 1: Write failing service tests**

`packages/api/src/tests/services/schema-service.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaService } from '../../services/schema-service.js';
import { ProjectService } from '../../services/project-service.js';
import { DatasourceService } from '../../services/datasource-service.js';
import { getTestDb } from '../setup.js';
import { schemaColumns, schemaTables, schemaRelationships, datasources, projects } from '@nl2sql/db';

describe('SchemaService', () => {
  let service: SchemaService;
  let datasourceId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(schemaRelationships);
    await db.delete(schemaColumns);
    await db.delete(schemaTables);
    await db.delete(datasources);
    await db.delete(projects);

    service = new SchemaService(db);

    const projectService = new ProjectService(db);
    const project = await projectService.create({ name: 'Test' });

    const datasourceService = new DatasourceService(db);
    const ds = await datasourceService.create({
      projectId: project.id,
      name: 'TestDB',
      dialect: 'postgresql',
    });
    datasourceId = ds.id;
  });

  it('creates a table with columns', async () => {
    const result = await service.createTable({
      datasourceId,
      name: 'users',
      comment: 'User accounts',
      columns: [
        { name: 'id', dataType: 'BIGINT', isPrimaryKey: true, isNullable: false },
        { name: 'name', dataType: 'VARCHAR(100)', comment: 'Full name' },
        { name: 'email', dataType: 'VARCHAR(200)', isPii: true },
      ],
    });

    expect(result.table.name).toBe('users');
    expect(result.columns).toHaveLength(3);
    expect(result.columns[0].name).toBe('id');
    expect(result.columns[0].isPrimaryKey).toBe(true);
    expect(result.columns[2].isPii).toBe(true);
  });

  it('lists tables for a datasource', async () => {
    await service.createTable({
      datasourceId,
      name: 'users',
      columns: [{ name: 'id', dataType: 'INT' }],
    });
    await service.createTable({
      datasourceId,
      name: 'orders',
      columns: [{ name: 'id', dataType: 'INT' }],
    });

    const tables = await service.listTables(datasourceId);
    expect(tables).toHaveLength(2);
  });

  it('gets a table with its columns', async () => {
    const created = await service.createTable({
      datasourceId,
      name: 'products',
      columns: [
        { name: 'id', dataType: 'INT', isPrimaryKey: true, isNullable: false },
        { name: 'name', dataType: 'VARCHAR(100)' },
      ],
    });

    const found = await service.getTableWithColumns(created.table.id);
    expect(found).not.toBeNull();
    expect(found!.table.name).toBe('products');
    expect(found!.columns).toHaveLength(2);
  });

  it('deletes a table and cascades to columns', async () => {
    const created = await service.createTable({
      datasourceId,
      name: 'temp',
      columns: [{ name: 'id', dataType: 'INT' }],
    });

    const deleted = await service.removeTable(created.table.id);
    expect(deleted).toBe(true);

    const found = await service.getTableWithColumns(created.table.id);
    expect(found).toBeNull();
  });

  it('creates a relationship between tables', async () => {
    const users = await service.createTable({
      datasourceId,
      name: 'users',
      columns: [{ name: 'id', dataType: 'INT', isPrimaryKey: true, isNullable: false }],
    });

    const orders = await service.createTable({
      datasourceId,
      name: 'orders',
      columns: [
        { name: 'id', dataType: 'INT', isPrimaryKey: true, isNullable: false },
        { name: 'user_id', dataType: 'INT' },
      ],
    });

    const rel = await service.createRelationship({
      datasourceId,
      fromTableId: orders.table.id,
      fromColumnId: orders.columns[1].id,
      toTableId: users.table.id,
      toColumnId: users.columns[0].id,
      relationshipType: 'fk',
    });

    expect(rel.relationshipType).toBe('fk');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @nl2sql/api test -- --run src/tests/services/schema-service.test.ts
```

Expected: FAIL — `SchemaService` does not exist.

- [ ] **Step 3: Implement SchemaService**

`packages/api/src/services/schema-service.ts`:
```typescript
import { eq } from 'drizzle-orm';
import {
  schemaTables,
  schemaColumns,
  schemaRelationships,
  type DbClient,
} from '@nl2sql/db';
import type { CreateSchemaTableInput, CreateRelationshipInput } from '@nl2sql/shared';

export class SchemaService {
  constructor(private db: DbClient) {}

  async createTable(input: CreateSchemaTableInput) {
    return this.db.transaction(async (tx) => {
      const [table] = await tx
        .insert(schemaTables)
        .values({
          datasourceId: input.datasourceId,
          name: input.name,
          comment: input.comment ?? null,
          ddl: input.ddl ?? null,
        })
        .returning();

      const columnRows = await tx
        .insert(schemaColumns)
        .values(
          input.columns.map((col, index) => ({
            tableId: table.id,
            name: col.name,
            dataType: col.dataType,
            comment: col.comment ?? null,
            sampleValues: col.sampleValues ?? null,
            isPrimaryKey: col.isPrimaryKey ?? false,
            isNullable: col.isNullable ?? true,
            isPii: col.isPii ?? false,
            ordinalPosition: index + 1,
          })),
        )
        .returning();

      return { table, columns: columnRows };
    });
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

  async updateColumn(columnId: string, input: { comment?: string; sampleValues?: string[]; isPii?: boolean }) {
    const [row] = await this.db
      .update(schemaColumns)
      .set(input)
      .where(eq(schemaColumns.id, columnId))
      .returning();
    return row ?? null;
  }

  async removeTable(tableId: string): Promise<boolean> {
    const [row] = await this.db
      .delete(schemaTables)
      .where(eq(schemaTables.id, tableId))
      .returning();
    return row !== undefined;
  }

  async createRelationship(input: CreateRelationshipInput) {
    const [row] = await this.db
      .insert(schemaRelationships)
      .values(input)
      .returning();
    return row;
  }

  async listRelationships(datasourceId: string) {
    return this.db
      .select()
      .from(schemaRelationships)
      .where(eq(schemaRelationships.datasourceId, datasourceId));
  }
}
```

- [ ] **Step 4: Run service tests to verify they pass**

```bash
pnpm --filter @nl2sql/api test -- --run src/tests/services/schema-service.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Write failing route tests**

`packages/api/src/tests/routes/schema.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAgent } from '../helpers.js';
import { getTestDb } from '../setup.js';
import {
  schemaRelationships,
  schemaColumns,
  schemaTables,
  datasources,
  projects,
} from '@nl2sql/db';

describe('Schema API', () => {
  let datasourceId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(schemaRelationships);
    await db.delete(schemaColumns);
    await db.delete(schemaTables);
    await db.delete(datasources);
    await db.delete(projects);

    const agent = createTestAgent();
    const projectRes = await agent.post('/api/projects').send({ name: 'Test' });
    const dsRes = await agent.post('/api/datasources').send({
      projectId: projectRes.body.data.id,
      name: 'TestDB',
      dialect: 'postgresql',
    });
    datasourceId = dsRes.body.data.id;
  });

  describe('POST /api/schema/tables', () => {
    it('creates a table with columns', async () => {
      const agent = createTestAgent();
      const res = await agent.post('/api/schema/tables').send({
        datasourceId,
        name: 'users',
        comment: 'User table',
        columns: [
          { name: 'id', dataType: 'BIGINT', isPrimaryKey: true, isNullable: false },
          { name: 'email', dataType: 'VARCHAR(200)', isPii: true },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.data.table.name).toBe('users');
      expect(res.body.data.columns).toHaveLength(2);
    });

    it('rejects table without columns', async () => {
      const agent = createTestAgent();
      const res = await agent.post('/api/schema/tables').send({
        datasourceId,
        name: 'empty',
        columns: [],
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/schema/tables?datasourceId=xxx', () => {
    it('lists tables for a datasource', async () => {
      const agent = createTestAgent();
      await agent.post('/api/schema/tables').send({
        datasourceId,
        name: 'users',
        columns: [{ name: 'id', dataType: 'INT' }],
      });

      const res = await agent.get(`/api/schema/tables?datasourceId=${datasourceId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/schema/tables/:id', () => {
    it('returns table with columns', async () => {
      const agent = createTestAgent();
      const created = await agent.post('/api/schema/tables').send({
        datasourceId,
        name: 'products',
        columns: [
          { name: 'id', dataType: 'INT' },
          { name: 'name', dataType: 'TEXT' },
        ],
      });

      const res = await agent.get(`/api/schema/tables/${created.body.data.table.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.columns).toHaveLength(2);
    });
  });

  describe('POST /api/schema/tables/from-ddl', () => {
    it('creates a table from DDL', async () => {
      const agent = createTestAgent();
      const res = await agent.post('/api/schema/tables/from-ddl').send({
        datasourceId,
        ddl: `CREATE TABLE orders (
          id BIGINT PRIMARY KEY,
          user_id INT NOT NULL,
          amount DECIMAL(10,2),
          status VARCHAR(20) DEFAULT 'pending'
        );`,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.table.name).toBe('orders');
      expect(res.body.data.columns.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('DELETE /api/schema/tables/:id', () => {
    it('deletes a table', async () => {
      const agent = createTestAgent();
      const created = await agent.post('/api/schema/tables').send({
        datasourceId,
        name: 'temp',
        columns: [{ name: 'id', dataType: 'INT' }],
      });

      const res = await agent.delete(`/api/schema/tables/${created.body.data.table.id}`);
      expect(res.status).toBe(204);
    });
  });
});
```

- [ ] **Step 6: Implement schema routes and register in app**

`packages/api/src/routes/schema.ts`:
```typescript
import Router from '@koa/router';
import {
  createSchemaTableSchema,
  createSchemaTableFromDdlSchema,
  createRelationshipSchema,
  updateColumnSchema,
} from '@nl2sql/shared';
import { SchemaService } from '../services/schema-service.js';
import { DdlParser } from '../services/ddl-parser.js';
import type { DbClient } from '@nl2sql/db';

export function createSchemaRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/schema' });
  const service = new SchemaService(db);
  const ddlParser = new DdlParser();

  router.post('/tables', async (ctx) => {
    const parsed = createSchemaTableSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }

    const result = await service.createTable(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: result };
  });

  router.post('/tables/from-ddl', async (ctx) => {
    const parsed = createSchemaTableFromDdlSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }

    const parseResult = ddlParser.parse(parsed.data.ddl);
    if (!parseResult) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse DDL' } };
      return;
    }

    const result = await service.createTable({
      datasourceId: parsed.data.datasourceId,
      name: parseResult.tableName,
      comment: parseResult.comment,
      ddl: parsed.data.ddl,
      columns: parseResult.columns.map((col) => ({
        name: col.name,
        dataType: col.dataType,
        comment: col.comment ?? undefined,
        isPrimaryKey: col.isPrimaryKey,
        isNullable: col.isNullable,
      })),
    });

    ctx.status = 201;
    ctx.body = { success: true, data: result };
  });

  router.get('/tables', async (ctx) => {
    const datasourceId = ctx.query.datasourceId as string;
    if (!datasourceId) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'datasourceId query param required' } };
      return;
    }

    const tables = await service.listTables(datasourceId);
    ctx.body = { success: true, data: tables };
  });

  router.get('/tables/:id', async (ctx) => {
    const result = await service.getTableWithColumns(ctx.params.id);
    if (!result) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Table not found' } };
      return;
    }
    ctx.body = { success: true, data: result };
  });

  router.patch('/columns/:id', async (ctx) => {
    const parsed = updateColumnSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }

    const updated = await service.updateColumn(ctx.params.id, parsed.data);
    if (!updated) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Column not found' } };
      return;
    }
    ctx.body = { success: true, data: updated };
  });

  router.delete('/tables/:id', async (ctx) => {
    const deleted = await service.removeTable(ctx.params.id);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Table not found' } };
      return;
    }
    ctx.status = 204;
  });

  router.post('/relationships', async (ctx) => {
    const parsed = createRelationshipSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }

    const result = await service.createRelationship(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: result };
  });

  router.get('/relationships', async (ctx) => {
    const datasourceId = ctx.query.datasourceId as string;
    if (!datasourceId) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'datasourceId query param required' } };
      return;
    }

    const relationships = await service.listRelationships(datasourceId);
    ctx.body = { success: true, data: relationships };
  });

  return router;
}
```

Update `packages/api/src/app.ts` — add after datasource router registration:

```typescript
// Add import at top
import { createSchemaRouter } from './routes/schema.js';

// Add after datasourceRouter.allowedMethods()
const schemaRouter = createSchemaRouter(db);
app.use(schemaRouter.routes());
app.use(schemaRouter.allowedMethods());
```

- [ ] **Step 7: Run all tests (will fail on DDL route — DdlParser not yet implemented)**

```bash
pnpm --filter @nl2sql/api test -- --run
```

Expected: schema service tests PASS, schema route tests FAIL on `/from-ddl` (DdlParser not implemented). This is expected — Task 8 implements it.

- [ ] **Step 8: Commit (partial — DDL route will be completed in Task 8)**

```bash
git add packages/api/
git commit -m "feat(api): add schema table/column/relationship CRUD service and routes"
```

---

## Task 8: DDL Parser

**Files:**
- Create: `packages/api/src/services/ddl-parser.ts`
- Test: `packages/api/src/tests/services/ddl-parser.test.ts`

- [ ] **Step 1: Write failing DDL parser tests**

`packages/api/src/tests/services/ddl-parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { DdlParser } from '../../services/ddl-parser.js';

describe('DdlParser', () => {
  const parser = new DdlParser();

  it('parses a basic CREATE TABLE', () => {
    const result = parser.parse(`
      CREATE TABLE users (
        id BIGINT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(200)
      );
    `);

    expect(result).not.toBeNull();
    expect(result!.tableName).toBe('users');
    expect(result!.columns).toHaveLength(3);
    expect(result!.columns[0]).toEqual({
      name: 'id',
      dataType: 'BIGINT',
      comment: null,
      isPrimaryKey: true,
      isNullable: false,
    });
    expect(result!.columns[1]).toEqual({
      name: 'name',
      dataType: 'VARCHAR(100)',
      comment: null,
      isPrimaryKey: false,
      isNullable: false,
    });
    expect(result!.columns[2]).toEqual({
      name: 'email',
      dataType: 'VARCHAR(200)',
      comment: null,
      isPrimaryKey: false,
      isNullable: true,
    });
  });

  it('parses columns with DEFAULT and constraints', () => {
    const result = parser.parse(`
      CREATE TABLE orders (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    expect(result!.tableName).toBe('orders');
    expect(result!.columns).toHaveLength(4);
    expect(result!.columns[0].isPrimaryKey).toBe(true);
    expect(result!.columns[1].dataType).toBe('DECIMAL(10,2)');
    expect(result!.columns[2].isNullable).toBe(true);
  });

  it('parses MySQL COMMENT syntax', () => {
    const result = parser.parse(`
      CREATE TABLE products (
        id INT PRIMARY KEY COMMENT 'Product ID',
        name VARCHAR(100) NOT NULL COMMENT 'Product name'
      ) COMMENT='Product catalog';
    `);

    expect(result!.columns[0].comment).toBe('Product ID');
    expect(result!.columns[1].comment).toBe('Product name');
    expect(result!.comment).toBe('Product catalog');
  });

  it('parses PostgreSQL COMMENT ON syntax (separate statements)', () => {
    const result = parser.parse(`
      CREATE TABLE employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
      COMMENT ON TABLE employees IS 'All employees';
      COMMENT ON COLUMN employees.name IS 'Full name';
    `);

    expect(result!.tableName).toBe('employees');
    expect(result!.comment).toBe('All employees');
    expect(result!.columns[1].comment).toBe('Full name');
  });

  it('parses inline FOREIGN KEY references', () => {
    const result = parser.parse(`
      CREATE TABLE orders (
        id INT PRIMARY KEY,
        user_id INT REFERENCES users(id),
        product_id INT NOT NULL
      );
    `);

    expect(result!.foreignKeys).toHaveLength(1);
    expect(result!.foreignKeys[0]).toEqual({
      column: 'user_id',
      referencedTable: 'users',
      referencedColumn: 'id',
    });
  });

  it('parses table-level FOREIGN KEY constraints', () => {
    const result = parser.parse(`
      CREATE TABLE order_items (
        id INT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    expect(result!.foreignKeys).toHaveLength(2);
  });

  it('parses table-level PRIMARY KEY constraint', () => {
    const result = parser.parse(`
      CREATE TABLE logs (
        ts TIMESTAMP NOT NULL,
        level VARCHAR(10),
        message TEXT,
        PRIMARY KEY (ts, level)
      );
    `);

    expect(result!.columns[0].isPrimaryKey).toBe(true);
    expect(result!.columns[1].isPrimaryKey).toBe(true);
  });

  it('handles schema-qualified table names', () => {
    const result = parser.parse(`
      CREATE TABLE public.users (
        id INT PRIMARY KEY
      );
    `);

    expect(result!.tableName).toBe('users');
  });

  it('handles IF NOT EXISTS', () => {
    const result = parser.parse(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY
      );
    `);

    expect(result!.tableName).toBe('users');
  });

  it('returns null for unparseable input', () => {
    const result = parser.parse('SELECT * FROM users');
    expect(result).toBeNull();
  });

  it('handles backtick-quoted identifiers', () => {
    const result = parser.parse(`
      CREATE TABLE \`order-items\` (
        \`item-id\` INT PRIMARY KEY,
        \`order_id\` INT NOT NULL
      );
    `);

    expect(result!.tableName).toBe('order-items');
    expect(result!.columns[0].name).toBe('item-id');
  });

  it('handles double-quote identifiers', () => {
    const result = parser.parse(`
      CREATE TABLE "user data" (
        "user id" INT PRIMARY KEY
      );
    `);

    expect(result!.tableName).toBe('user data');
    expect(result!.columns[0].name).toBe('user id');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @nl2sql/api test -- --run src/tests/services/ddl-parser.test.ts
```

Expected: FAIL — `DdlParser` does not exist.

- [ ] **Step 3: Implement DdlParser**

`packages/api/src/services/ddl-parser.ts`:
```typescript
import type { DdlParseResult } from '@nl2sql/shared';

export class DdlParser {
  parse(ddl: string): DdlParseResult | null {
    const cleaned = ddl.trim();

    if (!/CREATE\s+TABLE/i.test(cleaned)) {
      return null;
    }

    const tableName = this.extractTableName(cleaned);
    if (!tableName) return null;

    const bodyMatch = cleaned.match(/\((.+)\)/s);
    if (!bodyMatch) return null;

    const body = bodyMatch[1];
    const lines = this.splitColumnDefinitions(body);

    const tableLevelPks = this.extractTableLevelPrimaryKeys(lines);
    const tableLevelFks = this.extractTableLevelForeignKeys(lines);

    const columnLines = lines.filter(
      (line) => !this.isConstraintLine(line),
    );

    const columns = columnLines.map((line) => this.parseColumnLine(line, tableLevelPks));
    const inlineFks = columns.flatMap((_, i) => this.extractInlineForeignKey(columnLines[i], columns[i]?.name));

    const tableComment = this.extractTableComment(cleaned);
    const pgComments = this.extractPgComments(ddl, tableName);

    for (const col of columns) {
      if (pgComments.columns[col.name]) {
        col.comment = pgComments.columns[col.name];
      }
    }

    return {
      tableName,
      comment: pgComments.table ?? tableComment,
      columns,
      foreignKeys: [...inlineFks, ...tableLevelFks],
    };
  }

  private extractTableName(ddl: string): string | null {
    const match = ddl.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["'`]?(\w[\w\s-]*)["'`]?\.)?["'`]?(\w[\w\s-]*)["'`]?\s*\(/i,
    );
    if (!match) return null;
    return match[2].trim();
  }

  private splitColumnDefinitions(body: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of body) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
        continue;
      }
      current += char;
    }

    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);

    return result;
  }

  private isConstraintLine(line: string): boolean {
    return /^\s*(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY\s)/i.test(line);
  }

  private parseColumnLine(
    line: string,
    tableLevelPks: Set<string>,
  ): DdlParseResult['columns'][number] {
    const nameMatch = line.match(/^["'`]?([\w][\w\s-]*)["'`]?\s+(.+)/i);
    if (!nameMatch) {
      return { name: line.trim(), dataType: 'UNKNOWN', comment: null, isPrimaryKey: false, isNullable: true };
    }

    const name = nameMatch[1].trim();
    const rest = nameMatch[2];

    const dataType = this.extractDataType(rest);
    const isPrimaryKey = /PRIMARY\s+KEY/i.test(rest) || tableLevelPks.has(name.toLowerCase());
    const isNotNull = /NOT\s+NULL/i.test(rest);
    const isNullable = isPrimaryKey ? false : !isNotNull;
    const comment = this.extractColumnComment(rest);

    return { name, dataType, comment, isPrimaryKey, isNullable };
  }

  private extractDataType(rest: string): string {
    let cleaned = rest
      .replace(/\bPRIMARY\s+KEY\b/gi, '')
      .replace(/\bNOT\s+NULL\b/gi, '')
      .replace(/\bNULL\b/gi, '')
      .replace(/\bAUTO_INCREMENT\b/gi, '')
      .replace(/\bSERIAL\b/gi, 'SERIAL')
      .replace(/\bDEFAULT\s+[^,)]+/gi, '')
      .replace(/\bCOMMENT\s+'[^']*'/gi, '')
      .replace(/\bCOMMENT\s+"[^"]*"/gi, '')
      .replace(/\bREFERENCES\s+\S+\([^)]*\)/gi, '')
      .replace(/\bUNIQUE\b/gi, '')
      .trim();

    const typeMatch = cleaned.match(/^(\w+(?:\([^)]+\))?)/);
    return typeMatch ? typeMatch[1].toUpperCase() : 'UNKNOWN';
  }

  private extractColumnComment(rest: string): string | null {
    const match = rest.match(/COMMENT\s+['"]([^'"]*)['"]/i);
    return match ? match[1] : null;
  }

  private extractTableComment(ddl: string): string | null {
    const match = ddl.match(/\)\s*(?:ENGINE\s*=\s*\w+\s*)?COMMENT\s*=\s*['"]([^'"]*)['"]/i);
    return match ? match[1] : null;
  }

  private extractTableLevelPrimaryKeys(lines: string[]): Set<string> {
    const pks = new Set<string>();
    for (const line of lines) {
      const match = line.match(/^\s*PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (match) {
        match[1].split(',').forEach((col) => {
          pks.add(col.trim().replace(/["'`]/g, '').toLowerCase());
        });
      }
    }
    return pks;
  }

  private extractTableLevelForeignKeys(
    lines: string[],
  ): DdlParseResult['foreignKeys'] {
    const fks: DdlParseResult['foreignKeys'] = [];
    for (const line of lines) {
      const match = line.match(
        /FOREIGN\s+KEY\s*\(\s*["'`]?(\w+)["'`]?\s*\)\s*REFERENCES\s+["'`]?(\w+)["'`]?\s*\(\s*["'`]?(\w+)["'`]?\s*\)/i,
      );
      if (match) {
        fks.push({
          column: match[1],
          referencedTable: match[2],
          referencedColumn: match[3],
        });
      }
    }
    return fks;
  }

  private extractInlineForeignKey(
    line: string,
    columnName: string | undefined,
  ): DdlParseResult['foreignKeys'] {
    if (!columnName) return [];
    const match = line.match(
      /REFERENCES\s+["'`]?(\w+)["'`]?\s*\(\s*["'`]?(\w+)["'`]?\s*\)/i,
    );
    if (!match) return [];
    return [{
      column: columnName,
      referencedTable: match[1],
      referencedColumn: match[2],
    }];
  }

  private extractPgComments(
    ddl: string,
    tableName: string,
  ): { table: string | null; columns: Record<string, string> } {
    const result: { table: string | null; columns: Record<string, string> } = {
      table: null,
      columns: {},
    };

    const tableCommentMatch = ddl.match(
      new RegExp(`COMMENT\\s+ON\\s+TABLE\\s+["'`]?${tableName}["'`]?\\s+IS\\s+'([^']*)'`, 'i'),
    );
    if (tableCommentMatch) {
      result.table = tableCommentMatch[1];
    }

    const colCommentRegex = new RegExp(
      `COMMENT\\s+ON\\s+COLUMN\\s+["'\`]?${tableName}["'\`]?\\.["'\`]?(\\w+)["'\`]?\\s+IS\\s+'([^']*)'`,
      'gi',
    );
    let match;
    while ((match = colCommentRegex.exec(ddl)) !== null) {
      result.columns[match[1]] = match[2];
    }

    return result;
  }
}
```

- [ ] **Step 4: Run DDL parser tests to verify they pass**

```bash
pnpm --filter @nl2sql/api test -- --run src/tests/services/ddl-parser.test.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pnpm --filter @nl2sql/api test -- --run
```

Expected: ALL tests PASS — health, project CRUD, datasource CRUD, schema CRUD, DDL parser.

- [ ] **Step 6: Commit**

```bash
git add packages/api/
git commit -m "feat(api): add DDL parser with MySQL/PG comment support, FK extraction, quoted identifiers"
```

---

## Task 9: Service Exports & Final Verification

**Files:**
- Create: `packages/api/src/services/index.ts`
- Create: `packages/api/src/routes/index.ts`

- [ ] **Step 1: Create barrel exports**

`packages/api/src/services/index.ts`:
```typescript
export { ProjectService } from './project-service.js';
export { DatasourceService } from './datasource-service.js';
export { SchemaService } from './schema-service.js';
export { DdlParser } from './ddl-parser.js';
```

`packages/api/src/routes/index.ts`:
```typescript
export { createHealthRouter } from './health.js';
export { createProjectRouter } from './projects.js';
export { createDatasourceRouter } from './datasources.js';
export { createSchemaRouter } from './schema.js';
```

- [ ] **Step 2: Run full test suite**

```bash
cd ~/Desktop/workspace/projects/nl2sql
pnpm --filter @nl2sql/api test -- --run
```

Expected: ALL tests PASS.

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

Expected: all packages build without errors.

- [ ] **Step 4: Start dev server and smoke test**

```bash
pnpm dev:api &
sleep 2

# Create project
curl -s -X POST http://localhost:3100/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","description":"Smoke test"}' | jq .

# List projects
curl -s http://localhost:3100/api/projects | jq .

kill %1
```

Expected: project created and listed successfully.

- [ ] **Step 5: Format and final commit**

```bash
pnpm format
git add -A
git commit -m "chore: add barrel exports, format code — Phase 1 complete"
```

---

## Phase 1 Completion Checklist

After all tasks are done, verify:

- [ ] `pnpm test` — all tests pass
- [ ] `pnpm build` — all packages compile
- [ ] `pnpm dev:api` — server starts on port 3100
- [ ] `GET /health` — returns `{ status: "ok" }`
- [ ] `POST /api/projects` — creates a project
- [ ] `POST /api/datasources` — creates a datasource under a project
- [ ] `POST /api/schema/tables` — creates a table with columns
- [ ] `POST /api/schema/tables/from-ddl` — parses DDL and creates table
- [ ] `POST /api/schema/relationships` — creates FK relationships
- [ ] Database has all 5 tables: `projects`, `datasources`, `schema_tables`, `schema_columns`, `schema_relationships`

---

## Next Phase

Phase 2 will cover **Metrics Layer + Knowledge Base**:
- Metric definition CRUD (atomic, derived, composite)
- Metric composition engine (指标 → SQL expression assembly)
- Knowledge document upload, chunking, embedding (pgvector)
- Business glossary management (term → SQL expression mapping)
- This will add tables: `metrics`, `knowledge_docs`, `knowledge_chunks`, `glossary_entries`, `column_embeddings`
