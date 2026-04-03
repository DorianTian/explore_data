import type { DdlParseResult } from '@nl2sql/shared';

/**
 * Regex-based DDL parser for CREATE TABLE statements.
 * Handles MySQL and PostgreSQL dialects including comments, FK, quoted identifiers.
 * Will be replaced by ANTLR4 in Phase 4 for full query validation.
 */
export class DdlParser {
  parse(ddl: string): DdlParseResult | null {
    const cleaned = ddl.trim();
    if (!/CREATE\s+TABLE/i.test(cleaned)) return null;

    const tableName = this.extractTableName(cleaned);
    if (!tableName) return null;

    const bodyMatch = cleaned.match(/\((.+)\)/s);
    if (!bodyMatch) return null;

    const lines = this.splitColumnDefinitions(bodyMatch[1]);
    const tableLevelPks = this.extractTableLevelPrimaryKeys(lines);
    const tableLevelFks = this.extractTableLevelForeignKeys(lines);
    const columnLines = lines.filter((line) => !this.isConstraintLine(line));

    const columns = columnLines.map((line) => this.parseColumnLine(line, tableLevelPks));
    const inlineFks = columnLines.flatMap((line, i) =>
      this.extractInlineForeignKey(line, columns[i]?.name),
    );

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

  parseMultiple(ddl: string): DdlParseResult[] {
    const statements = ddl.split(/;\s*(?=CREATE\s+TABLE)/i);
    const results: DdlParseResult[] = [];

    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;

      const remainingAfterCreate = ddl.substring(ddl.indexOf(trimmed));
      const result = this.parse(remainingAfterCreate.split(/;\s*(?=CREATE\s+TABLE)/i)[0] + ';');
      if (!result) {
        const fallback = this.parse(trimmed.endsWith(';') ? trimmed : trimmed + ';');
        if (fallback) results.push(fallback);
      } else {
        results.push(result);
      }
    }

    return results;
  }

  private extractTableName(ddl: string): string | null {
    const match = ddl.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["'`]?([\w-]+)["'`]?\.)?["'`]?([\w\s-]+?)["'`]?\s*\(/i,
    );
    return match ? match[2].trim() : null;
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
    const nameMatch = line.match(/^["'`]([\w][\w\s-]*)["'`]\s+(.+)/i)
      ?? line.match(/^(\w+)\s+(.+)/i);
    if (!nameMatch) {
      return {
        name: line.trim(),
        dataType: 'UNKNOWN',
        comment: null,
        isPrimaryKey: false,
        isNullable: true,
      };
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
    const cleaned = rest
      .replace(/\bPRIMARY\s+KEY\b/gi, '')
      .replace(/\bNOT\s+NULL\b/gi, '')
      .replace(/\bNULL\b/gi, '')
      .replace(/\bAUTO_INCREMENT\b/gi, '')
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
    const match = ddl.match(
      /\)\s*(?:ENGINE\s*=\s*\w+\s*)?COMMENT\s*=\s*['"]([^'"]*)['"]/i,
    );
    return match ? match[1] : null;
  }

  private extractTableLevelPrimaryKeys(lines: string[]): Set<string> {
    const pks = new Set<string>();
    for (const line of lines) {
      const match = line.match(/^\s*PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (match) {
        match[1]
          .split(',')
          .forEach((col) => pks.add(col.trim().replace(/["'`]/g, '').toLowerCase()));
      }
    }
    return pks;
  }

  private extractTableLevelForeignKeys(lines: string[]): DdlParseResult['foreignKeys'] {
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
    return [
      { column: columnName, referencedTable: match[1], referencedColumn: match[2] },
    ];
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
      new RegExp(
        `COMMENT\\s+ON\\s+TABLE\\s+["'\`]?${tableName}["'\`]?\\s+IS\\s+'([^']*)'`,
        'i',
      ),
    );
    if (tableCommentMatch) result.table = tableCommentMatch[1];

    const colRegex = new RegExp(
      `COMMENT\\s+ON\\s+COLUMN\\s+["'\`]?${tableName}["'\`]?\\.["'\`]?(\\w+)["'\`]?\\s+IS\\s+'([^']*)'`,
      'gi',
    );
    let match;
    while ((match = colRegex.exec(ddl)) !== null) {
      result.columns[match[1]] = match[2];
    }

    return result;
  }
}
