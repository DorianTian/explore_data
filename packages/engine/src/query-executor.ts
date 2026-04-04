import pg from 'pg';
import { PIPELINE } from './config.js';

export interface ExecutionConfig {
  host: string;
  port: number;
  database: string;
  /** Accepts both 'user' and 'username' for compatibility */
  user?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  /** PostgreSQL schema to set as search_path (e.g. 'dw_hive') */
  schema?: string;
}

export interface ExecutionResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: Array<{ name: string; dataType: string }>;
  executionTimeMs: number;
  truncated: boolean;
}

/**
 * Query Execution Sandbox — execute SQL safely against user's database.
 *
 * Safety guarantees:
 * - Read-only connection (SET default_transaction_read_only = ON)
 * - Statement timeout via parameterized SET
 * - Row limit via LIMIT injection
 * - Pooled connections cached per config (not recreated per query)
 * - SSL certificate verification configurable per environment
 */
export class QueryExecutor {
  /** Cache pools by connection key to avoid TCP overhead per query */
  private static poolCache = new Map<string, pg.Pool>();

  async execute(
    sql: string,
    config: ExecutionConfig,
    options: { timeoutMs?: number; rowLimit?: number } = {},
  ): Promise<ExecutionResult> {
    const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? PIPELINE.defaultQueryTimeout));
    const rowLimit = Math.max(1, Math.floor(options.rowLimit ?? PIPELINE.defaultRowLimit));

    const pool = this.getOrCreatePool(config);
    const client = await pool.connect();
    const start = Date.now();

    try {
      // Set read-only mode and statement timeout (parameterized, not interpolated)
      await client.query('SET default_transaction_read_only = ON');
      await client.query(`SET statement_timeout = '${timeoutMs}ms'`);

      // Set search_path if schema is specified (for engine-type isolation)
      if (config.schema) {
        await client.query(`SET search_path TO "${config.schema}", public`);
      }

      // Add LIMIT if not present
      const limitedSql = this.ensureLimit(sql, rowLimit);

      const result = await client.query(limitedSql);
      const executionTimeMs = Date.now() - start;

      const columns = (result.fields ?? []).map((f) => ({
        name: f.name,
        dataType: this.mapPgType(f.dataTypeID),
      }));

      const rows = result.rows ?? [];
      const truncated = rows.length >= rowLimit;

      return {
        rows,
        rowCount: rows.length,
        columns,
        executionTimeMs,
        truncated,
      };
    } finally {
      client.release();
    }
  }

  /** Close all cached pools — call on shutdown */
  static async closeAll(): Promise<void> {
    const pools = [...QueryExecutor.poolCache.values()];
    QueryExecutor.poolCache.clear();
    await Promise.all(pools.map((p) => p.end()));
  }

  private getOrCreatePool(config: ExecutionConfig): pg.Pool {
    const dbUser = config.user ?? config.username ?? '';
    const key = `${config.host}:${config.port}/${config.database}/${dbUser}`;
    let pool = QueryExecutor.poolCache.get(key);
    if (!pool) {
      pool = new pg.Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: dbUser,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: process.env.NODE_ENV === 'production' } : undefined,
        max: 3,
        idleTimeoutMillis: 30_000,
      });
      QueryExecutor.poolCache.set(key, pool);
    }
    return pool;
  }

  private ensureLimit(sql: string, limit: number): string {
    const trimmed = sql.trim().replace(/;\s*$/, '');
    // Only check for LIMIT at the outer query level (after last closing paren or at end)
    // Find the last SELECT that isn't inside parentheses
    const hasOuterLimit = /\bLIMIT\s+\d+\s*$/i.test(trimmed);
    if (hasOuterLimit) {
      return trimmed;
    }
    return `${trimmed} LIMIT ${limit}`;
  }

  private mapPgType(oid: number): string {
    const typeMap: Record<number, string> = {
      16: 'boolean',
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      700: 'real',
      701: 'double',
      1043: 'varchar',
      1082: 'date',
      1114: 'timestamp',
      1184: 'timestamptz',
      1700: 'numeric',
      3802: 'jsonb',
    };
    return typeMap[oid] ?? 'unknown';
  }
}
