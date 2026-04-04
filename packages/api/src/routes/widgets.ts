import Router from '@koa/router';
import { z } from 'zod';
import { WidgetService } from '../services/widget-service.js';
import type { DbClient } from '@nl2sql/db';

const uuidSchema = z.string().uuid();

const createWidgetSchema = z.object({
  projectId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  naturalLanguage: z.string().min(1),
  sql: z.string().min(1),
  chartType: z.string().min(1).max(30),
  chartConfig: z.unknown(),
  dataSnapshot: z.unknown().optional(),
  datasourceId: z.string().uuid(),
  isLive: z.boolean().optional(),
});

const updateWidgetSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().optional(),
  naturalLanguage: z.string().min(1).optional(),
  sql: z.string().min(1).optional(),
  chartType: z.string().max(30).optional(),
  chartConfig: z.unknown().optional(),
  dataSnapshot: z.unknown().optional(),
  datasourceId: z.string().uuid().optional(),
  isLive: z.boolean().optional(),
});

export function createWidgetRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/widgets' });
  const service = new WidgetService(db);

  router.post('/', async (ctx) => {
    const parsed = createWidgetSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const widget = await service.create({
      ...parsed.data,
      chartConfig: parsed.data.chartConfig ?? {},
    });
    ctx.status = 201;
    ctx.body = { success: true, data: widget };
  });

  router.get('/', async (ctx) => {
    const result = z.string().uuid().safeParse(ctx.query.projectId);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'projectId must be a valid UUID' },
      };
      return;
    }
    const list = await service.listByProject(result.data);
    ctx.body = { success: true, data: list };
  });

  router.get('/:id', async (ctx) => {
    const idResult = uuidSchema.safeParse(ctx.params.id);
    if (!idResult.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'id must be a valid UUID' } };
      return;
    }
    const widget = await service.getById(idResult.data);
    if (!widget) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Widget not found' },
      };
      return;
    }
    ctx.body = { success: true, data: widget };
  });

  router.patch('/:id', async (ctx) => {
    const idResult = uuidSchema.safeParse(ctx.params.id);
    if (!idResult.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'id must be a valid UUID' } };
      return;
    }
    const parsed = updateWidgetSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const updated = await service.update(idResult.data, parsed.data);
    if (!updated) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Widget not found' },
      };
      return;
    }
    ctx.body = { success: true, data: updated };
  });

  router.delete('/:id', async (ctx) => {
    const idResult = uuidSchema.safeParse(ctx.params.id);
    if (!idResult.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'id must be a valid UUID' } };
      return;
    }
    const deleted = await service.remove(idResult.data);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Widget not found' },
      };
      return;
    }
    ctx.status = 204;
  });

  return router;
}
