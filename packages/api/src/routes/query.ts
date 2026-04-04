import Router from '@koa/router';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import Anthropic from '@anthropic-ai/sdk';
import type { DbClient } from '@nl2sql/db';
import { ConversationService } from '../services/conversation-service.js';

const MAX_RETRY_ATTEMPTS = 2;

const querySchema = z.object({
  projectId: z.string().uuid(),
  datasourceId: z.string().uuid(),
  query: z.string().min(1).max(2000),
  conversationId: z.string().uuid().nullish(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        sql: z.string().optional(),
      }),
    )
    .max(20)
    .optional(),
  dialect: z.string().optional(),
});

const feedbackSchema = z.object({
  projectId: z.string().uuid(),
  naturalLanguage: z.string(),
  generatedSql: z.string(),
  correctedSql: z.string().optional(),
  wasAccepted: z.number().min(0).max(1).optional(),
  status: z.enum(['accepted', 'pending', 'rejected']).optional(),
  isGolden: z.boolean().optional(),
});

import type { ServerResponse } from 'http';

function sendSSE(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function getPipelineConfig() {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
  };
}

export function createQueryRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/query' });
  const conversationService = new ConversationService(db);

  router.post('/', async (ctx) => {
    const parsed = querySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }

    const requestId = randomUUID();
    const logger = ctx.app.context.logger?.child?.({ requestId }) ?? ctx.app.context.logger;
    const startTime = Date.now();

    const { NL2SqlPipeline, SqlValidator } = await import('@nl2sql/engine');
    const pipeline = new NL2SqlPipeline(db, getPipelineConfig());

    logger?.info?.({ query: parsed.data.query.slice(0, 100) }, 'Query started');

    const result = await pipeline.run({
      projectId: parsed.data.projectId,
      datasourceId: parsed.data.datasourceId,
      userQuery: parsed.data.query,
      conversationHistory: parsed.data.conversationHistory,
      dialect: parsed.data.dialect,
    });

    if (result.sql) {
      const validator = new SqlValidator(parsed.data.dialect ?? 'postgresql');
      let validation = validator.validate(result.sql);
      let finalResult = result;

      // Error recovery: retry with error context (up to MAX_RETRY_ATTEMPTS)
      if (!validation.valid) {
        for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
          const errorContext = validation.errors
            .map((e: { code: string; message: string }) => `${e.code}: ${e.message}`)
            .join('; ');

          logger?.info?.({ attempt, errorContext }, 'Retrying with error context');

          const retryResult = await pipeline.run({
            projectId: parsed.data.projectId,
            datasourceId: parsed.data.datasourceId,
            userQuery: parsed.data.query,
            conversationHistory: [
              ...(parsed.data.conversationHistory ?? []),
              { role: 'assistant' as const, content: result.explanation, sql: result.sql },
              {
                role: 'user' as const,
                content: `上一次生成的 SQL 有问题: ${errorContext}，请修正`,
              },
            ],
            dialect: parsed.data.dialect,
          });

          if (retryResult.sql) {
            const revalidation = validator.validate(retryResult.sql);
            if (revalidation.valid) {
              finalResult = retryResult;
              validation = revalidation;
              break;
            }
            validation = revalidation;
          }
        }
      }

      const elapsed = Date.now() - startTime;
      logger?.info?.(
        { elapsed, confidence: finalResult.confidence, valid: validation.valid },
        'Query completed',
      );

      ctx.body = {
        success: true,
        data: { ...finalResult, validation, requestId },
      };
      return;
    }

    ctx.body = { success: true, data: { ...result, requestId } };
  });

  router.post('/stream', async (ctx) => {
    const parsed = querySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }

    const requestId = randomUUID();
    const res = ctx.res;

    // Bypass Koa's response handling — write SSE directly to the raw response
    // so events flush immediately instead of being buffered until handler completes
    ctx.respond = false;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      // CORS: reflect Origin when present (with credentials), fallback to * without credentials
      ...(ctx.get('Origin')
        ? { 'Access-Control-Allow-Origin': ctx.get('Origin'), 'Access-Control-Allow-Credentials': 'true' }
        : { 'Access-Control-Allow-Origin': '*' }),
    });
    res.flushHeaders();

    try {
      let conversationId = parsed.data.conversationId;
      if (!conversationId) {
        const conv = await conversationService.createConversation(
          parsed.data.projectId,
          parsed.data.query.slice(0, 50),
        );
        conversationId = conv.id;
        sendSSE(res, 'conversation', { id: conversationId });
      }

      await conversationService.addMessage({
        conversationId,
        role: 'user',
        content: parsed.data.query,
      });

      const { NL2SqlPipeline, SqlValidator } = await import('@nl2sql/engine');
      const pipeline = new NL2SqlPipeline(db, getPipelineConfig());

      const result = await pipeline.run({
        projectId: parsed.data.projectId,
        datasourceId: parsed.data.datasourceId,
        userQuery: parsed.data.query,
        conversationHistory: parsed.data.conversationHistory,
        dialect: parsed.data.dialect,
        onProgress: (step, message, detail) => sendSSE(res, 'status', { step, message, thinking: detail?.thinking, data: detail?.data }),
        onToken: (token) => sendSSE(res, 'token', { text: token }),
      });

      let finalResult = result;

      if (result.sql) {
        sendSSE(res, 'status', { step: 'sql_validation', message: '正在校验 SQL 安全性...' });

        const validator = new SqlValidator(parsed.data.dialect ?? 'postgresql');
        let validation = validator.validate(result.sql);

        // Error recovery — same retry count as sync endpoint
        if (!validation.valid) {
          sendSSE(res, 'status', { step: 'error_recovery', message: '检测到问题，正在修复...' });

          for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
            const errorContext = validation.errors
              .map((e: { message: string }) => e.message)
              .join('; ');

            const retryResult = await pipeline.run({
              projectId: parsed.data.projectId,
              datasourceId: parsed.data.datasourceId,
              userQuery: parsed.data.query,
              conversationHistory: [
                ...(parsed.data.conversationHistory ?? []),
                { role: 'assistant' as const, content: result.explanation, sql: result.sql },
                {
                  role: 'user' as const,
                  content: `上一次生成的 SQL 有问题: ${errorContext}，请修正`,
                },
              ],
              dialect: parsed.data.dialect,
            });

            if (retryResult.sql) {
              const revalidation = validator.validate(retryResult.sql);
              if (revalidation.valid) {
                finalResult = retryResult;
                validation = revalidation;
                break;
              }
              validation = revalidation;
            }
          }
        }

        sendSSE(res, 'result', { ...finalResult, validation, conversationId, requestId });
      } else {
        sendSSE(res, 'result', { ...finalResult, conversationId, requestId });
      }

      // Execute SQL and recommend chart (best-effort, non-blocking)
      let executionResult: unknown = undefined;
      let chartRecommendation: unknown = undefined;

      if (finalResult.sql) {
        try {
          const { DatasourceService } = await import('../services/datasource-service.js');
          const dsService = new DatasourceService(db);
          const ds = await dsService.getById(parsed.data.datasourceId);

          if (ds?.connectionConfig) {
            sendSSE(res, 'status', { step: 'executing', message: '正在执行查询...' });

            const { QueryExecutor, ChartSelector, verifyChart } = await import('@nl2sql/engine');
            const executor = new QueryExecutor();
            const execResult = await executor.execute(
              finalResult.sql,
              ds.connectionConfig as import('@nl2sql/engine').ExecutionConfig,
              { timeoutMs: 30000, rowLimit: 1000 },
            );

            executionResult = {
              rows: execResult.rows,
              columns: execResult.columns,
              truncated: execResult.truncated,
              executionTimeMs: execResult.executionTimeMs,
            };
            sendSSE(res, 'execution_result', executionResult);

            // LLM-driven chart selection + verification
            sendSSE(res, 'status', { step: 'chart_selection', message: '正在推荐图表类型...' });
            const pipelineConfig = getPipelineConfig();
            const chartSelector = new ChartSelector(
              pipelineConfig.anthropicApiKey,
              pipelineConfig.anthropicBaseUrl,
            );
            let chartConfig = await chartSelector.select(
              parsed.data.query,
              finalResult.sql!,
              execResult.columns,
              execResult.rows.slice(0, 5),
            );

            // Verify and potentially fix chart config
            const chartVerification = await verifyChart(
              chartConfig,
              parsed.data.query,
              finalResult.sql!,
              execResult.columns,
              execResult.rows.slice(0, 5),
              pipelineConfig.anthropicApiKey,
              pipelineConfig.anthropicBaseUrl,
            );

            if (!chartVerification.passed && chartVerification.suggestedFix) {
              chartConfig = chartVerification.suggestedFix;
            }

            chartRecommendation = chartConfig;
            sendSSE(res, 'chart', chartRecommendation);
          }
        } catch (execErr: unknown) {
          const execMsg = execErr instanceof Error ? execErr.message : String(execErr);
          sendSSE(res, 'status', { step: 'execution_error', message: `执行失败: ${execMsg}` });
          process.stderr.write(
            JSON.stringify({ level: 'warn', msg: 'SQL execution failed', error: execMsg }) + '\n',
          );
        }
      }

      // Data insight — LLM analyzes execution results and provides interpretation
      let insightText = '';
      if (executionResult && finalResult.sql) {
        try {
          sendSSE(res, 'status', { step: 'data_insight', message: '正在分析数据...' });
          insightText = await streamDataInsight(
            res,
            parsed.data.query,
            finalResult.sql,
            executionResult as {
              rows: Record<string, unknown>[];
              columns: Array<{ name: string; dataType: string }>;
            },
          );
        } catch {
          /* Insight generation is best-effort */
        }
      }

      // Persist to DB (use insight as content if available, otherwise SQL explanation)
      await conversationService.addMessage({
        conversationId,
        role: 'assistant',
        content: insightText || finalResult.explanation,
        generatedSql: finalResult.sql,
        confidence: finalResult.confidence,
        executionResult: executionResult as Record<string, unknown> | undefined,
        chartConfig: chartRecommendation as Record<string, unknown> | undefined,
      });

      if (finalResult.sql) {
        await conversationService.recordQuery(parsed.data.projectId, {
          naturalLanguage: parsed.data.query,
          generatedSql: finalResult.sql,
          tablesUsed: finalResult.tablesUsed,
        });
      }

      sendSSE(res, 'done', {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.writableEnded) {
        try { sendSSE(res, 'error', { code: 'PIPELINE_ERROR', message, requestId }); } catch { /* socket closed */ }
      }
    } finally {
      res.end();
    }
  });

  router.post('/feedback', async (ctx) => {
    const parsed = feedbackSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }

    const record = await conversationService.recordQuery(parsed.data.projectId, {
      naturalLanguage: parsed.data.naturalLanguage,
      generatedSql: parsed.data.generatedSql,
      correctedSql: parsed.data.correctedSql,
      wasAccepted: parsed.data.wasAccepted,
      status: parsed.data.status,
      isGolden: parsed.data.isGolden,
    });

    ctx.body = { success: true, data: record };
  });

  router.get('/history', async (ctx) => {
    const projectId = ctx.query.projectId as string;
    if (!projectId) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'projectId required' },
      };
      return;
    }

    const records = await conversationService.listQueryHistory(projectId);
    ctx.body = { success: true, data: records };
  });

  return router;
}

const INSIGHT_SYSTEM_PROMPT = `你是一位数据分析专家。用户提出了一个数据问题，系统已经执行 SQL 并返回了结果。

你的任务：
1. 用通俗语言解读数据结果，让非技术人员也能理解
2. 指出数据中的关键发现和趋势
3. 如果数据中有异常值或有趣的 pattern，主动指出
4. 给出 1-2 条基于数据的建议或下一步分析方向

要求：简洁、直接、有洞察力。不要重复 SQL 逻辑，专注于数据本身。使用中文。`;

/**
 * Stream data insight from LLM — analyzes execution results and provides interpretation.
 * Returns the full insight text for persistence.
 */
async function streamDataInsight(
  stream: ServerResponse,
  userQuery: string,
  sql: string,
  executionResult: {
    rows: Record<string, unknown>[];
    columns: Array<{ name: string; dataType: string }>;
  },
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '';

  const client = new Anthropic({
    apiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL ?? undefined,
  });

  // Limit data sent to LLM to avoid token overflow
  const sampleRows = executionResult.rows.slice(0, 50);
  const columnNames = executionResult.columns.map((c) => `${c.name}(${c.dataType})`).join(', ');

  const dataPreview = JSON.stringify(sampleRows, null, 0).slice(0, 3000);

  const userContent = `用户问题：${userQuery}

执行的 SQL：
${sql}

返回列：${columnNames}
总行数：${executionResult.rows.length}

数据（前 ${sampleRows.length} 行）：
${dataPreview}`;

  const llmStream = client.messages.stream(
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: INSIGHT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    },
    { timeout: 30000 },
  );

  let fullText = '';
  llmStream.on('text', (delta) => {
    fullText += delta;
    sendSSE(stream, 'insight_token', { text: delta });
  });

  await llmStream.finalMessage();
  return fullText;
}
