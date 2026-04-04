import Router from '@koa/router';
import { z } from 'zod';
import { DashboardService } from '../services/dashboard-service.js';
import type { DbClient } from '@nl2sql/db';

const createDashboardSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().max(200),
  description: z.string().optional(),
  layoutConfig: z.unknown().optional(),
  isPublic: z.boolean().optional(),
});

const updateDashboardSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().optional(),
  layoutConfig: z.unknown().optional(),
  isPublic: z.boolean().optional(),
});

const addWidgetSchema = z.object({
  widgetId: z.string().uuid(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

const layoutItemSchema = z.object({
  id: z.string().uuid(),
  positionX: z.number().int(),
  positionY: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
});

const updateLayoutSchema = z.object({
  items: z.array(layoutItemSchema),
});

export function createDashboardRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/dashboards' });
  const service = new DashboardService(db);

  router.post('/', async (ctx) => {
    const parsed = createDashboardSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const dashboard = await service.create(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: dashboard };
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
    const result = await service.getWithWidgets(ctx.params.id);
    if (!result) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Dashboard not found' },
      };
      return;
    }
    ctx.body = { success: true, data: result };
  });

  router.patch('/:id', async (ctx) => {
    const parsed = updateDashboardSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const updated = await service.update(ctx.params.id, parsed.data);
    if (!updated) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Dashboard not found' },
      };
      return;
    }
    ctx.body = { success: true, data: updated };
  });

  router.delete('/:id', async (ctx) => {
    const deleted = await service.remove(ctx.params.id);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Dashboard not found' },
      };
      return;
    }
    ctx.status = 204;
  });

  router.post('/:id/widgets', async (ctx) => {
    const parsed = addWidgetSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const placement = await service.addWidget(ctx.params.id, parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: placement };
  });

  router.delete('/:dashboardId/widgets/:placementId', async (ctx) => {
    const deleted = await service.removeWidget(ctx.params.placementId);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Widget placement not found' },
      };
      return;
    }
    ctx.status = 204;
  });

  router.put('/:id/layout', async (ctx) => {
    const parsed = updateLayoutSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const updated = await service.updateLayout(ctx.params.id, parsed.data.items);
    ctx.body = { success: true, data: updated };
  });

  return router;
}
