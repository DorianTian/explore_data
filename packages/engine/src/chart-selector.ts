import Anthropic from '@anthropic-ai/sdk';
import type { ChartType } from './chart-recommender.js';
import { extractText, extractJson, withRetry } from './llm-utils.js';
import { MODEL, TIMEOUT } from './config.js';

const CHART_PROMPT = `你是一个数据可视化专家。根据用户的查询意图和返回的数据结构，推荐最合适的图表类型。

## 可选图表类型

- kpi: 单个数字指标（如"总用户数"）
- bar: 柱状图（分类对比）
- horizontal_bar: 条形图（类目多时）
- line: 折线图（时间趋势）
- multi_line: 多线图（多指标趋势对比）
- scatter: 散点图（两个数值变量的关系）
- grouped_bar: 分组柱状图（多维度分类对比）
- pie: 饼图（占比分布，≤5个类目）
- table: 表格（明细数据或无法可视化的数据）

## 判断规则

1. 用户问"趋势""变化""走势" → line / multi_line
2. 用户问"对比""差异""排名" → bar / horizontal_bar
3. 用户问"占比""分布""比例" → pie（≤5类）或 bar
4. 用户问"多少""总共""数量" + 只有一个数字 → kpi
5. 用户问"明细""列表""详情" → table
6. 有时间列 + 数值列 → line 优先
7. 有分类列 + 多个数值列 → grouped_bar
8. 类目超过 7 个 → horizontal_bar 而非 bar

## 输出格式

返回 JSON: { "chartType": "bar", "reason": "理由" }`;

export class ChartSelector {
  private client: Anthropic;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
    });
  }

  async select(
    userQuery: string,
    columns: Array<{ name: string; dataType: string }>,
    rowCount: number,
  ): Promise<{ chartType: ChartType; reason: string }> {
    const colDesc = columns.map((c) => `${c.name} (${c.dataType})`).join(', ');

    const response = await withRetry(
      () =>
        this.client.messages.create(
          {
            model: MODEL.classification,
            max_tokens: 200,
            system: CHART_PROMPT,
            messages: [
              {
                role: 'user',
                content: `查询: "${userQuery}"\n返回列: ${colDesc}\n行数: ${rowCount}`,
              },
            ],
          },
          { timeout: TIMEOUT.chart },
        ),
      { label: 'ChartSelector' },
    );

    const text = extractText(response);
    const result = extractJson<{ chartType: string; reason?: string }>(text);

    if (result) {
      return {
        chartType: result.chartType as ChartType,
        reason: result.reason ?? '',
      };
    }

    return { chartType: 'table', reason: 'default' };
  }
}
