import Router from '@koa/router';
import { z } from 'zod';
import type { DbClient } from '@nl2sql/db';

const querySchema = z.object({
  projectId: z.string().uuid(),
  datasourceId: z.string().uuid(),
  query: z.string().min(1),
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

export function createQueryRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/query' });

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

    // Lazy import to avoid loading LLM SDK when not needed
    const { NL2SqlPipeline } = await import('@nl2sql/engine');

    const pipeline = new NL2SqlPipeline(db, {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await pipeline.run({
      projectId: parsed.data.projectId,
      datasourceId: parsed.data.datasourceId,
      userQuery: parsed.data.query,
      conversationHistory: parsed.data.conversationHistory,
      dialect: parsed.data.dialect,
    });

    ctx.body = { success: true, data: result };
  });

  return router;
}
