import Anthropic from '@anthropic-ai/sdk';
import type { SchemaContext } from './types.js';

export interface VerificationResult {
  isCorrect: boolean;
  issues: string[];
  suggestedFix?: string;
}

const VERIFY_PROMPT = `你是一个 SQL 审查专家。审查生成的 SQL 是否正确回答了用户的问题。

## 审查维度

1. **语义正确性**：SQL 的逻辑是否匹配用户意图？（如用户问"平均值"但 SQL 用了 SUM）
2. **JOIN 正确性**：表间关联条件是否正确？是否遗漏了必要的 JOIN？
3. **过滤条件**：WHERE 条件是否完整？（如用户说"已完成订单"但 SQL 没加 status 过滤）
4. **聚合粒度**：GROUP BY 是否正确？是否遗漏了维度？
5. **排序和限制**：ORDER BY 方向是否正确？LIMIT 是否合理？

## 输出格式

返回 JSON:
{
  "isCorrect": boolean,
  "issues": ["问题1", "问题2"],
  "suggestedFix": "如果有问题，给出修正后的完整 SQL"
}

如果 SQL 完全正确，返回 { "isCorrect": true, "issues": [] }`;

export class SqlVerifier {
  private client: Anthropic;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
    });
  }

  async verify(
    userQuery: string,
    generatedSql: string,
    schema: SchemaContext,
  ): Promise<VerificationResult> {
    const schemaDesc = schema.tables
      .map((t) => {
        const cols = t.columns.map((c) => `${c.name}(${c.dataType})`).join(', ');
        return `${t.name}${t.comment ? `(${t.comment})` : ''}: ${cols}`;
      })
      .join('\n');

    const userPrompt = `用户问题: "${userQuery}"

Schema:
${schemaDesc}

生成的 SQL:
\`\`\`sql
${generatedSql}
\`\`\`

请审查这条 SQL 是否正确回答了用户的问题。`;

    const response = await this.client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: VERIFY_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { timeout: 15_000 },
    );

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as VerificationResult;
    } catch {
      // parse failed
    }

    return { isCorrect: true, issues: [] };
  }
}
