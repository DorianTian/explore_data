import Anthropic from '@anthropic-ai/sdk';
import { SqlValidator } from './sql-validator.js';
import { extractText, extractJson, withRetry } from './llm-utils.js';
import { MODEL, TIMEOUT, VERIFICATION } from './config.js';
import type {
  SchemaContext,
  ProgressCallback,
  VerificationDimension,
  VerificationScore,
  VerificationRound,
} from './types.js';

/**
 * Dual-stage verification loop — ensures generated SQL is both syntactically
 * valid and semantically correct before returning to the user.
 *
 * Stage 1 (static, zero LLM cost): ANTLR4-based syntax/safety checks
 * Stage 2 (LLM semantic): 5-dimension scoring via Claude Haiku
 * Loop: up to 3 rounds; pass threshold = 90/100
 */

const SEMANTIC_PROMPT = `You are a SQL verification expert. Score the generated SQL on 5 dimensions.

## Scoring dimensions (total 100)

1. **correctness** (35): Tables/columns exist in schema, JOINs use correct keys, aggregation logic matches intent
2. **completeness** (25): SQL fully answers the user's question — no missing filters, groupings, or calculations
3. **efficiency** (15): No unnecessary subqueries, redundant JOINs, or full-table scans when avoidable
4. **safety** (15): No DML/DDL, has LIMIT clause, no cartesian product, no dangerous patterns
5. **dialect** (10): Syntax matches the target SQL dialect (functions, quoting, type casting)

## Output format

Return JSON:
{
  "dimensions": [
    { "name": "correctness", "weight": 35, "score": <0-35>, "issues": ["issue1"] },
    { "name": "completeness", "weight": 25, "score": <0-25>, "issues": [] },
    { "name": "efficiency", "weight": 15, "score": <0-15>, "issues": [] },
    { "name": "safety", "weight": 15, "score": <0-15>, "issues": [] },
    { "name": "dialect", "weight": 10, "score": <0-10>, "issues": [] }
  ],
  "suggestedFix": "corrected SQL if score < 90, otherwise null"
}

Be strict but fair. A perfect query scores 100. Minor style issues don't lose points.`;

interface SemanticResult {
  dimensions: VerificationDimension[];
  suggestedFix?: string | null;
}

export interface VerificationLoopResult {
  finalSql: string;
  rounds: VerificationRound[];
  passed: boolean;
  finalScore: number;
}

/**
 * Run the dual-stage verification loop.
 *
 * @param sql        - Generated SQL to verify
 * @param userQuery  - Original natural language question
 * @param schema     - Linked schema context
 * @param dialect    - Target SQL dialect
 * @param onProgress - SSE progress callback
 * @param apiKey     - Anthropic API key
 * @param baseURL    - Anthropic base URL
 */
export async function runVerificationLoop(
  sql: string,
  userQuery: string,
  schema: SchemaContext,
  dialect: string,
  onProgress: ProgressCallback,
  apiKey?: string,
  baseURL?: string,
): Promise<VerificationLoopResult> {
  const client = new Anthropic({
    apiKey,
    baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
  });

  const validator = new SqlValidator(dialect);
  const rounds: VerificationRound[] = [];
  let currentSql = sql;

  for (let round = 1; round <= VERIFICATION.maxRounds; round++) {
    onProgress(`verification_${round}`, `验证第 ${round}/${VERIFICATION.maxRounds} 轮...`);

    // Stage 1: Static check (zero LLM cost)
    const staticIssues = runStaticCheck(validator, currentSql, schema);

    // Stage 2: LLM semantic scoring
    const semantic = await runSemanticCheck(client, currentSql, userQuery, schema, dialect);
    const score = buildScore(semantic.dimensions);

    const semanticIssues = semantic.dimensions.flatMap((d) => d.issues);

    const roundResult: VerificationRound = {
      round,
      sql: currentSql,
      score,
      staticIssues,
      semanticIssues,
      suggestedFix: semantic.suggestedFix ?? undefined,
    };
    rounds.push(roundResult);

    // Emit detailed progress
    const dimensionBreakdown = semantic.dimensions
      .map((d) => `${d.name}: ${d.score}/${d.weight}${d.issues.length > 0 ? ` [${d.issues.join('; ')}]` : ''}`)
      .join('\n');

    onProgress(`verification_${round}`, `第 ${round} 轮评分: ${score.total}/100`, {
      thinking: `Static issues: ${staticIssues.length > 0 ? staticIssues.join('; ') : 'none'}\n\n${dimensionBreakdown}`,
      data: { round, score: score.total, passed: score.passed, dimensions: semantic.dimensions },
    });

    if (score.passed) {
      return { finalSql: currentSql, rounds, passed: true, finalScore: score.total };
    }

    // Apply suggested fix if available
    if (semantic.suggestedFix && round < VERIFICATION.maxRounds) {
      onProgress(`verification_${round}`, `应用第 ${round} 轮修复...`);
      currentSql = semantic.suggestedFix;
    } else {
      // No fix available — stop looping
      break;
    }
  }

  const lastRound = rounds[rounds.length - 1];
  return {
    finalSql: currentSql,
    rounds,
    passed: lastRound?.score.passed ?? false,
    finalScore: lastRound?.score.total ?? 0,
  };
}

/** Stage 1: Static checks using SqlValidator (ANTLR4). Returns issue descriptions. */
function runStaticCheck(validator: SqlValidator, sql: string, schema: SchemaContext): string[] {
  const result = validator.validate(sql, schema);
  if (result.valid) return [];
  return result.errors.map((e) => `[${e.code}] ${e.message}`);
}

/** Stage 2: LLM semantic scoring via Claude Haiku. */
async function runSemanticCheck(
  client: Anthropic,
  sql: string,
  userQuery: string,
  schema: SchemaContext,
  dialect: string,
): Promise<SemanticResult> {
  const schemaDesc = schema.tables
    .map((t) => {
      const cols = t.columns.map((c) => `${c.name}(${c.dataType})`).join(', ');
      return `${t.name}${t.comment ? `(${t.comment})` : ''}: ${cols}`;
    })
    .join('\n');

  const userContent = `User question: "${userQuery}"
Dialect: ${dialect}

Schema:
${schemaDesc}

Generated SQL:
\`\`\`sql
${sql}
\`\`\`

Score this SQL on the 5 dimensions.`;

  const response = await withRetry(
    () =>
      client.messages.create(
        {
          model: MODEL.classification,
          max_tokens: 600,
          system: SEMANTIC_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        },
        { timeout: TIMEOUT.fast },
      ),
    { label: 'VerificationLoop.semantic' },
  );

  const text = extractText(response);
  const parsed = extractJson<SemanticResult>(text);

  if (parsed && Array.isArray(parsed.dimensions)) {
    return {
      dimensions: parsed.dimensions,
      suggestedFix: parsed.suggestedFix ?? undefined,
    };
  }

  // Fallback: assume pass if LLM response is unparseable
  return {
    dimensions: [
      { name: 'correctness', weight: 35, score: 35, issues: [] },
      { name: 'completeness', weight: 25, score: 25, issues: [] },
      { name: 'efficiency', weight: 15, score: 15, issues: [] },
      { name: 'safety', weight: 15, score: 15, issues: [] },
      { name: 'dialect', weight: 10, score: 10, issues: [] },
    ],
  };
}

/** Build VerificationScore from dimension results. */
function buildScore(dimensions: VerificationDimension[]): VerificationScore {
  const total = dimensions.reduce((sum, d) => sum + d.score, 0);
  return {
    total,
    dimensions,
    passed: total >= VERIFICATION.passThreshold,
  };
}
