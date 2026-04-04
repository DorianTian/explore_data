import Anthropic from '@anthropic-ai/sdk';
import type { SchemaContext } from './types.js';

const RERANK_PROMPT = `你是一个数据库 Schema 匹配专家。给定用户的查询和候选的表/列列表，判断哪些表和列是回答这个查询真正需要的。

## 规则

1. 只保留与查询直接相关的表和列
2. 保留 JOIN 需要的 FK 列（即使用户没直接提到）
3. 保留 WHERE 条件需要的列
4. 删除无关的列（如用户问"销售额"就不需要"手机号"）

## 输出格式

返回 JSON:
{
  "tables": ["table1", "table2"],
  "reason": "简要说明为什么选这些表"
}`;

/**
 * Schema Reranker — uses LLM to refine embedding recall results.
 *
 * Two-stage schema linking:
 * Stage 1 (embedding): recall top-30 columns by vector similarity (done in SchemaLinker)
 * Stage 2 (LLM rerank): this module refines to only truly relevant tables
 */
export class SchemaReranker {
  private client: Anthropic;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
    });
  }

  /**
   * Rerank schema tables — filter embedding recall results using LLM judgment.
   * Only called for large schemas where embedding recall may include false positives.
   */
  async rerank(
    userQuery: string,
    schema: SchemaContext,
  ): Promise<SchemaContext> {
    // For small schemas (≤5 tables), skip reranking
    if (schema.tables.length <= 5) return schema;

    const tableDescriptions = schema.tables.map((t) => {
      const cols = t.columns.map((c) => {
        let desc = `${c.name}(${c.dataType})`;
        if (c.comment) desc += ` — ${c.comment}`;
        return desc;
      });
      let header = t.name;
      if (t.comment) header += ` — ${t.comment}`;
      return `${header}: ${cols.join(', ')}`;
    });

    const userPrompt = `用户查询: "${userQuery}"\n\n候选表:\n${tableDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;

    const response = await this.client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: RERANK_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { timeout: 15_000 },
    );

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]) as { tables: string[] };
        const selectedTables = new Set(result.tables.map((t) => t.toLowerCase()));

        if (selectedTables.size > 0) {
          const filtered: SchemaContext = {
            tables: schema.tables.filter((t) =>
              selectedTables.has(t.name.toLowerCase()),
            ),
            relationships: schema.relationships.filter(
              (r) =>
                selectedTables.has(r.fromTable.toLowerCase()) &&
                selectedTables.has(r.toTable.toLowerCase()),
            ),
          };

          return filtered.tables.length > 0 ? filtered : schema;
        }
      }
    } catch {
      // Rerank failed, return original
    }

    return schema;
  }
}
