import Anthropic from '@anthropic-ai/sdk';
import type { GenerationContext, GenerationResult } from './types.js';

const SYSTEM_PROMPT = `你是一个专业的 SQL 生成专家。根据数据库 schema 和用户的自然语言问题，生成准确的 SQL 查询。

## 核心规则

1. **只生成 SELECT 语句**，绝不生成 DDL 或 DML
2. **严格使用 schema 中定义的表名和列名**，不要编造不存在的表或列
3. **根据表关系使用正确的 JOIN**，确保 JOIN 条件准确
4. **智能推断聚合逻辑**：当问题涉及"总数"、"平均"、"最大"等词时，使用对应的聚合函数
5. **时间处理**：自动推断时间范围，使用标准日期函数
6. **排序和限制**：当问题涉及"Top N"、"最多"、"排名"时，添加 ORDER BY + LIMIT
7. **使用业务术语表**：如果用户提到的术语在术语表中有定义，直接使用对应的 SQL 表达式
8. **SQL 风格**：关键字大写，表名和列名保持原样，适当缩进

## 输出格式

严格返回 JSON：
{
  "sql": "SELECT ...",
  "explanation": "用中文简要解释这条查询的逻辑",
  "confidence": 0.0-1.0,
  "tablesUsed": ["table1"],
  "columnsUsed": ["table1.col1"]
}

## 注意事项

- confidence < 0.5 时，在 explanation 中说明不确定的原因
- 如果用户的问题模糊，生成最合理的解释并在 explanation 中补充假设
- 多表查询时，优先使用 INNER JOIN 除非逻辑上需要 LEFT JOIN
- 始终添加合理的 LIMIT（默认 100）防止返回过多数据
- 字符串比较使用 LIKE 而非精确匹配，除非用户明确要求精确`;

export class SqlGenerator {
  private client: Anthropic;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
    });
  }

  async generate(context: GenerationContext): Promise<GenerationResult> {
    const userPrompt = this.buildPrompt(context);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    return this.parseResponse(response);
  }

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

    return this.parseResponse(response);
  }

  private parseResponse(
    response: Anthropic.Message,
  ): GenerationResult {
    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sql: parsed.sql ?? '',
          explanation: parsed.explanation ?? '已生成 SQL 查询',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          tablesUsed: Array.isArray(parsed.tablesUsed) ? parsed.tablesUsed : [],
          columnsUsed: Array.isArray(parsed.columnsUsed) ? parsed.columnsUsed : [],
        };
      }
    } catch {
      // JSON parse failed, try to extract SQL directly
    }

    // Fallback: try to extract SQL from markdown code block
    const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
    if (sqlMatch) {
      return {
        sql: sqlMatch[1].trim(),
        explanation: '已生成 SQL 查询',
        confidence: 0.3,
        tablesUsed: [],
        columnsUsed: [],
      };
    }

    return {
      sql: text.trim(),
      explanation: '生成结果可能需要人工确认',
      confidence: 0.2,
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

    // Schema section — formatted as DDL (LLM-friendly)
    parts.push(`## 数据库 Schema（${context.dialect}）\n`);
    parts.push(this.formatSchema(context));

    // Glossary section
    if (context.glossary.length > 0) {
      parts.push('\n## 业务术语表\n');
      for (const entry of context.glossary) {
        parts.push(`- 「${entry.term}」→ \`${entry.sqlExpression}\``);
      }
    }

    // Few-shot examples from data flywheel
    if (context.fewShotExamples.length > 0) {
      parts.push('\n## 参考示例（来自历史查询）\n');
      for (const ex of context.fewShotExamples) {
        parts.push(`问题: ${ex.question}`);
        parts.push(`SQL: ${ex.sql}\n`);
      }
    }

    // Follow-up context
    if (previousSql && modificationHint) {
      parts.push(`\n## 上一条查询\n\`\`\`sql\n${previousSql}\n\`\`\`\n`);
      parts.push(`用户希望在此基础上修改：「${modificationHint}」`);
      parts.push('请基于上一条 SQL 进行修改，而非从头生成。');
    }

    // Conversation history
    if (context.conversationHistory.length > 0) {
      parts.push('\n## 对话历史\n');
      for (const turn of context.conversationHistory.slice(-4)) {
        const roleLabel = turn.role === 'user' ? '用户' : '系统';
        parts.push(`${roleLabel}: ${turn.content}`);
        if (turn.sql) parts.push(`[SQL: ${turn.sql}]`);
      }
    }

    // The actual question
    parts.push(`\n## 用户问题\n${context.userQuery}`);

    return parts.join('\n');
  }

  private formatSchema(context: GenerationContext): string {
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
      parts.push(
        `${header}CREATE TABLE ${table.name} (\n${colDefs.join(',\n')}\n);`,
      );
    }

    if (context.schema.relationships.length > 0) {
      parts.push('\n-- 表间关系:');
      for (const rel of context.schema.relationships) {
        parts.push(
          `-- ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}`,
        );
      }
    }

    return parts.join('\n\n');
  }
}
