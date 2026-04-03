import Router from '@koa/router';
import { z } from 'zod';
import { PassThrough } from 'stream';
import type { DbClient } from '@nl2sql/db';
import { ConversationService } from '../services/conversation-service.js';

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
  wasAccepted: z.number().min(0).max(1),
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

    const { NL2SqlPipeline, SqlValidator } = await import('@nl2sql/engine');
    const pipeline = new NL2SqlPipeline(db, getPipelineConfig());

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

      // Error recovery: retry with error context (up to 2 times)
      if (!validation.valid) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const errorContext = validation.errors
            .map((e: { code: string; message: string }) => `${e.code}: ${e.message}`)
            .join('; ');

          const retryResult = await pipeline.run({
            projectId: parsed.data.projectId,
            datasourceId: parsed.data.datasourceId,
            userQuery: `${parsed.data.query}\n\n[上一次生成的 SQL 有问题: ${errorContext}，请修正]`,
            conversationHistory: [
              ...(parsed.data.conversationHistory ?? []),
              { role: 'assistant' as const, content: result.explanation, sql: result.sql },
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

      ctx.body = {
        success: true,
        data: { ...finalResult, validation },
      };
      return;
    }

    ctx.body = { success: true, data: result };
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

        if (!validation.valid) {
          sendSSE(stream, 'status', { step: 'error_recovery', message: '检测到问题，正在修复...' });

          const retryResult = await pipeline.run({
            projectId: parsed.data.projectId,
            datasourceId: parsed.data.datasourceId,
            userQuery: `${parsed.data.query}\n\n[上一次 SQL 有问题: ${validation.errors.map((e: { message: string }) => e.message).join('; ')}]`,
            conversationHistory: parsed.data.conversationHistory,
            dialect: parsed.data.dialect,
          });

          if (retryResult.sql) {
            validation = validator.validate(retryResult.sql);
            if (validation.valid) finalResult = retryResult;
          }
        }

        sendSSE(stream, 'result', { ...finalResult, validation, conversationId });
      } else {
        sendSSE(stream, 'result', { ...finalResult, conversationId });
      }

      // Persist to DB
      await conversationService.addMessage({
        conversationId,
        role: 'assistant',
        content: finalResult.explanation,
        generatedSql: finalResult.sql,
        confidence: finalResult.confidence,
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
      sendSSE(stream, 'error', { message });
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

    const record = await conversationService.recordQuery(
      parsed.data.projectId,
      {
        naturalLanguage: parsed.data.naturalLanguage,
        generatedSql: parsed.data.generatedSql,
        correctedSql: parsed.data.correctedSql,
        wasAccepted: parsed.data.wasAccepted,
      },
    );

    ctx.body = { success: true, data: record };
  });

  return router;
}
