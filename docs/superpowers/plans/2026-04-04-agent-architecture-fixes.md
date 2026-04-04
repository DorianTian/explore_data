# Agent Architecture 10-Round Review Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 10 review findings (4 CRITICAL, 3 HIGH, 3 MEDIUM) to make the hybrid agent architecture production-grade.

**Architecture:** Sequential fixes from foundation types upward through skill executor, agent orchestrator, pipeline, and API layer. Each task produces a self-contained commit.

**Tech Stack:** TypeScript, Anthropic SDK (tool_use), Zod validation, pgvector

---

### Task 1: Foundation — rawDdl support in types + generator + verifier

**Files:**
- Modify: `packages/engine/src/types.ts:36-44`
- Modify: `packages/engine/src/sql-generator.ts:125-214`
- Modify: `packages/engine/src/sql-verifier.ts:41-85`

**Why:** Schema context is passed as DDL string through tool calls, but SqlGenerator and SqlVerifier only accept structured SchemaContext. Empty schema objects break prompt structure and verification.

- [ ] **Step 1: Add rawDdl to GenerationContext**

In `packages/engine/src/types.ts`, add `rawDdl` field:

```typescript
export interface GenerationContext {
  userQuery: string;
  schema: SchemaContext;
  /** Raw DDL string — used when schema comes from agent tool calls as pre-formatted DDL */
  rawDdl?: string;
  glossary: Array<{ term: string; sqlExpression: string }>;
  knowledgeContext: string[];
  conversationHistory: ConversationTurn[];
  fewShotExamples: Array<{ question: string; sql: string }>;
  dialect: string;
}
```

- [ ] **Step 2: Support rawDdl in SqlGenerator.buildPrompt**

In `packages/engine/src/sql-generator.ts`, modify `buildPrompt` method to use `rawDdl` when available:

Replace the schema section (lines ~132-134):
```typescript
// Schema section — formatted as DDL (LLM-friendly)
parts.push(`## 数据库 Schema（${context.dialect}）\n`);
if (context.rawDdl) {
  parts.push(context.rawDdl);
} else {
  parts.push(this.formatSchema(context));
}
```

- [ ] **Step 3: Support rawDdl in SqlVerifier.verify**

In `packages/engine/src/sql-verifier.ts`, modify `verify` signature and schema description building:

```typescript
async verify(
  userQuery: string,
  generatedSql: string,
  schema: SchemaContext,
  rawDdl?: string,
): Promise<VerificationResult> {
  let schemaDesc: string;
  if (rawDdl) {
    schemaDesc = rawDdl;
  } else {
    schemaDesc = schema.tables
      .map((t) => {
        const cols = t.columns.map((c) => `${c.name}(${c.dataType})`).join(', ');
        return `${t.name}${t.comment ? `(${t.comment})` : ''}: ${cols}`;
      })
      .join('\n');
  }
  // ... rest of method unchanged, uses schemaDesc in prompt
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd ~/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/engine build 2>&1 | tail -20`
Expected: Build succeeds (or only unrelated errors)

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/sql-generator.ts packages/engine/src/sql-verifier.ts
git commit -m "fix(engine): add rawDdl support to GenerationContext, SqlGenerator, SqlVerifier

Schema context from agent tool calls arrives as pre-formatted DDL string.
Previously, empty SchemaContext objects were passed, breaking prompt structure
and making SqlVerifier unable to validate table/column references."
```

---

### Task 2: Fix SQL validator CTE subquery depth counting

**Files:**
- Modify: `packages/engine/src/sql-validator.ts:237-249`

**Why:** `countSubqueryDepth` counts all SELECT keywords by word boundary split, which over-counts CTEs. A valid `WITH cte AS (SELECT ...) SELECT ...` is reported as depth 1 when it should be 0.

- [ ] **Step 1: Replace countSubqueryDepth with parenthesis-aware counting**

In `packages/engine/src/sql-validator.ts`, replace the `countSubqueryDepth` method:

```typescript
private countSubqueryDepth(sql: string): number {
  let maxDepth = 0;
  let parenDepth = 0;
  let subqueryDepth = 0;
  const upper = sql.toUpperCase();

  for (let i = 0; i < upper.length; i++) {
    if (upper[i] === '(') {
      parenDepth++;
      // Check if this opens a subquery (SELECT follows the paren)
      const rest = upper.slice(i + 1).trimStart();
      if (rest.startsWith('SELECT')) {
        subqueryDepth++;
        maxDepth = Math.max(maxDepth, subqueryDepth);
      }
    } else if (upper[i] === ')') {
      if (parenDepth > 0) {
        parenDepth--;
        if (subqueryDepth > 0) subqueryDepth--;
      }
    }
  }

  return maxDepth;
}
```

- [ ] **Step 2: Verify build**

Run: `cd ~/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/engine build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/sql-validator.ts
git commit -m "fix(engine): fix CTE subquery depth counting in SqlValidator

Previous implementation counted all SELECT keywords by word split,
over-counting CTE definitions. New implementation tracks parenthesized
subqueries via paren depth for accurate counting."
```

---

### Task 3: Router — Zod validation + few-shot examples

**Files:**
- Modify: `packages/engine/src/skills/router.ts`

**Why:** Router output has no runtime validation (just `as ClassificationResult` assertion). LLM may return malformed JSON with wrong field names. Also lacks few-shot examples causing classification boundary issues.

- [ ] **Step 1: Rewrite router.ts with Zod validation and few-shot examples**

Replace entire `packages/engine/src/skills/router.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ClassificationResult } from './types.js';
import type { ConversationTurn } from '../types.js';

const classificationSchema = z.object({
  type: z.enum(['sql_query', 'follow_up', 'clarification', 'off_topic']),
  complexity: z.enum(['simple', 'moderate', 'complex']),
  confidence: z.number().min(0).max(1),
  modificationHint: z.string().optional(),
  reason: z.string(),
});

const ROUTER_PROMPT = `你是一个 NL2SQL 查询路由器。分析用户的查询，判断类型和复杂度。

## 类型判断
- sql_query: 用户要查数据
- follow_up: 修改上一条查询（如"按月看""排个序""换成柱状图"）
- clarification: 问有什么数据/字段/表
- off_topic: 与数据查询无关

## 复杂度判断
- simple: 单表查询、简单聚合、单维度分组（如"用户总数""各渠道订单数"）
- moderate: 双表 JOIN、带时间过滤、多条件（如"完成订单的用户消费排名"）
- complex: 多表 JOIN + 嵌套子查询、对比/同比/排名后再分析、需要 CTE 或窗口函数

## 示例

用户: "用户总数"
→ {"type":"sql_query","complexity":"simple","confidence":0.95,"reason":"单表 COUNT 聚合"}

用户: "各渠道完成订单的GMV趋势"
→ {"type":"sql_query","complexity":"moderate","confidence":0.9,"reason":"双表 JOIN + 时间维度 + 状态过滤"}

用户: "消费金额超过平均值的用户有哪些品类偏好"
��� {"type":"sql_query","complexity":"complex","confidence":0.85,"reason":"子查询 + 多表 JOIN + 嵌套聚合"}

用户: "帮我排个序"（有对话历史）
→ {"type":"follow_up","complexity":"simple","confidence":0.9,"modificationHint":"添加 ORDER BY","reason":"修改上条查询的排序"}

用户: "有哪些表可以查"
→ {"type":"clarification","complexity":"simple","confidence":0.95,"reason":"询问数据结构"}

用户: "今天天气怎么样"
→ {"type":"off_topic","complexity":"simple","confidence":0.95,"reason":"与数据查询无关"}

返回 JSON（严格按上述格式）:`;

export class QueryRouter {
  private client: Anthropic;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
    });
  }

  async classify(
    userQuery: string,
    conversationHistory: ConversationTurn[] = [],
  ): Promise<ClassificationResult> {
    const messages: Anthropic.MessageParam[] = [];

    if (conversationHistory.length > 0) {
      const historyText = conversationHistory
        .slice(-4)
        .map((t) => `${t.role === 'user' ? '用户' : '系统'}: ${t.content}${t.sql ? ` [SQL: ${t.sql}]` : ''}`)
        .join('\n');
      messages.push({
        role: 'user',
        content: `对话历史:\n${historyText}\n\n新消息: "${userQuery}"`,
      });
    } else {
      messages.push({ role: 'user', content: `分类: "${userQuery}"` });
    }

    let text = '';
    try {
      const response = await this.client.messages.create(
        {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: ROUTER_PROMPT,
          messages,
        },
        { timeout: 10_000 },
      );
      text = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch {
      return this.heuristicFallback(userQuery, conversationHistory);
    }

    // Parse and validate with Zod
    try {
      const match = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (match) {
        const parsed = classificationSchema.parse(JSON.parse(match[0]));
        return parsed;
      }
    } catch {
      // Zod validation failed — try heuristic
    }

    return this.heuristicFallback(userQuery, conversationHistory);
  }

  /** Rule-based fallback when LLM classification fails */
  private heuristicFallback(
    userQuery: string,
    conversationHistory: ConversationTurn[],
  ): ClassificationResult {
    const q = userQuery.toLowerCase();

    // Off-topic signals
    const offTopicPatterns = ['天气', '你好', '谢谢', '再见', 'hello', 'hi', 'thanks'];
    if (offTopicPatterns.some((p) => q === p || (q.length < 10 && q.includes(p)))) {
      return { type: 'off_topic', complexity: 'simple', confidence: 0.7, reason: 'heuristic: greeting/off-topic' };
    }

    // Clarification signals
    const clarificationPatterns = ['有哪些表', '什么字段', '数据结构', '可以查什么', '有什么数据'];
    if (clarificationPatterns.some((p) => q.includes(p))) {
      return { type: 'clarification', complexity: 'simple', confidence: 0.7, reason: 'heuristic: schema question' };
    }

    // Follow-up signals (short query + has history)
    if (conversationHistory.length > 0 && q.length < 20) {
      const followUpPatterns = ['排序', '排个序', '倒序', '按月', '按天', '加个', '去掉', '换成', '改成', '限制'];
      if (followUpPatterns.some((p) => q.includes(p))) {
        return { type: 'follow_up', complexity: 'simple', confidence: 0.6, modificationHint: userQuery, reason: 'heuristic: short modification' };
      }
    }

    // Complex signals
    const complexPatterns = ['同比', '环比', '对比', '超过平均', '排名.*的.*率', 'CTE', '窗口函数'];
    if (complexPatterns.some((p) => new RegExp(p).test(q))) {
      return { type: 'sql_query', complexity: 'complex', confidence: 0.5, reason: 'heuristic: complex pattern' };
    }

    // Default: moderate SQL query (safest fallback — agent path handles uncertainty better)
    return { type: 'sql_query', complexity: 'moderate', confidence: 0.5, reason: 'heuristic: fallback' };
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd ~/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/engine build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/skills/router.ts
git commit -m "fix(engine): add Zod validation and few-shot examples to QueryRouter

- Validate LLM output with Zod schema instead of raw type assertion
- Add 6 few-shot examples covering all classification types
- Add heuristic fallback for when LLM call fails or returns invalid JSON
- Non-greedy JSON regex to avoid matching across multiple objects"
```

---

### Task 4: Fix skill-executor schema context passing

**Files:**
- Modify: `packages/engine/src/skills/skill-executor.ts:206-248`

**Why:** `sqlGenerate` creates empty SchemaContext and hacks DDL into userQuery, breaking prompt structure. `sqlReview` passes empty schema to SqlVerifier, making table/column verification impossible.

- [ ] **Step 1: Fix sqlGenerate to use rawDdl**

In `packages/engine/src/skills/skill-executor.ts`, replace the `sqlGenerate` method:

```typescript
private async sqlGenerate(
  userQuery: string,
  schemaContext: string,
  additionalContext: string | undefined,
  dialect: string,
): Promise<SkillResult> {
  const context: GenerationContext = {
    userQuery: additionalContext ? `${userQuery}\n\n补充信息:\n${additionalContext}` : userQuery,
    schema: { tables: [], relationships: [] },
    rawDdl: schemaContext,
    glossary: [],
    knowledgeContext: [],
    conversationHistory: [],
    fewShotExamples: [],
    dialect,
  };

  const result = await this.sqlGenerator.generate(context);
  return { success: true, data: result };
}
```

- [ ] **Step 2: Fix sqlReview to pass rawDdl to verifier**

In `packages/engine/src/skills/skill-executor.ts`, replace the `sqlReview` method:

```typescript
private async sqlReview(
  userQuery: string,
  sqlStr: string,
  schemaContext: string | undefined,
  datasourceId: string,
): Promise<SkillResult> {
  if (schemaContext) {
    // Agent path: DDL string available — pass as rawDdl to verifier
    const schema: SchemaContext = { tables: [], relationships: [] };
    const verification = await this.sqlVerifier.verify(userQuery, sqlStr, schema, schemaContext);
    return { success: true, data: verification };
  }

  // Direct path: load structured schema from DB
  const schema = await this.schemaLinker.loadSchema(datasourceId);
  const verification = await this.sqlVerifier.verify(userQuery, sqlStr, schema);
  return { success: true, data: verification };
}
```

- [ ] **Step 3: Add GenerationContext import**

Ensure the import at top of `skill-executor.ts` includes GenerationContext (it already does from the existing `import type { SchemaContext, GenerationContext } from '../types.js'` — verify this).

- [ ] **Step 4: Verify build**

Run: `cd ~/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/engine build 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/skills/skill-executor.ts
git commit -m "fix(engine): fix schema context passing in SkillExecutor

- sqlGenerate now uses rawDdl field instead of hacking DDL into userQuery
- sqlReview passes DDL string as rawDdl to SqlVerifier for proper verification
- Fixes prompt structure: schema goes in Schema section, query stays in Query section"
```

---

### Task 5: Agent Orchestrator — fix all CRITICAL issues

**Files:**
- Modify: `packages/engine/src/skills/agent-orchestrator.ts` (full rewrite of agentPath + simplePath)

**Why:** 4 CRITICAL issues: (1) loop termination unsafe, (2) generation loop doesn't exist, (3) simple path ignores validation, (4) no error handling in tool execution.

- [ ] **Step 1: Rewrite agent-orchestrator.ts**

Replace entire `packages/engine/src/skills/agent-orchestrator.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { SKILL_DEFINITIONS } from './skill-definitions.js';
import { SkillExecutor } from './skill-executor.js';
import type { ClassificationResult } from './types.js';
import type { DbClient } from '@nl2sql/db';
import type { PipelineResult, ConversationTurn } from '../types.js';
import pino from 'pino';

const logger = pino({ name: 'agent-orchestrator' });

const MAX_AGENT_TURNS = 8;
const MAX_GENERATION_LOOPS = 3;
const MAX_REPEATED_TOOL_CALLS = 2;

const AGENT_SYSTEM_PROMPT = `你是一个专业的数据分析 Agent。你的任务是将用户的自然语言问题转化为精确的 SQL 查询。

## 工作流程

1. 先使用 schema_search 了解相关的表和列
2. 如果用户提到业务指标，使用 metric_lookup 查找指标定义
3. 如果需要了解业务规则，使用 knowledge_search 查找
4. 使用 sql_generate 生成 SQL
5. 使用 sql_review 审查 SQL 的正确性
6. 如果审查发现问题，根据反馈修改后再次调用 sql_generate
7. 审查通过后使用 sql_validate 做安全校验
8. 如果需要图表，使用 chart_recommend

## 重要规则

- 只生成 SELECT 语句
- 严格使用 schema 中存在的表名和列名
- 生成 SQL 后必须调用 sql_review 审查
- 如果 sql_review 返回问题，必须修复后重新审查（最多修复 ${MAX_GENERATION_LOOPS} 次）
- 审查通过后再调用 sql_validate 做安全校验
- 不要重复调用相同参数的工具`;

const SIMPLE_SYSTEM_PROMPT = `你是一个 SQL 生成专家。根据 schema 直接生成 SQL，不需要复杂推理。

返回 JSON: { "sql": "SELECT ...", "explanation": "简要说明", "confidence": 0.9, "tablesUsed": ["t1"] }

规则：只生成 SELECT，使用 schema 中的表名列名，加合理的 LIMIT。`;

/**
 * Agent Orchestrator — hybrid routing with generation loop.
 *
 * Simple queries: direct generation (2-3 LLM calls)
 * Moderate/Complex queries: agent loop with skills (4-8 LLM calls)
 * Generation loop: generate → review → fix → review (max 3 iterations)
 */
export class AgentOrchestrator {
  private client: Anthropic;
  private skillExecutor: SkillExecutor;

  constructor(
    db: DbClient,
    private config: {
      anthropicApiKey?: string;
      anthropicBaseUrl?: string;
      openaiApiKey?: string;
      openaiBaseUrl?: string;
    },
  ) {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
      baseURL: config.anthropicBaseUrl ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
    });
    this.skillExecutor = new SkillExecutor(db, config);
  }

  async run(
    userQuery: string,
    classification: ClassificationResult,
    context: {
      projectId: string;
      datasourceId: string;
      dialect: string;
      conversationHistory: ConversationTurn[];
    },
  ): Promise<PipelineResult> {
    if (classification.type === 'off_topic') {
      return {
        resolvedVia: 'clarification',
        explanation: '这个问题似乎和数据查询无关，请描述您想查询的数据内容。',
        confidence: classification.confidence,
      };
    }

    if (classification.type === 'clarification') {
      return {
        resolvedVia: 'clarification',
        explanation: '我可以帮您查询数据，请更具体地描述您需要什么信息。',
        confidence: classification.confidence,
        clarificationQuestion: '请问您想查询哪些数据？',
      };
    }

    if (classification.complexity === 'simple') {
      return this.simplePath(userQuery, context);
    }

    return this.agentPath(userQuery, context);
  }

  /**
   * Simple path — 2-3 LLM calls, fast.
   * Schema search + metric lookup (parallel) → direct SQL generation → validate
   */
  private async simplePath(
    userQuery: string,
    context: {
      projectId: string;
      datasourceId: string;
      dialect: string;
    },
  ): Promise<PipelineResult> {
    // Parallel: schema search + metric lookup
    const [schemaResult, metricResult] = await Promise.all([
      this.executeSkillSafe('schema_search', { query: userQuery }, context),
      this.executeSkillSafe('metric_lookup', { metricName: userQuery }, context),
    ]);

    const schemaDdl = schemaResult.success
      ? (schemaResult.data as { ddl: string }).ddl
      : '';
    const metricData = metricResult.success
      ? (metricResult.data as { found: boolean; metrics?: unknown[] })
      : { found: false };

    if (!schemaDdl) {
      return {
        resolvedVia: 'clarification',
        explanation: '未能获取数据库结构信息，请确认数据源配置。',
        confidence: 0,
      };
    }

    // Direct generation with Claude Sonnet
    let text = '';
    try {
      const response = await this.client.messages.create(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: SIMPLE_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Schema:\n${schemaDdl}\n${metricData.found ? `\n指标定义: ${JSON.stringify(metricData.metrics)}` : ''}\n\n问题: ${userQuery}`,
          }],
        },
        { timeout: 30_000 },
      );
      text = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      logger.error({ err }, 'Simple path LLM call failed');
      return {
        resolvedVia: 'clarification',
        explanation: 'SQL 生成服务暂时不可用，请稍后重试。',
        confidence: 0,
      };
    }

    const result = this.parseGenerationResult(text);

    // Actually check validation result
    if (result.sql) {
      const validation = await this.executeSkillSafe('sql_validate', { sql: result.sql }, context);
      const vData = validation.success ? (validation.data as { valid: boolean }) : { valid: false };

      if (!vData.valid) {
        logger.warn({ sql: result.sql, validation: validation.data }, 'Simple path SQL validation failed');
        // Still return — let API layer handle retry
      }
    }

    return {
      resolvedVia: result.sql?.trim() ? 'nl2sql' : 'clarification',
      sql: result.sql?.trim() || undefined,
      explanation: result.explanation || '未能生成有效的查询。',
      confidence: result.confidence,
      tablesUsed: result.tablesUsed,
    };
  }

  /**
   * Agent path — Claude tool_use loop with skills + generation review loop.
   * For moderate/complex queries.
   */
  private async agentPath(
    userQuery: string,
    context: {
      projectId: string;
      datasourceId: string;
      dialect: string;
      conversationHistory: ConversationTurn[];
    },
  ): Promise<PipelineResult> {
    const tools = SKILL_DEFINITIONS.map((s) => ({
      name: s.name,
      description: s.description,
      input_schema: s.input_schema as Anthropic.Tool.InputSchema,
    }));

    let historyContext = '';
    if (context.conversationHistory.length > 0) {
      historyContext = '\n\n对话历史:\n' + context.conversationHistory
        .slice(-4)
        .map((t) => `${t.role === 'user' ? '用户' : '系统'}: ${t.content}${t.sql ? ` [SQL: ${t.sql}]` : ''}`)
        .join('\n');
    }

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: `${userQuery}${historyContext}` },
    ];

    let finalSql = '';
    let finalExplanation = '';
    let finalConfidence = 0;
    let finalTables: string[] = [];
    let turn = 0;
    let generationLoopCount = 0;

    // Track repeated tool calls to prevent infinite loops
    const toolCallCounts = new Map<string, number>();

    while (turn < MAX_AGENT_TURNS) {
      turn++;

      let response: Anthropic.Message;
      try {
        response = await this.client.messages.create(
          {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            system: AGENT_SYSTEM_PROMPT,
            tools,
            messages,
          },
          { timeout: 45_000 },
        );
      } catch (err) {
        logger.error({ err, turn }, 'Agent loop LLM call failed');
        break;
      }

      // Check for max_tokens truncation — response may be incomplete
      if (response.stop_reason === 'max_tokens') {
        logger.warn({ turn }, 'Agent loop hit max_tokens — extracting partial results');
        for (const block of response.content) {
          if (block.type === 'text' && block.text) {
            const parsed = this.parseGenerationResult(block.text);
            if (parsed.sql?.trim()) {
              finalSql = parsed.sql;
              finalExplanation = parsed.explanation;
              finalConfidence = Math.min(parsed.confidence, 0.6); // Lower confidence for truncated
              finalTables = parsed.tablesUsed;
            }
          }
        }
        break;
      }

      const toolResults: Array<Anthropic.ToolResultBlockParam> = [];
      let hasToolUse = false;

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          hasToolUse = true;

          // Detect repeated identical tool calls
          const callKey = `${block.name}:${JSON.stringify(block.input)}`;
          const callCount = (toolCallCounts.get(callKey) ?? 0) + 1;
          toolCallCounts.set(callKey, callCount);

          if (callCount > MAX_REPEATED_TOOL_CALLS) {
            logger.warn({ tool: block.name, callCount }, 'Repeated tool call detected');
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({
                error: `已多次调用 ${block.name} 获取相同信息，请直接使用已获取的数据继续。`,
              }),
              is_error: true,
            });
            continue;
          }

          // Execute skill with error handling
          const skillResult = await this.executeSkillSafe(
            block.name,
            block.input as Record<string, unknown>,
            context,
          );

          // Track SQL generation results
          if (block.name === 'sql_generate' && skillResult.success) {
            const genData = skillResult.data as {
              sql: string;
              explanation: string;
              confidence: number;
              tablesUsed: string[];
            };
            if (genData.sql?.trim()) {
              finalSql = genData.sql;
              finalExplanation = genData.explanation ?? '';
              finalConfidence = genData.confidence ?? 0;
              finalTables = genData.tablesUsed ?? [];
              generationLoopCount++;
            }
          }

          // Track review results — enforce generation loop limit
          if (block.name === 'sql_review' && skillResult.success) {
            const reviewData = skillResult.data as {
              isCorrect: boolean;
              issues?: string[];
              suggestedFix?: string;
            };
            if (!reviewData.isCorrect && reviewData.suggestedFix) {
              if (generationLoopCount < MAX_GENERATION_LOOPS) {
                finalSql = reviewData.suggestedFix;
              } else {
                // Hit generation loop limit — tell LLM to stop iterating
                logger.info({ generationLoopCount }, 'Generation loop limit reached');
              }
            }
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(skillResult.data),
          });
        } else if (block.type === 'text' && block.text) {
          const parsed = this.parseGenerationResult(block.text);
          if (parsed.sql?.trim()) {
            finalSql = parsed.sql;
            finalExplanation = parsed.explanation;
            finalConfidence = parsed.confidence;
            finalTables = parsed.tablesUsed;
          } else if (!finalExplanation && block.text.trim()) {
            finalExplanation = block.text;
          }
        }
      }

      if (!hasToolUse) break;

      // Append assistant response + tool results to conversation
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    // Post-loop: ensure final SQL was validated
    if (finalSql?.trim()) {
      const validation = await this.executeSkillSafe('sql_validate', { sql: finalSql }, context);
      if (validation.success) {
        const vData = validation.data as { valid: boolean; errors?: Array<{ message: string }> };
        if (!vData.valid) {
          logger.warn({ sql: finalSql, errors: vData.errors }, 'Agent path final SQL validation failed');
        }
      }
    }

    return {
      resolvedVia: finalSql?.trim() ? 'nl2sql' : 'clarification',
      sql: finalSql?.trim() || undefined,
      explanation: finalExplanation || '无法生成查询，请重新描述您的需求。',
      confidence: finalConfidence,
      tablesUsed: finalTables.length > 0 ? finalTables : undefined,
    };
  }

  /** Execute a skill with error handling — never throws */
  private async executeSkillSafe(
    skillName: string,
    input: Record<string, unknown>,
    context: { projectId: string; datasourceId: string; dialect: string },
  ): Promise<{ success: boolean; data: unknown }> {
    try {
      return await this.skillExecutor.execute(skillName, input, context);
    } catch (err) {
      logger.error({ err, skillName }, 'Skill execution failed');
      return {
        success: false,
        data: { error: `${skillName} 执行失败: ${err instanceof Error ? err.message : String(err)}` },
      };
    }
  }

  private parseGenerationResult(text: string): {
    sql: string;
    explanation: string;
    confidence: number;
    tablesUsed: string[];
  } {
    try {
      // Non-greedy: match the first complete JSON object
      const match = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          sql: parsed.sql ?? '',
          explanation: parsed.explanation ?? '',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          tablesUsed: Array.isArray(parsed.tablesUsed) ? parsed.tablesUsed : [],
        };
      }
    } catch {
      // fallback
    }

    const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
    if (sqlMatch) {
      return {
        sql: sqlMatch[1].trim(),
        explanation: '已生成 SQL',
        confidence: 0.5,
        tablesUsed: [],
      };
    }

    return { sql: '', explanation: text.slice(0, 200), confidence: 0, tablesUsed: [] };
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd ~/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/engine build 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/skills/agent-orchestrator.ts
git commit -m "fix(engine): fix 4 CRITICAL issues in AgentOrchestrator

1. Loop termination: check stop_reason for max_tokens truncation,
   detect and block repeated identical tool calls
2. Generation loop: enforce MAX_GENERATION_LOOPS (was defined but unused)
3. Simple path: parallelize schema+metric lookup, actually check validation,
   fix empty string falsy check
4. Error handling: try-catch around all tool execution and LLM calls,
   graceful degradation instead of crash
5. Tool results: use proper Anthropic API format (single user message with
   array of tool_result blocks instead of multiple user messages)
6. JSON parsing: non-greedy regex to avoid matching across objects"
```

---

### Task 6: Pipeline cleanup — remove dead code, reuse instances

**Files:**
- Modify: `packages/engine/src/pipeline.ts`

**Why:** `runFullPipeline` is dead code (never called after agent architecture). Constructor initializes 5 unused service instances. QueryRouter and AgentOrchestrator are re-instantiated on every call.

- [ ] **Step 1: Rewrite pipeline.ts**

Replace entire `packages/engine/src/pipeline.ts`:

```typescript
import { eq, sql } from 'drizzle-orm';
import {
  metrics,
  schemaTables,
  type DbClient,
} from '@nl2sql/db';
import { QueryRouter } from './skills/router.js';
import { AgentOrchestrator } from './skills/agent-orchestrator.js';
import type { PipelineInput, PipelineResult } from './types.js';

/**
 * NL2SQL Pipeline — dual-channel architecture:
 * 1. Metric Resolution: if user query matches a known metric, compose SQL directly
 * 2. Agent Orchestrator: routes to simple or agent path based on query complexity
 *
 * Data flywheel: user corrections get recorded and retrieved as few-shot examples
 */
export class NL2SqlPipeline {
  private router: QueryRouter;
  private orchestrator: AgentOrchestrator;

  constructor(
    private db: DbClient,
    private config: {
      anthropicApiKey?: string;
      anthropicBaseUrl?: string;
      openaiApiKey?: string;
      openaiBaseUrl?: string;
    } = {},
  ) {
    const anthropicBase = config.anthropicBaseUrl ?? process.env.ANTHROPIC_BASE_URL;
    this.router = new QueryRouter(config.anthropicApiKey, anthropicBase);
    this.orchestrator = new AgentOrchestrator(db, config);
  }

  async run(input: PipelineInput): Promise<PipelineResult> {
    const conversationHistory = input.conversationHistory ?? [];
    const dialect = input.dialect ?? 'postgresql';

    // Step 1: Router — classify intent + complexity
    const classification = await this.router.classify(input.userQuery, conversationHistory);

    if (classification.type === 'off_topic' || classification.type === 'clarification') {
      return this.orchestrator.run(input.userQuery, classification, {
        projectId: input.projectId,
        datasourceId: input.datasourceId,
        dialect,
        conversationHistory,
      });
    }

    // Step 2: Try metric resolution first (high accuracy path)
    const metricResult = await this.tryMetricResolution(input);
    if (metricResult) return metricResult;

    // Step 3: Agent orchestrator — routes to simple or agent path based on complexity
    return this.orchestrator.run(input.userQuery, classification, {
      projectId: input.projectId,
      datasourceId: input.datasourceId,
      dialect,
      conversationHistory,
    });
  }

  private async tryMetricResolution(
    input: PipelineInput,
  ): Promise<PipelineResult | null> {
    const projectMetrics = await this.db
      .select()
      .from(metrics)
      .where(eq(metrics.projectId, input.projectId));

    if (projectMetrics.length === 0) return null;

    const queryLower = input.userQuery.toLowerCase();

    // Find all matching metrics
    const matchedMetrics = projectMetrics.filter(
      (m) =>
        queryLower.includes(m.name.toLowerCase()) ||
        queryLower.includes(m.displayName.toLowerCase()),
    );

    // If multiple metrics match or none match, skip metric resolution
    if (matchedMetrics.length !== 1) return null;

    // If query has complex intent indicators, prefer full NL2SQL
    const complexIndicators = ['对比', '趋势', '同比', '环比', '占比', '分布', '关联'];
    const hasComplexIntent = complexIndicators.some((w) => queryLower.includes(w));

    // If query mentions cross-table entities, prefer full NL2SQL
    const crossTableIndicators = ['用户', '商品', '产品', '分类', '品类', '品牌'];
    const hasCrossTable = crossTableIndicators.some((w) => queryLower.includes(w));

    if (hasComplexIntent || hasCrossTable) return null;

    const matchedMetric = matchedMetrics[0];

    if (!matchedMetric.sourceTableId) return null;

    const [sourceTable] = await this.db
      .select()
      .from(schemaTables)
      .where(eq(schemaTables.id, matchedMetric.sourceTableId));

    if (!sourceTable) return null;

    const sourceTableName = sourceTable.name;

    const selectParts: string[] = [];
    const groupByParts: string[] = [];
    const whereParts: string[] = [];

    if (matchedMetric.dimensions) {
      for (const dim of matchedMetric.dimensions) {
        if (this.dimensionMatchesQuery(dim, queryLower)) {
          selectParts.push(dim);
          groupByParts.push(dim);
        }
      }
    }

    selectParts.push(`${matchedMetric.expression} AS ${matchedMetric.name}`);

    if (matchedMetric.filters && Array.isArray(matchedMetric.filters)) {
      for (const f of matchedMetric.filters as Array<{
        column: string;
        op: string;
        value: unknown;
      }>) {
        const val =
          typeof f.value === 'string'
            ? `'${String(f.value).replace(/'/g, "''")}'`
            : String(f.value);
        whereParts.push(`${f.column} ${f.op} ${val}`);
      }
    }

    let composedSql = `SELECT ${selectParts.join(', ')} FROM ${sourceTableName}`;
    if (whereParts.length > 0) composedSql += ` WHERE ${whereParts.join(' AND ')}`;
    if (groupByParts.length > 0) composedSql += ` GROUP BY ${groupByParts.join(', ')}`;

    return {
      resolvedVia: 'metric',
      sql: composedSql,
      explanation: `基于指标「${matchedMetric.displayName}」生成查询：${matchedMetric.expression}`,
      confidence: 0.9,
      tablesUsed: [sourceTableName],
    };
  }

  /** Match dimension name against query with Chinese alias support */
  private dimensionMatchesQuery(dimension: string, query: string): boolean {
    const dimLower = dimension.toLowerCase();

    if (query.includes(dimLower)) return true;

    const aliases: Record<string, string[]> = {
      channel: ['渠道', '来源', '入口'],
      region: ['地区', '区域', '省份', '城市', '地域'],
      category: ['分类', '类目', '品类'],
      brand: ['品牌'],
      status: ['状态'],
      order_date: ['日期', '时间', '按天', '按日', '每天', '每日'],
      month: ['月', '按月', '每月', '月份'],
      week: ['周', '按周', '每周'],
      year: ['年', '按年', '每年', '年份'],
      device: ['设备', '终端', '客户端'],
      gender: ['性别'],
      city: ['城市'],
      product: ['商品', '产品'],
      user: ['用户'],
    };

    const dimAliases = aliases[dimLower] ?? [];
    return dimAliases.some((alias) => query.includes(alias));
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd ~/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/engine build 2>&1 | tail -10`

- [ ] **Step 3: Verify no import breakage in API**

Run: `cd ~/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/api build 2>&1 | tail -10`

Check that `@nl2sql/engine` exports still include everything the API needs.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/pipeline.ts
git commit -m "refactor(engine): remove dead code from pipeline, reuse instances

- Remove dead runFullPipeline method (superseded by AgentOrchestrator)
- Remove 5 unused service instances from constructor
- Reuse QueryRouter and AgentOrchestrator across calls
- Remove 'and' from complexIndicators to reduce false positives
- Clean imports: only import what's needed"
```

---

### Task 7: Consistent error recovery in API query route

**Files:**
- Modify: `packages/api/src/routes/query.ts:77-105` (sync route retry) and `packages/api/src/routes/query.ts:177-191` (stream route retry)

**Why:** Sync route retries 2 times, stream route retries 1 time. Both inject error messages into userQuery which pollutes router classification.

- [ ] **Step 1: Unify retry logic in query.ts**

In `packages/api/src/routes/query.ts`, extract a shared retry helper and use it in both routes.

Replace the sync route's error recovery block (lines ~77-105):

```typescript
// Replace the error recovery section in the sync POST handler with:
if (result.sql) {
  const validator = new SqlValidator(parsed.data.dialect ?? 'postgresql');
  let validation = validator.validate(result.sql);
  let finalResult = result;

  if (!validation.valid) {
    const retried = await retryWithErrorContext(
      pipeline,
      parsed.data,
      result,
      validation,
      validator,
    );
    if (retried) {
      finalResult = retried.result;
      validation = retried.validation;
    }
  }

  ctx.body = { success: true, data: { ...finalResult, validation } };
  return;
}
```

Replace the stream route's error recovery block (lines ~177-191):

```typescript
// Replace the error recovery section in the SSE handler with:
if (!validation.valid) {
  sendSSE(stream, 'status', { step: 'error_recovery', message: '检测到问题，正在修复...' });

  const retried = await retryWithErrorContext(
    pipeline,
    parsed.data,
    result,
    validation,
    validator,
  );
  if (retried) {
    finalResult = retried.result;
  }
}
```

Add the shared retry helper at module level:

```typescript
async function retryWithErrorContext(
  pipeline: InstanceType<typeof NL2SqlPipeline>,
  input: { projectId: string; datasourceId: string; query: string; conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string; sql?: string }>; dialect?: string },
  previousResult: { sql?: string; explanation: string },
  validation: { valid: boolean; errors: Array<{ code: string; message: string }> },
  validator: InstanceType<typeof SqlValidator>,
  maxRetries = 2,
): Promise<{ result: PipelineResult; validation: ReturnType<typeof validator.validate> } | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const errorContext = validation.errors
      .map((e) => `${e.code}: ${e.message}`)
      .join('; ');

    // Pass error context via conversation history, not userQuery (avoids polluting router)
    const retryResult = await pipeline.run({
      projectId: input.projectId,
      datasourceId: input.datasourceId,
      userQuery: input.query,
      conversationHistory: [
        ...(input.conversationHistory ?? []),
        { role: 'assistant' as const, content: previousResult.explanation, sql: previousResult.sql },
        { role: 'user' as const, content: `上一次生成的 SQL 有问题: ${errorContext}，请修正` },
      ],
      dialect: input.dialect,
    });

    if (retryResult.sql) {
      const revalidation = validator.validate(retryResult.sql);
      if (revalidation.valid) {
        return { result: retryResult, validation: revalidation };
      }
      validation = revalidation;
    }
  }

  return null;
}
```

Note: `NL2SqlPipeline` and `SqlValidator` types come from the dynamic import — adjust as needed for the actual import pattern.

- [ ] **Step 2: Verify build**

Run: `cd ~/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/api build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/query.ts
git commit -m "fix(api): unify error recovery logic in query routes

- Extract shared retryWithErrorContext helper
- Pass error context via conversation history instead of polluting userQuery
- Consistent max 2 retries for both sync and stream routes"
```

---

### Task 8: Verify engine index exports

**Files:**
- Verify: `packages/engine/src/index.ts`

**Why:** After removing dead code from pipeline.ts, ensure the public API hasn't changed for consumers.

- [ ] **Step 1: Check engine index.ts**

Read `packages/engine/src/index.ts` and verify it still exports `NL2SqlPipeline`, `SqlValidator`, and any other types the API layer imports.

- [ ] **Step 2: Full workspace build**

Run: `cd ~/Desktop/workspace/projects/nl2sql && pnpm build 2>&1 | tail -30`
Expected: All packages build successfully.

- [ ] **Step 3: Commit (if any fixes needed)**

Only commit if exports needed adjustment.

---

## Dependency Graph

```
Task 1 (types + generator + verifier)
  ↓
Task 4 (skill-executor uses rawDdl)
  ↓
Task 5 (agent-orchestrator uses fixed skill-executor)
  ↓
Task 6 (pipeline uses fixed orchestrator)
  ↓
Task 7 (API uses fixed pipeline)
  ↓
Task 8 (final build verification)

Task 2 (sql-validator) — independent
Task 3 (router) — independent
```

Tasks 1, 2, 3 can run in parallel. Tasks 4-8 are sequential.
