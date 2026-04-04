import Anthropic from '@anthropic-ai/sdk';
import { extractText, extractJson, withRetry } from './llm-utils.js';
import { MODEL, TIMEOUT } from './config.js';

export interface DecomposedQuery {
  isComplex: boolean;
  subQueries: Array<{
    step: number;
    description: string;
    dependsOn: number[];
  }>;
  mergeStrategy: 'join' | 'union' | 'subquery' | 'cte' | 'single';
}

const DECOMPOSE_PROMPT = `你是一个 SQL 查询分解专家。判断用户的查询是否需要拆解为多个子步骤。

## 判断规则

简单查询（不需要拆解）：
- 单表聚合（如"用户总数"）
- 单维度分组（如"按渠道统计GMV"）
- 简单条件过滤

复杂查询（需要拆解）：
- 涉及对比/同比/环比（需要多个时间范围的数据）
- 涉及排名后再过滤（如"销量前10的商品的退款率"）
- 涉及多个独立指标合并（如"用户数、订单数、GMV的日趋势"）
- 嵌套逻辑（如"消费超过平均值的用户"）

## 输出格式

返回 JSON:
{
  "isComplex": boolean,
  "subQueries": [
    { "step": 1, "description": "查询描述", "dependsOn": [] },
    { "step": 2, "description": "查询描述", "dependsOn": [1] }
  ],
  "mergeStrategy": "join" | "union" | "subquery" | "cte" | "single"
}

如果不需要拆解，返回 { "isComplex": false, "subQueries": [{ "step": 1, "description": "原始查询", "dependsOn": [] }], "mergeStrategy": "single" }`;

export class QueryDecomposer {
  private client: Anthropic;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
    });
  }

  async decompose(userQuery: string): Promise<DecomposedQuery> {
    const response = await withRetry(
      () =>
        this.client.messages.create(
          {
            model: MODEL.classification,
            max_tokens: 500,
            system: DECOMPOSE_PROMPT,
            messages: [{ role: 'user', content: userQuery }],
          },
          { timeout: TIMEOUT.fast },
        ),
      { label: 'QueryDecomposer' },
    );

    const text = extractText(response);
    const parsed = extractJson<DecomposedQuery>(text);

    return (
      parsed ?? {
        isComplex: false,
        subQueries: [{ step: 1, description: userQuery, dependsOn: [] }],
        mergeStrategy: 'single',
      }
    );
  }
}
