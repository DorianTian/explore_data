import Anthropic from '@anthropic-ai/sdk';
import { SKILL_DEFINITIONS } from './skill-definitions.js';
import { SkillExecutor } from './skill-executor.js';
import type { ClassificationResult } from './types.js';
import type { DbClient } from '@nl2sql/db';
import type { PipelineResult, ConversationTurn } from '../types.js';

const MAX_AGENT_TURNS = 8;
const MAX_GENERATION_LOOPS = 3;

const AGENT_SYSTEM_PROMPT = `你是一个专业的数据分析 Agent。你的任务是将用户的自然语言问题转化为精确的 SQL 查询。

## 工作流程

1. 先使用 schema_search 了解相关的表和列
2. 如果用户提到业务指标，使用 metric_lookup 查找指标定义
3. 如果需要了解业务规则，使用 knowledge_search 查找
4. 使用 sql_generate 生成 SQL
5. 使用 sql_review 审查 SQL 的正确性
6. 如果审查发现问题，修改后再次 sql_generate
7. 最后使用 sql_validate 做安全校验

## 重要规则

- 只生成 SELECT 语句
- 严格使用 schema 中存在的表名和列名
- 生成 SQL 后必须调用 sql_review 审查
- 如果 sql_review 返回问题，必须修复后重新审查
- 审查通过后再调用 sql_validate 做安全校验`;

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

    // Route based on complexity
    if (classification.complexity === 'simple') {
      return this.simplePath(userQuery, context);
    }

    return this.agentPath(userQuery, context);
  }

  /**
   * Simple path — 2-3 LLM calls, fast.
   * Schema search → direct SQL generation → validate
   */
  private async simplePath(
    userQuery: string,
    context: {
      projectId: string;
      datasourceId: string;
      dialect: string;
    },
  ): Promise<PipelineResult> {
    // Get schema
    const schemaResult = await this.skillExecutor.execute(
      'schema_search',
      { query: userQuery },
      context,
    );
    const schemaDdl = (schemaResult.data as { ddl: string }).ddl;

    // Check for metric match
    const metricResult = await this.skillExecutor.execute(
      'metric_lookup',
      { metricName: userQuery },
      context,
    );
    const metricData = metricResult.data as { found: boolean; metrics?: unknown[] };

    // Direct generation with Claude Sonnet
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

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    let result = this.parseGenerationResult(text);

    // Validate
    const validation = await this.skillExecutor.execute(
      'sql_validate',
      { sql: result.sql },
      context,
    );

    return {
      resolvedVia: result.sql ? 'nl2sql' : 'clarification',
      sql: result.sql,
      explanation: result.explanation,
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

    // Agent loop — LLM decides which tools to call
    while (turn < MAX_AGENT_TURNS) {
      turn++;

      const response = await this.client.messages.create(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: AGENT_SYSTEM_PROMPT,
          tools,
          messages,
        },
        { timeout: 45_000 },
      );

      // Process response blocks
      const toolResults: Anthropic.MessageParam[] = [];
      let hasToolUse = false;

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          hasToolUse = true;
          const skillResult = await this.skillExecutor.execute(
            block.name,
            block.input as Record<string, unknown>,
            context,
          );

          // Track SQL generation results
          if (block.name === 'sql_generate') {
            const genData = skillResult.data as {
              sql: string;
              explanation: string;
              confidence: number;
              tablesUsed: string[];
            };
            finalSql = genData.sql ?? '';
            finalExplanation = genData.explanation ?? '';
            finalConfidence = genData.confidence ?? 0;
            finalTables = genData.tablesUsed ?? [];
          }

          // Track review results — generation loop
          if (block.name === 'sql_review') {
            const reviewData = skillResult.data as {
              isCorrect: boolean;
              suggestedFix?: string;
            };
            if (!reviewData.isCorrect && reviewData.suggestedFix) {
              finalSql = reviewData.suggestedFix;
            }
          }

          toolResults.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(skillResult.data),
            }],
          } as Anthropic.MessageParam);
        } else if (block.type === 'text' && block.text) {
          // LLM produced text without tool use — might contain final answer
          const parsed = this.parseGenerationResult(block.text);
          if (parsed.sql) {
            finalSql = parsed.sql;
            finalExplanation = parsed.explanation;
            finalConfidence = parsed.confidence;
            finalTables = parsed.tablesUsed;
          } else if (!finalExplanation) {
            finalExplanation = block.text;
          }
        }
      }

      if (!hasToolUse) break; // LLM done — no more tool calls

      // Add tool results and continue loop
      messages.push({ role: 'assistant', content: response.content });
      for (const tr of toolResults) {
        messages.push(tr);
      }
    }

    return {
      resolvedVia: finalSql ? 'nl2sql' : 'clarification',
      sql: finalSql || undefined,
      explanation: finalExplanation || '无法生成查询，请重新描述您的需求。',
      confidence: finalConfidence,
      tablesUsed: finalTables.length > 0 ? finalTables : undefined,
    };
  }

  private parseGenerationResult(text: string): {
    sql: string;
    explanation: string;
    confidence: number;
    tablesUsed: string[];
  } {
    try {
      const match = text.match(/\{[\s\S]*\}/);
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
