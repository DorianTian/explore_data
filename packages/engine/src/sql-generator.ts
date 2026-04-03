import Anthropic from '@anthropic-ai/sdk';
import type { GenerationContext, GenerationResult } from './types.js';

const SYSTEM_PROMPT = `You are an expert SQL generator. Given a database schema and a natural language question, generate the correct SQL query.

Rules:
1. Only generate SELECT statements. Never generate DDL or DML.
2. Use the exact table and column names from the schema.
3. Use appropriate JOINs based on the provided relationships.
4. Apply appropriate aggregations (SUM, COUNT, AVG, etc.) when the question implies them.
5. Add ORDER BY and LIMIT when the question implies ranking or top-N.
6. Use the correct SQL dialect as specified.
7. If a glossary term is mentioned, use the provided SQL expression.

Respond in JSON format:
{
  "sql": "SELECT ...",
  "explanation": "Brief explanation of the query in the user's language",
  "confidence": 0.0-1.0,
  "tablesUsed": ["table1", "table2"],
  "columnsUsed": ["table1.col1", "table2.col2"]
}`;

export class SqlGenerator {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(context: GenerationContext): Promise<GenerationResult> {
    const userPrompt = this.buildPrompt(context);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as GenerationResult;
      }
    } catch {
      // fallback
    }

    return {
      sql: text,
      explanation: 'Generated SQL query',
      confidence: 0.3,
      tablesUsed: [],
      columnsUsed: [],
    };
  }

  /** Generate a modified SQL based on the previous query and a follow-up instruction */
  async generateFollowUp(
    context: GenerationContext,
    previousSql: string,
    modificationHint: string,
  ): Promise<GenerationResult> {
    const userPrompt = this.buildPrompt(context, previousSql, modificationHint);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as GenerationResult;
      }
    } catch {
      // fallback
    }

    return {
      sql: text,
      explanation: 'Modified SQL query',
      confidence: 0.3,
      tablesUsed: [],
      columnsUsed: [],
    };
  }

  private buildPrompt(
    context: GenerationContext,
    previousSql?: string,
    modificationHint?: string,
  ): string {
    const parts: string[] = [];

    parts.push(`## Database Schema (${context.dialect})\n`);
    parts.push(this.formatSchemaForPrompt(context));

    if (context.glossary.length > 0) {
      parts.push('\n## Business Glossary\n');
      for (const entry of context.glossary) {
        parts.push(`- "${entry.term}" → ${entry.sqlExpression}`);
      }
    }

    if (context.fewShotExamples.length > 0) {
      parts.push('\n## Example Queries\n');
      for (const ex of context.fewShotExamples) {
        parts.push(`Q: ${ex.question}\nA: ${ex.sql}\n`);
      }
    }

    if (previousSql && modificationHint) {
      parts.push(`\n## Previous Query\n\`\`\`sql\n${previousSql}\n\`\`\`\n`);
      parts.push(
        `The user wants to modify this query. Modification: "${modificationHint}"`,
      );
    }

    if (context.conversationHistory.length > 0) {
      parts.push('\n## Conversation History\n');
      for (const turn of context.conversationHistory.slice(-3)) {
        parts.push(`${turn.role}: ${turn.content}`);
        if (turn.sql) parts.push(`[SQL: ${turn.sql}]`);
      }
    }

    parts.push(`\n## Question\n${context.userQuery}`);

    return parts.join('\n');
  }

  private formatSchemaForPrompt(context: GenerationContext): string {
    const parts: string[] = [];

    for (const table of context.schema.tables) {
      const colDefs = table.columns.map((col) => {
        let def = `  ${col.name} ${col.dataType}`;
        if (col.isPrimaryKey) def += ' PRIMARY KEY';
        if (col.comment) def += ` -- ${col.comment}`;
        if (col.sampleValues && col.sampleValues.length > 0) {
          def += `, e.g. ${col.sampleValues.slice(0, 3).map((v) => `'${v}'`).join(', ')}`;
        }
        return def;
      });

      let header = '';
      if (table.comment) header = `-- ${table.comment}\n`;
      parts.push(`${header}CREATE TABLE ${table.name} (\n${colDefs.join(',\n')}\n);`);
    }

    if (context.schema.relationships.length > 0) {
      parts.push('\n-- Relationships:');
      for (const rel of context.schema.relationships) {
        parts.push(
          `-- ${rel.fromTable}.${rel.fromColumn} -> ${rel.toTable}.${rel.toColumn}`,
        );
      }
    }

    return parts.join('\n\n');
  }
}
