import Anthropic from '@anthropic-ai/sdk';
import { extractText, extractJson, withRetry } from './llm-utils.js';
import { MODEL, TIMEOUT } from './config.js';
import type { ChartConfig } from './types.js';

const CHART_PROMPT = `You are a data visualization expert. Recommend the best chart type and field mappings based on three signals: user intent, SQL structure, and a data sample.

## Available chart types

- metric_card: single KPI number (e.g. "total revenue")
- line: time-series trend (1 time axis + 1-2 metrics)
- area: filled line chart (cumulative or stacked trends)
- bar: vertical bar (categorical comparison, <= 7 categories)
- horizontal_bar: horizontal bar (> 7 categories or long labels)
- grouped_bar: multi-metric categorical comparison
- pie: proportion / distribution (<= 5 categories)
- scatter: correlation between two numeric variables
- heatmap: two categorical axes + numeric intensity
- table: detail data or no clear visualization fit

## Decision rules

1. User asks "trend" / "over time" / "变化" / "走势" → line or area
2. User asks "compare" / "ranking" / "对比" / "排名" → bar / horizontal_bar
3. User asks "share" / "distribution" / "占比" / "分布" → pie (<=5 cat) or bar
4. Single numeric result, no grouping → metric_card
5. Two numeric columns, no time → scatter
6. Detail / list query → table
7. Time column + 1 numeric → line; Time + N numeric → line with multiple yField
8. Category + N numeric → grouped_bar
9. > 7 categories → horizontal_bar over bar

## Output format

Return JSON:
{
  "chartType": "bar",
  "title": "Short descriptive title",
  "xField": "column_for_x_axis",
  "yField": ["metric1", "metric2"],
  "categoryField": "optional_grouping_column",
  "valueField": "optional_single_value_column",
  "series": [{ "name": "Series Name", "field": "column", "type": "bar" }],
  "sort": "desc",
  "limit": 10,
  "stacked": false
}

Only include fields that apply. For metric_card, use valueField. For pie, use categoryField + valueField.`;

/**
 * LLM-driven chart selector — uses user intent, SQL structure, and data sample
 * to recommend the optimal chart type with full field mappings.
 */
export class ChartSelector {
  private client: Anthropic;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
    });
  }

  /**
   * Select chart type and build ChartConfig from three signals.
   *
   * @param userQuery  - Original natural language question
   * @param sql        - Generated SQL
   * @param columns    - Result column metadata
   * @param sampleRows - First 5 rows of execution result
   */
  async select(
    userQuery: string,
    sql: string,
    columns: Array<{ name: string; dataType: string }>,
    sampleRows: Record<string, unknown>[],
  ): Promise<ChartConfig> {
    const colDesc = columns.map((c) => `${c.name} (${c.dataType})`).join(', ');
    const samplePreview = JSON.stringify(sampleRows.slice(0, 5), null, 0).slice(0, 1500);

    const response = await withRetry(
      () =>
        this.client.messages.create(
          {
            model: MODEL.classification,
            max_tokens: 400,
            system: CHART_PROMPT,
            messages: [
              {
                role: 'user',
                content: `User query: "${userQuery}"

SQL:
\`\`\`sql
${sql}
\`\`\`

Columns: ${colDesc}
Row count: ${sampleRows.length}

Sample data (first 5 rows):
${samplePreview}`,
              },
            ],
          },
          { timeout: TIMEOUT.chart },
        ),
      { label: 'ChartSelector' },
    );

    const text = extractText(response);
    const result = extractJson<ChartConfig>(text);

    if (result && result.chartType) {
      return result;
    }

    // Fallback: table with auto-generated title
    return {
      chartType: 'table',
      title: userQuery.slice(0, 50),
    };
  }
}
