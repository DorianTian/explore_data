// eslint-disable-next-line @typescript-eslint/no-require-imports
import antlr4 from 'antlr4';
// @ts-expect-error -- generated JS without type declarations
import SqlLexer from './generated/SqlLexer.js';
// @ts-expect-error -- generated JS without type declarations
import SqlParser from './generated/SqlParser.js';
// @ts-expect-error -- generated JS without type declarations
import SqlParserVisitor from './generated/SqlParserVisitor.js';

/** Result returned by the ANTLR4-based SQL validator. */
export interface Antlr4ValidationResult {
  valid: boolean;
  errors: string[];
  tables: string[];
  columns: string[];
  statementType: 'select' | 'dml' | 'ddl' | 'other' | 'unknown';
}

/** Strip surrounding quotes or backticks from an identifier. */
function stripQuotes(raw: string): string {
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith('`') && raw.endsWith('`'))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyCtx = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Validate SQL using the ANTLR4-generated parser.
 * Parses the input, detects statement type, and extracts table/column references.
 */
export function validateSql(sql: string): Antlr4ValidationResult {
  const errors: string[] = [];

  // Lex
  const chars = new antlr4.CharStream(sql);
  const lexer = new SqlLexer(chars);
  lexer.removeErrorListeners();

  const lexerErrorListener = {
    syntaxError(
      _recognizer: unknown,
      _offendingSymbol: unknown,
      line: number,
      column: number,
      msg: string,
    ) {
      errors.push(`line ${line}:${column} ${msg}`);
    },
  };
  lexer.addErrorListener(lexerErrorListener);

  const tokens = new antlr4.CommonTokenStream(lexer);

  // Parse
  const parser = new SqlParser(tokens);
  parser.removeErrorListeners();

  const parserErrorListener = {
    syntaxError(
      _recognizer: unknown,
      _offendingSymbol: unknown,
      line: number,
      column: number,
      msg: string,
    ) {
      errors.push(`line ${line}:${column} ${msg}`);
    },
  };
  parser.addErrorListener(parserErrorListener);

  let tree;
  try {
    tree = parser.root();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: [`Parse failed: ${msg}`],
      tables: [],
      columns: [],
      statementType: 'unknown',
    };
  }

  // Detect statement type + extract references via visitor
  const tables: string[] = [];
  const columns: string[] = [];
  const statementTypes: string[] = [];

  const visitor = Object.create(SqlParserVisitor.prototype);

  visitor.visitSelectStmt = function (ctx: AnyCtx) {
    statementTypes.push('select');
    return this.visitChildren(ctx);
  };

  visitor.visitDmlStmt = function (ctx: AnyCtx) {
    statementTypes.push('dml');
    return this.visitChildren(ctx);
  };

  visitor.visitDdlStmt = function (ctx: AnyCtx) {
    statementTypes.push('ddl');
    return this.visitChildren(ctx);
  };

  visitor.visitOtherStmt = function (ctx: AnyCtx) {
    statementTypes.push('other');
    return this.visitChildren(ctx);
  };

  /**
   * Extract table name from TableRefContext.
   * Uses the grammar-labeled .tableName().table accessor.
   */
  visitor.visitTableRef = function (ctx: AnyCtx) {
    const tableNameCtx = ctx.tableName();
    if (tableNameCtx?.table) {
      const name = stripQuotes(tableNameCtx.table.getText());
      if (name) tables.push(name);
    }
    return this.visitChildren(ctx);
  };

  /**
   * Extract column reference from ColumnRefContext.
   * Uses grammar-labeled fields: .column, .table (optional).
   */
  visitor.visitColumnRef = function (ctx: AnyCtx) {
    if (ctx.column) {
      const col = stripQuotes(ctx.column.getText());
      if (col) {
        const tbl = ctx.table ? stripQuotes(ctx.table.getText()) : null;
        columns.push(tbl ? `${tbl}.${col}` : col);
      }
    }
    return this.visitChildren(ctx);
  };

  try {
    tree.accept(visitor);
  } catch {
    // Visitor walk failed — fall through with what we have
  }

  // Determine statement type
  let statementType: Antlr4ValidationResult['statementType'] = 'unknown';
  if (statementTypes.length === 1) {
    statementType = statementTypes[0] as Antlr4ValidationResult['statementType'];
  } else if (statementTypes.length > 1) {
    statementType = statementTypes.every((t) => t === 'select') ? 'select' : 'other';
  }

  // Reject non-SELECT
  if (statementType !== 'select' && statementType !== 'unknown') {
    errors.push(
      `Only SELECT statements are allowed, got: ${statementType.toUpperCase()}`,
    );
  }

  return {
    valid: errors.length === 0 && (statementType === 'select' || statementType === 'unknown'),
    errors,
    tables: [...new Set(tables)],
    columns: [...new Set(columns)],
    statementType,
  };
}
