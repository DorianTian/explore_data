import Router from '@koa/router';
import { createDatasourceSchema, updateDatasourceSchema } from '@nl2sql/shared';
import { DatasourceService } from '../services/datasource-service.js';
import type { DbClient } from '@nl2sql/db';

export function createDatasourceRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/datasources' });
  const service = new DatasourceService(db);

  router.post('/', async (ctx) => {
    const parsed = createDatasourceSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const datasource = await service.create(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: datasource };
  });

  router.get('/', async (ctx) => {
    const projectId = ctx.query.projectId as string;
    if (!projectId) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'projectId query param required' },
      };
      return;
    }
    const list = await service.listByProject(projectId);
    ctx.body = { success: true, data: list };
  });

  router.get('/:id', async (ctx) => {
    const datasource = await service.getById(ctx.params.id);
    if (!datasource) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Datasource not found' },
      };
      return;
    }
    ctx.body = { success: true, data: datasource };
  });

  router.patch('/:id', async (ctx) => {
    const parsed = updateDatasourceSchema.safeParse(ctx.request.body);
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
        error: { code: 'NOT_FOUND', message: 'Datasource not found' },
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
        error: { code: 'NOT_FOUND', message: 'Datasource not found' },
      };
      return;
    }
    ctx.status = 204;
  });

  return router;
}
