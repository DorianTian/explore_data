import pg from 'pg';

export interface ExecutionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl?: boolean;
}

export interface ExecutionResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: Array<{ name: string; dataType: string }>;
  executionTimeMs: number;
  truncated: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ROW_LIMIT = 1000;

/**
 * Query Execution Sandbox — execute SQL safely against user's database.
 *
 * Safety guarantees:
 * - Read-only connection (SET default_transaction_read_only = ON)
 * - Statement timeout
 * - Row limit via LIMIT injection
 * - Isolated connection pool (not shared with app DB)
 */
export class QueryExecutor {
  async execute(
    sql: string,
    config: ExecutionConfig,
    options: { timeoutMs?: number; rowLimit?: number } = {},
  ): Promise<ExecutionResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const rowLimit = options.rowLimit ?? DEFAULT_ROW_LIMIT;

    const pool = new pg.Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 1,
      idleTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    const start = Date.now();

    try {
      // Set read-only mode and statement timeout
      await client.query('SET default_transaction_read_only = ON');
      await client.query(`SET statement_timeout = '${timeoutMs}ms'`);

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
      await pool.end();
    }
  }

  private ensureLimit(sql: string, limit: number): string {
    const trimmed = sql.trim().replace(/;\s*$/, '');
    if (/\bLIMIT\s+\d+/i.test(trimmed)) {
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
