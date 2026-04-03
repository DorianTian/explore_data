import Router from '@koa/router';
import { z } from 'zod';
import { ConversationService } from '../services/conversation-service.js';
import type { DbClient } from '@nl2sql/db';

const createConversationSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().max(200).optional(),
});

const addMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  generatedSql: z.string().optional(),
  executionResult: z.unknown().optional(),
  chartConfig: z.unknown().optional(),
  confidence: z.number().optional(),
});

export function createConversationRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/conversations' });
  const service = new ConversationService(db);

  router.post('/', async (ctx) => {
    const parsed = createConversationSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const conv = await service.createConversation(
      parsed.data.projectId,
      parsed.data.title,
    );
    ctx.status = 201;
    ctx.body = { success: true, data: conv };
  });

  router.get('/', async (ctx) => {
    const projectId = ctx.query.projectId as string;
    if (!projectId) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'projectId required' },
      };
      return;
    }
    const list = await service.listConversations(projectId);
    ctx.body = { success: true, data: list };
  });

  router.get('/:id', async (ctx) => {
    const result = await service.getConversation(ctx.params.id);
    if (!result) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      };
      return;
    }
    ctx.body = { success: true, data: result };
  });

  router.post('/:id/messages', async (ctx) => {
    const parsed = addMessageSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const msg = await service.addMessage({
      conversationId: ctx.params.id,
      ...parsed.data,
    });
    ctx.status = 201;
    ctx.body = { success: true, data: msg };
  });

  router.delete('/:id', async (ctx) => {
    const deleted = await service.deleteConversation(ctx.params.id);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      };
      return;
    }
    ctx.status = 204;
  });

  return router;
}
