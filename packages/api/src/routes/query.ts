import Router from '@koa/router';
import { z } from 'zod';
import { PassThrough } from 'stream';
import type { DbClient } from '@nl2sql/db';
import { ConversationService } from '../services/conversation-service.js';

const querySchema = z.object({
  projectId: z.string().uuid(),
  datasourceId: z.string().uuid(),
  query: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        sql: z.string().optional(),
      }),
    )
    .optional(),
  dialect: z.string().optional(),
});

function sendSSE(stream: PassThrough, event: string, data: unknown) {
  stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createQueryRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/query' });

  /** Standard query endpoint — returns full result */
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
    const pipeline = new NL2SqlPipeline(db, {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
    });

    const result = await pipeline.run({
      projectId: parsed.data.projectId,
      datasourceId: parsed.data.datasourceId,
      userQuery: parsed.data.query,
      conversationHistory: parsed.data.conversationHistory,
      dialect: parsed.data.dialect,
    });

    // Validate generated SQL if present
    if (result.sql) {
      const validator = new SqlValidator(parsed.data.dialect ?? 'postgresql');
      const validation = validator.validate(result.sql);

      if (!validation.valid) {
        // Error recovery: retry with error context (up to 2 times)
        let retryResult = result;
        let retryCount = 0;
        const maxRetries = 2;

        while (!validation.valid && retryCount < maxRetries) {
          retryCount++;
          const errorContext = validation.errors
            .map((e) => `${e.code}: ${e.message}`)
            .join('; ');

          retryResult = await pipeline.run({
            projectId: parsed.data.projectId,
            datasourceId: parsed.data.datasourceId,
            userQuery: `${parsed.data.query}\n\n[Previous SQL had errors: ${errorContext}. Please fix.]`,
            conversationHistory: [
              ...(parsed.data.conversationHistory ?? []),
              { role: 'assistant', content: result.explanation, sql: result.sql },
            ],
            dialect: parsed.data.dialect,
          });

          if (retryResult.sql) {
            const revalidation = validator.validate(retryResult.sql);
            if (revalidation.valid) {
              ctx.body = {
                success: true,
                data: {
                  ...retryResult,
                  validation: revalidation,
                  retried: retryCount,
                },
              };
              return;
            }
          }
        }
      }

      ctx.body = {
        success: true,
        data: { ...result, validation },
      };
      return;
    }

    ctx.body = { success: true, data: result };
  });

  /** SSE streaming query endpoint */
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
      const conversationService = new ConversationService(db);

      // Create or use existing conversation
      let conversationId = parsed.data.conversationId;
      if (!conversationId) {
        const conv = await conversationService.createConversation(
          parsed.data.projectId,
          parsed.data.query.slice(0, 50),
        );
        conversationId = conv.id;
        sendSSE(stream, 'conversation', { id: conversationId });
      }

      // Save user message
      await conversationService.addMessage({
        conversationId,
        role: 'user',
        content: parsed.data.query,
      });

      sendSSE(stream, 'status', { step: 'intent_classification', message: '正在分析查询意图...' });

      const { NL2SqlPipeline, SqlValidator } = await import('@nl2sql/engine');
      const pipeline = new NL2SqlPipeline(db, {
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });

      sendSSE(stream, 'status', { step: 'schema_linking', message: '正在匹配数据模型...' });

      const result = await pipeline.run({
        projectId: parsed.data.projectId,
        datasourceId: parsed.data.datasourceId,
        userQuery: parsed.data.query,
        conversationHistory: parsed.data.conversationHistory,
        dialect: parsed.data.dialect,
      });

      if (result.sql) {
        sendSSE(stream, 'status', { step: 'sql_validation', message: '正在校验 SQL 安全性...' });

        const validator = new SqlValidator(parsed.data.dialect ?? 'postgresql');
        const validation = validator.validate(result.sql);

        if (!validation.valid) {
          sendSSE(stream, 'status', { step: 'error_recovery', message: '检测到问题，正在修复...' });

          // Error recovery retry
          const retryResult = await pipeline.run({
            projectId: parsed.data.projectId,
            datasourceId: parsed.data.datasourceId,
            userQuery: `${parsed.data.query}\n\n[Previous SQL error: ${validation.errors.map((e) => e.message).join('; ')}]`,
            conversationHistory: parsed.data.conversationHistory,
            dialect: parsed.data.dialect,
          });

          if (retryResult.sql) {
            const revalidation = validator.validate(retryResult.sql);
            sendSSE(stream, 'result', {
              ...retryResult,
              validation: revalidation,
              retried: true,
              conversationId,
            });

            await conversationService.addMessage({
              conversationId,
              role: 'assistant',
              content: retryResult.explanation,
              generatedSql: retryResult.sql,
              confidence: retryResult.confidence,
            });

            // Record to data flywheel
            await conversationService.recordQuery(parsed.data.projectId, {
              naturalLanguage: parsed.data.query,
              generatedSql: retryResult.sql,
              tablesUsed: retryResult.tablesUsed,
            });

            sendSSE(stream, 'done', {});
            stream.end();
            return;
          }
        }

        sendSSE(stream, 'result', { ...result, validation, conversationId });

        // Save assistant message
        await conversationService.addMessage({
          conversationId,
          role: 'assistant',
          content: result.explanation,
          generatedSql: result.sql,
          confidence: result.confidence,
        });

        // Data flywheel
        await conversationService.recordQuery(parsed.data.projectId, {
          naturalLanguage: parsed.data.query,
          generatedSql: result.sql,
          tablesUsed: result.tablesUsed,
        });
      } else {
        sendSSE(stream, 'result', { ...result, conversationId });

        await conversationService.addMessage({
          conversationId,
          role: 'assistant',
          content: result.explanation,
          confidence: result.confidence,
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

  /** User feedback endpoint — data flywheel */
  router.post('/feedback', async (ctx) => {
    const feedbackSchema = z.object({
      projectId: z.string().uuid(),
      queryHistoryId: z.string().uuid().optional(),
      naturalLanguage: z.string(),
      generatedSql: z.string(),
      correctedSql: z.string().optional(),
      wasAccepted: z.number().min(0).max(1),
    });

    const parsed = feedbackSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }

    const conversationService = new ConversationService(db);
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
