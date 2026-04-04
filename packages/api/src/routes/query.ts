import Router from '@koa/router';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { PassThrough } from 'stream';
import type { DbClient } from '@nl2sql/db';
import { ConversationService } from '../services/conversation-service.js';

const MAX_RETRY_ATTEMPTS = 2;

const querySchema = z.object({
  projectId: z.string().uuid(),
  datasourceId: z.string().uuid(),
  query: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
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

function sendSSE(stream: PassThrough, event: string, data: unknown) {
  stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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

    ctx.set('Content-Type', 'text/event-stream');
    ctx.set('Cache-Control', 'no-cache');
    ctx.set('Connection', 'keep-alive');
    ctx.set('X-Accel-Buffering', 'no');

    const stream = new PassThrough();
    ctx.body = stream;
    ctx.status = 200;

    try {
      let conversationId = parsed.data.conversationId;
      if (!conversationId) {
        const conv = await conversationService.createConversation(
          parsed.data.projectId,
          parsed.data.query.slice(0, 50),
        );
        conversationId = conv.id;
        sendSSE(stream, 'conversation', { id: conversationId });
      }

      await conversationService.addMessage({
        conversationId,
        role: 'user',
        content: parsed.data.query,
      });

      sendSSE(stream, 'status', { step: 'intent_classification', message: '正在分析查询意图...' });

      const { NL2SqlPipeline, SqlValidator } = await import('@nl2sql/engine');
      const pipeline = new NL2SqlPipeline(db, getPipelineConfig());

      sendSSE(stream, 'status', { step: 'schema_linking', message: '正在匹配数据模型...' });

      const result = await pipeline.run({
        projectId: parsed.data.projectId,
        datasourceId: parsed.data.datasourceId,
        userQuery: parsed.data.query,
        conversationHistory: parsed.data.conversationHistory,
        dialect: parsed.data.dialect,
      });

      let finalResult = result;

      if (result.sql) {
        sendSSE(stream, 'status', { step: 'sql_validation', message: '正在校验 SQL 安全性...' });

        const validator = new SqlValidator(parsed.data.dialect ?? 'postgresql');
        let validation = validator.validate(result.sql);

        // Error recovery — same retry count as sync endpoint
        if (!validation.valid) {
          sendSSE(stream, 'status', { step: 'error_recovery', message: '检测到问题，正在修复...' });

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

        sendSSE(stream, 'result', { ...finalResult, validation, conversationId, requestId });
      } else {
        sendSSE(stream, 'result', { ...finalResult, conversationId, requestId });
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
            sendSSE(stream, 'status', { step: 'executing', message: '正在执行查询...' });

            const { QueryExecutor, ChartRecommender } = await import('@nl2sql/engine');
            const executor = new QueryExecutor();
            const execResult = await executor.execute(
              finalResult.sql,
              ds.connectionConfig as never,
              { timeoutMs: 30000, rowLimit: 1000 },
            );

            executionResult = {
              rows: execResult.rows,
              columns: execResult.columns,
              truncated: execResult.truncated,
              executionTimeMs: execResult.executionTimeMs,
            };
            sendSSE(stream, 'execution_result', executionResult);

            const recommender = new ChartRecommender();
            const chart = recommender.recommend(execResult.rows, execResult.columns);
            if (chart) {
              chartRecommendation = {
                chartType: chart.chartType,
                config: chart.config,
              };
              sendSSE(stream, 'chart', chartRecommendation);
            }
          }
        } catch {
          /* execution failure is non-fatal — SQL was already sent */
        }
      }

      // Persist to DB
      await conversationService.addMessage({
        conversationId,
        role: 'assistant',
        content: finalResult.explanation,
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

      sendSSE(stream, 'done', {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      sendSSE(stream, 'error', { code: 'PIPELINE_ERROR', message, requestId });
    } finally {
      stream.end();
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
