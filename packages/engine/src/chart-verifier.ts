import Anthropic from '@anthropic-ai/sdk';
import { extractText, extractJson, withRetry } from './llm-utils.js';
import { MODEL, TIMEOUT } from './config.js';
import type { ChartConfig } from './types.js';

const VERIFY_CHART_PROMPT = `You are a data visualization QA expert. Verify whether the recommended chart configuration is optimal for the given data.

## Scoring dimensions (total 100)

1. **type_fit** (40): Is this chart type the best choice for the data shape and user intent?
2. **field_mapping** (30): Are xField, yField, categoryField, series mapped to the correct columns?
3. **readability** (20): Will the chart be readable? (not too many categories for pie, not too many series, etc.)
4. **fallback** (10): If the data doesn't fit well, did it correctly fall back to table?

## Output format

Return JSON:
{
  "total": <0-100>,
  "dimensions": [
    { "name": "type_fit", "score": <0-40>, "issues": [] },
    { "name": "field_mapping", "score": <0-30>, "issues": [] },
    { "name": "readability", "score": <0-20>, "issues": [] },
    { "name": "fallback", "score": <0-10>, "issues": [] }
  ],
  "suggestedFix": { ...corrected ChartConfig if score < 90... } or null
}`;

interface ChartVerifyDimension {
  name: string;
  score: number;
  issues: string[];
}

interface ChartVerifyResult {
  total: number;
  dimensions: ChartVerifyDimension[];
  suggestedFix?: ChartConfig | null;
}

export interface ChartVerificationResult {
  score: number;
  passed: boolean;
  dimensions: ChartVerifyDimension[];
  suggestedFix?: ChartConfig;
}

/**
 * Single-round LLM verification for chart configuration.
 * Returns a score and optional suggestedFix if score < 90.
 */
export async function verifyChart(
  chartConfig: ChartConfig,
  userQuery: string,
  sql: string,
  columns: Array<{ name: string; dataType: string }>,
  sampleRows: Record<string, unknown>[],
  apiKey?: string,
  baseURL?: string,
): Promise<ChartVerificationResult> {
  const client = new Anthropic({
    apiKey,
    baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
  });

  const colDesc = columns.map((c) => `${c.name} (${c.dataType})`).join(', ');
  const samplePreview = JSON.stringify(sampleRows.slice(0, 5), null, 0).slice(0, 1500);

  const response = await withRetry(
    () =>
      client.messages.create(
        {
          model: MODEL.classification,
          max_tokens: 500,
          system: VERIFY_CHART_PROMPT,
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

Sample data:
${samplePreview}

Recommended chart config:
${JSON.stringify(chartConfig, null, 2)}

Score this chart recommendation.`,
            },
          ],
        },
        { timeout: TIMEOUT.chart },
      ),
    { label: 'ChartVerifier' },
  );

  const text = extractText(response);
  const parsed = extractJson<ChartVerifyResult>(text);

  if (parsed && typeof parsed.total === 'number') {
    return {
      score: parsed.total,
      passed: parsed.total >= 90,
      dimensions: parsed.dimensions ?? [],
      suggestedFix: parsed.suggestedFix ?? undefined,
    };
  }

  // Fallback: assume pass if unparseable
  return { score: 100, passed: true, dimensions: [] };
}
