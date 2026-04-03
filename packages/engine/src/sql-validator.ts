import { Parser } from 'node-sql-parser';
import { validateSql as antlr4Validate } from './antlr4-validator.js';
import type { SchemaContext } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  tablesReferenced: string[];
  columnsReferenced: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

const MAX_SUBQUERY_DEPTH = 3;
const MAX_JOIN_COUNT = 5;

/**
 * SQL Validator — safety checks, schema validation, and danger pattern detection.
 *
 * Uses ANTLR4 grammar-based parser as the primary validator for syntax checking
 * and table/column extraction. Falls back to node-sql-parser for edge cases
 * where ANTLR4 fails (dialect-specific syntax, etc.).
 */
export class SqlValidator {
  private parser: Parser;

  constructor(private dialect: string = 'postgresql') {
    this.parser = new Parser();
  }

  validate(sql: string, schema?: SchemaContext): ValidationResult {
    const errors: ValidationError[] = [];

    // Pre-check: regex-based blocklist for obvious violations
    const preCheckErrors = this.preCheck(sql);
    if (preCheckErrors.length > 0) {
      return { valid: false, errors: preCheckErrors, tablesReferenced: [], columnsReferenced: [] };
    }

    // Primary: ANTLR4 grammar-based validation
    let tablesReferenced: string[] = [];
    let columnsReferenced: string[] = [];

    const antlr4Result = antlr4Validate(sql);

    if (antlr4Result.valid) {
      tablesReferenced = antlr4Result.tables;
      columnsReferenced = antlr4Result.columns;
    } else if (antlr4Result.statementType !== 'select' && antlr4Result.statementType !== 'unknown') {
      // ANTLR4 detected non-SELECT — reject immediately
      for (const errMsg of antlr4Result.errors) {
        errors.push({ code: 'BLOCKED_STATEMENT', message: errMsg, severity: 'error' });
      }
      return { valid: false, errors, tablesReferenced: [], columnsReferenced: [] };
    } else {
      // ANTLR4 had syntax errors — fall back to node-sql-parser
      const fallbackResult = this.fallbackParse(sql);
      if (!fallbackResult.valid) {
        // Both parsers failed — report ANTLR4 errors (more precise grammar)
        for (const errMsg of antlr4Result.errors) {
          errors.push({ code: 'PARSE_ERROR', message: `SQL syntax error: ${errMsg}`, severity: 'error' });
        }
        return { valid: false, errors, tablesReferenced: [], columnsReferenced: [] };
      }
      tablesReferenced = fallbackResult.tables;
      columnsReferenced = fallbackResult.columns;
    }

    // Check for dangerous patterns
    this.checkDangerPatterns(sql, errors);

    // Schema cross-validation
    if (schema && tablesReferenced.length > 0) {
      this.validateAgainstSchema(tablesReferenced, columnsReferenced, schema, errors);
    }

    return {
      valid: errors.filter((e) => e.severity === 'error').length === 0,
      errors,
      tablesReferenced: [...new Set(tablesReferenced)],
      columnsReferenced: [...new Set(columnsReferenced)],
    };
  }

  /**
   * Fallback parser using node-sql-parser for dialect-specific SQL
   * that the minimal ANTLR4 grammar doesn't cover.
   */
  private fallbackParse(sql: string): { valid: boolean; tables: string[]; columns: string[] } {
    const dbType = this.mapDialect();
    let tables: string[] = [];
    let columns: string[] = [];

    try {
      this.parser.astify(sql, { database: dbType });
    } catch {
      return { valid: false, tables: [], columns: [] };
    }

    try {
      const tableList = this.parser.tableList(sql, { database: dbType });
      tables = tableList.map((t: string) => {
        const parts = t.split('::');
        return parts[parts.length - 1];
      });
    } catch {
      // Extraction failed, continue with empty
    }

    try {
      const columnList = this.parser.columnList(sql, { database: dbType });
      columns = columnList.map((c: string) => {
        const parts = c.split('::');
        return parts[parts.length - 1];
      });
    } catch {
      // Extraction failed, continue with empty
    }

    return { valid: true, tables, columns };
  }

  private preCheck(sql: string): ValidationError[] {
    const errors: ValidationError[] = [];
    // Strip comments before checking
    const cleaned = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

    const blockedPatterns = [
      { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW)/i, msg: 'DROP statements are not allowed' },
      { pattern: /\bTRUNCATE\s+/i, msg: 'TRUNCATE is not allowed' },
      { pattern: /\bALTER\s+(TABLE|DATABASE|SCHEMA)/i, msg: 'ALTER statements are not allowed' },
      { pattern: /\bDELETE\s+FROM/i, msg: 'DELETE is not allowed' },
      { pattern: /\bUPDATE\s+\w+\s+SET/i, msg: 'UPDATE is not allowed' },
      { pattern: /\bINSERT\s+INTO/i, msg: 'INSERT is not allowed' },
      { pattern: /\bGRANT\s+/i, msg: 'GRANT is not allowed' },
      { pattern: /\bREVOKE\s+/i, msg: 'REVOKE is not allowed' },
      { pattern: /\bINTO\s+OUTFILE/i, msg: 'INTO OUTFILE is not allowed' },
      { pattern: /\bLOAD\s+DATA/i, msg: 'LOAD DATA is not allowed' },
    ];

    for (const { pattern, msg } of blockedPatterns) {
      if (pattern.test(cleaned)) {
        errors.push({ code: 'BLOCKED_STATEMENT', message: msg, severity: 'error' });
      }
    }

    return errors;
  }

  private checkDangerPatterns(sql: string, errors: ValidationError[]): void {
    // CROSS JOIN detection
    if (/\bCROSS\s+JOIN\b/i.test(sql)) {
      errors.push({
        code: 'CROSS_JOIN',
        message: 'CROSS JOIN detected — may produce a cartesian product.',
        severity: 'warning',
      });
    }

    // SELECT * without LIMIT
    if (/\bSELECT\s+\*/i.test(sql) && !/\bLIMIT\s+\d/i.test(sql)) {
      errors.push({
        code: 'SELECT_STAR_NO_LIMIT',
        message: 'SELECT * without LIMIT may return excessive rows.',
        severity: 'warning',
      });
    }

    // Subquery depth
    const depth = this.countSubqueryDepth(sql);
    if (depth > MAX_SUBQUERY_DEPTH) {
      errors.push({
        code: 'DEEP_SUBQUERY',
        message: `Subquery depth is ${depth} (max ${MAX_SUBQUERY_DEPTH}).`,
        severity: 'warning',
      });
    }

    // Join count
    const joinCount = (sql.match(/\bJOIN\b/gi) || []).length;
    if (joinCount > MAX_JOIN_COUNT) {
      errors.push({
        code: 'TOO_MANY_JOINS',
        message: `Query has ${joinCount} JOINs (max ${MAX_JOIN_COUNT}).`,
        severity: 'warning',
      });
    }
  }

  private validateAgainstSchema(
    tables: string[],
    columns: string[],
    schema: SchemaContext,
    errors: ValidationError[],
  ): void {
    const knownTables = new Set(schema.tables.map((t) => t.name.toLowerCase()));
    const knownColumns = new Set<string>();

    for (const table of schema.tables) {
      for (const col of table.columns) {
        knownColumns.add(`${table.name.toLowerCase()}.${col.name.toLowerCase()}`);
        knownColumns.add(col.name.toLowerCase());
      }
    }

    for (const table of tables) {
      if (!knownTables.has(table.toLowerCase())) {
        errors.push({
          code: 'UNKNOWN_TABLE',
          message: `Table "${table}" is not in the registered schema.`,
          severity: 'error',
        });
      }
    }

    for (const col of columns) {
      if (col === '*' || col === '(.*)')  continue;
      const colLower = col.toLowerCase();
      const parts = colLower.split('.');
      const colName = parts[parts.length - 1];

      if (!knownColumns.has(colLower) && !knownColumns.has(colName)) {
        errors.push({
          code: 'UNKNOWN_COLUMN',
          message: `Column "${col}" may not exist in the registered schema.`,
          severity: 'warning',
        });
      }
    }
  }

  private countSubqueryDepth(sql: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const token of sql.split(/\b/)) {
      if (token.trim().toUpperCase() === 'SELECT') {
        currentDepth++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
      }
    }

    return Math.max(0, maxDepth - 1);
  }

  private mapDialect(): string {
    const map: Record<string, string> = {
      mysql: 'MySQL',
      postgresql: 'PostgresQL',
      hive: 'Hive',
      sparksql: 'SparkSQL',
      flinksql: 'FlinkSQL',
    };
    return map[this.dialect.toLowerCase()] ?? 'PostgresQL';
  }
}
