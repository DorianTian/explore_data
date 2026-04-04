import Anthropic from '@anthropic-ai/sdk';
import { SKILL_DEFINITIONS } from './skill-definitions.js';
import { SkillExecutor } from './skill-executor.js';
import type { ClassificationResult } from './types.js';
import type { DbClient } from '@nl2sql/db';
import type {
  PipelineResult,
  ConversationTurn,
  ProgressCallback,
  TokenCallback,
} from '../types.js';
import { extractText, extractJson, withRetry } from '../llm-utils.js';
import { MODEL, TIMEOUT, PIPELINE } from '../config.js';

const MAX_REPEATED_TOOL_CALLS = 2;

const AGENT_SYSTEM_PROMPT = `你是一个专业的数据分析 Agent。你的**唯一目标**是将用户的自然语言问题转化为可执行的 SQL 查询。

## 强制规则（最高优先级）

- **你必须生成 SQL**。不要只输出文字分析或解释就停止。每次交互的最终产出必须包含一条可执行的 SQL。
- **不要向用户提问或要求澄清**。根据已有 schema 和上下文，做出最合理的假设并直接生成 SQL。
- **不要输出纯文字回复**。如果你想解释思路，必须同时调用 sql_generate 生成 SQL。

## 工作流程

1. 先使用 schema_search 了解相关的表和列
2. 如果用户提到业务指标，使用 metric_lookup 查找指标定义
3. 如果需要了解业务规则，使用 knowledge_search 查找
4. **必须**使用 sql_generate 生成 SQL — 这一步不可跳过
5. 使用 sql_review 审查 SQL 的正确性
6. 如果审查发现问题，根据反馈修改后再次调用 sql_generate（最多 ${PIPELINE.maxGenerationLoops} 次）
7. 审查通过后使用 sql_validate 做安全校验

## 其他规则

- 只生成 SELECT 语句
- 严格使用 schema 中存在的表名和列名
- 不要重复调用相同参数的工具`;

const SIMPLE_SYSTEM_PROMPT = `你是一个 SQL 生成专家。根据 schema 直接生成 SQL，不需要复杂推理。

返回 JSON: { "sql": "SELECT ...", "explanation": "简要说明", "confidence": 0.9, "tablesUsed": ["t1"] }

规则：只生成 SELECT，使用 schema 中的表名列名，加合理的 LIMIT。`;

/**
 * Agent Orchestrator — hybrid routing with generation loop.
 *
 * Simple queries: direct generation (2 LLM calls)
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
      onProgress?: ProgressCallback;
      onToken?: TokenCallback;
    },
  ): Promise<PipelineResult> {
    const progress = context.onProgress ?? (() => {});
    const onToken = context.onToken;

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

    // Route based on complexity
    if (classification.complexity === 'simple') {
      return this.simplePath(userQuery, context, progress, onToken);
    }

    return this.agentPath(userQuery, context, progress, onToken);
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
    progress: ProgressCallback,
    onToken?: TokenCallback,
  ): Promise<PipelineResult> {
    // Parallel: schema search + metric lookup
    progress('schema_search', '正在搜索数据库结构...');
    const [schemaResult, metricResult] = await Promise.all([
      this.executeSkillSafe('schema_search', { query: userQuery }, context),
      this.executeSkillSafe('metric_lookup', { metricName: userQuery }, context),
    ]);

    const schemaDdl = schemaResult.success ? (schemaResult.data as { ddl: string }).ddl : '';
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

    // Direct generation with Claude Sonnet (streaming when callback provided)
    progress('sql_generation', '正在生成 SQL...');
    const params = {
      model: MODEL.generation,
      max_tokens: 1500,
      system: SIMPLE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user' as const,
          content: `Schema:\n${schemaDdl}\n${metricData.found ? `\n指标定义: ${JSON.stringify(metricData.metrics)}` : ''}\n\n问题: ${userQuery}`,
        },
      ],
    };

    let text: string;
    if (onToken) {
      const stream = this.client.messages.stream(params, { timeout: TIMEOUT.generation });
      stream.on('text', (delta) => onToken(delta));
      const finalMessage = await stream.finalMessage();
      text = extractText(finalMessage);
    } else {
      const response = await withRetry(
        () => this.client.messages.create(params, { timeout: TIMEOUT.generation }),
        { label: 'AgentOrchestrator.simplePath' },
      );
      text = extractText(response);
    }
    const result = this.parseGenerationResult(text);

    // Validate and check result
    progress('sql_validation', '正在校验 SQL...');
    const validation = await this.skillExecutor.execute(
      'sql_validate',
      { sql: result.sql },
      context,
    );
    const validationData = validation.data as {
      valid: boolean;
      errors?: Array<{ message: string }>;
    };

    // If validation failed, include info in explanation
    let explanation = result.explanation;
    if (!validationData.valid && validationData.errors) {
      explanation += `\n⚠️ 校验发现问题: ${validationData.errors.map((e) => e.message).join('; ')}`;
    }

    return {
      resolvedVia: result.sql ? 'nl2sql' : 'clarification',
      sql: result.sql || undefined,
      explanation,
      confidence: validationData.valid ? result.confidence : Math.min(result.confidence, 0.5),
      tablesUsed: result.tablesUsed.length > 0 ? result.tablesUsed : undefined,
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
    progress: ProgressCallback,
    onToken?: TokenCallback,
  ): Promise<PipelineResult> {
    const tools = SKILL_DEFINITIONS.map((s) => ({
      name: s.name,
      description: s.description,
      input_schema: s.input_schema as Anthropic.Tool.InputSchema,
    }));

    let historyContext = '';
    if (context.conversationHistory.length > 0) {
      historyContext =
        '\n\n对话历史:\n' +
        context.conversationHistory
          .slice(-PIPELINE.maxHistoryTurns)
          .map(
            (t) =>
              `${t.role === 'user' ? '用户' : '系统'}: ${t.content}${t.sql ? ` [SQL: ${t.sql}]` : ''}`,
          )
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
    const toolCallCounts = new Map<string, number>();

    // Agent loop — LLM decides which tools to call
    while (turn < PIPELINE.maxAgentTurns) {
      turn++;

      let response: Anthropic.Message;
      try {
        response = await withRetry(
          () =>
            this.client.messages.create(
              {
                model: MODEL.generation,
                max_tokens: 2000,
                system: AGENT_SYSTEM_PROMPT,
                tools,
                messages,
              },
              { timeout: TIMEOUT.agent },
            ),
          { label: `AgentOrchestrator.agentPath[turn=${turn}]` },
        );
      } catch {
        // LLM call failed after retries — break with whatever we have
        break;
      }

      // Check for max_tokens truncation — response may be incomplete
      if (response.stop_reason === 'max_tokens') {
        for (const block of response.content) {
          if (block.type === 'text' && block.text) {
            const parsed = this.parseGenerationResult(block.text);
            if (parsed.sql?.trim()) {
              finalSql = parsed.sql;
              finalExplanation = parsed.explanation;
              finalConfidence = Math.min(parsed.confidence, 0.6);
              finalTables = parsed.tablesUsed;
            }
          }
        }
        break;
      }

      // Process response blocks
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let hasToolUse = false;

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          hasToolUse = true;

          // Detect repeated identical tool calls to prevent infinite loops
          const callKey = `${block.name}:${JSON.stringify(block.input)}`;
          const callCount = (toolCallCounts.get(callKey) ?? 0) + 1;
          toolCallCounts.set(callKey, callCount);

          if (callCount > MAX_REPEATED_TOOL_CALLS) {
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

          // Report progress for each skill execution
          const skillMessages: Record<string, string> = {
            schema_search: '正在搜索数据库结构...',
            metric_lookup: '正在匹配业务指标...',
            knowledge_search: '正在检索知识库...',
            sql_generate: '正在生成 SQL...',
            sql_review: '正在审查 SQL...',
            sql_validate: '正在校验 SQL 安全性...',
          };
          progress(block.name, skillMessages[block.name] ?? `正在执行 ${block.name}...`);

          // Execute skill with error handling — never throws
          // Pass onToken for sql_generate to enable streaming
          const skillResult = await this.executeSkillSafe(
            block.name,
            block.input as Record<string, unknown>,
            context,
            block.name === 'sql_generate' ? onToken : undefined,
          );

          // Track SQL generation results
          if (block.name === 'sql_generate' && skillResult.success) {
            generationLoopCount++;
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
            }
          }

          // Track review results — enforce generation loop limit
          if (block.name === 'sql_review' && skillResult.success) {
            const reviewData = skillResult.data as {
              isCorrect: boolean;
              suggestedFix?: string;
            };
            if (!reviewData.isCorrect && reviewData.suggestedFix) {
              if (generationLoopCount < PIPELINE.maxGenerationLoops) {
                finalSql = reviewData.suggestedFix;
              }
            }
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(skillResult.data),
          });
        } else if (block.type === 'text' && block.text) {
          // LLM produced text without tool use — might contain final answer
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

      // LLM returned no tool calls
      if (!hasToolUse) {
        // If we already have SQL, we're done
        if (finalSql?.trim()) break;
        // No SQL yet — nudge LLM to continue generating
        if (turn < PIPELINE.maxAgentTurns) {
          messages.push({ role: 'assistant', content: response.content });
          messages.push({
            role: 'user',
            content:
              '你还没有生成 SQL。请使用 schema_search 获取表结构，然后调用 sql_generate 生成查询。',
          });
          continue;
        }
        break;
      }

      // Add tool results as single user message (proper Anthropic API format)
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    // Post-loop: validate final SQL
    if (finalSql?.trim()) {
      const validation = await this.executeSkillSafe('sql_validate', { sql: finalSql }, context);
      if (validation.success) {
        const vData = validation.data as { valid: boolean; errors?: Array<{ message: string }> };
        if (!vData.valid && vData.errors) {
          finalExplanation += `\n⚠️ 校验发现问题: ${vData.errors.map((e) => e.message).join('; ')}`;
          finalConfidence = Math.min(finalConfidence, 0.5);
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
    onToken?: TokenCallback,
  ): Promise<{ success: boolean; data: unknown }> {
    try {
      return await this.skillExecutor.execute(skillName, input, context, onToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        JSON.stringify({ level: 'error', msg: `Skill ${skillName} failed`, error: msg }) + '\n',
      );
      return {
        success: false,
        data: { error: `${skillName} 执行失败: ${msg}` },
      };
    }
  }

  private parseGenerationResult(text: string): {
    sql: string;
    explanation: string;
    confidence: number;
    tablesUsed: string[];
  } {
    const parsed = extractJson<{
      sql?: string;
      explanation?: string;
      confidence?: number;
      tablesUsed?: string[];
    }>(text);

    if (parsed && parsed.sql) {
      return {
        sql: parsed.sql,
        explanation: parsed.explanation ?? '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        tablesUsed: Array.isArray(parsed.tablesUsed) ? parsed.tablesUsed : [],
      };
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
