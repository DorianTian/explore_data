import Anthropic from '@anthropic-ai/sdk';
import type { SchemaContext } from './types.js';
import { extractText, extractJson, withRetry } from './llm-utils.js';
import { MODEL, TIMEOUT } from './config.js';

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
  async rerank(userQuery: string, schema: SchemaContext): Promise<SchemaContext> {
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

    const response = await withRetry(
      () =>
        this.client.messages.create(
          {
            model: MODEL.classification,
            max_tokens: 300,
            system: RERANK_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          },
          { timeout: TIMEOUT.fast },
        ),
      { label: 'SchemaReranker' },
    );

    const text = extractText(response);
    const result = extractJson<{ tables: string[] }>(text);

    if (result && result.tables.length > 0) {
      const selectedTables = new Set(result.tables.map((t) => t.toLowerCase()));

      const filtered: SchemaContext = {
        tables: schema.tables.filter((t) => selectedTables.has(t.name.toLowerCase())),
        relationships: schema.relationships.filter(
          (r) =>
            selectedTables.has(r.fromTable.toLowerCase()) &&
            selectedTables.has(r.toTable.toLowerCase()),
        ),
      };

      return filtered.tables.length > 0 ? filtered : schema;
    }

    return schema;
  }
}
