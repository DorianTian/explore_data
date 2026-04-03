import Router from '@koa/router';
import { createProjectSchema, updateProjectSchema } from '@nl2sql/shared';
import { ProjectService } from '../services/project-service.js';
import type { DbClient } from '@nl2sql/db';

export function createProjectRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/projects' });
  const service = new ProjectService(db);

  router.post('/', async (ctx) => {
    const parsed = createProjectSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const project = await service.create(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: project };
  });

  router.get('/', async (ctx) => {
    const list = await service.list();
    ctx.body = { success: true, data: list };
  });

  router.get('/:id', async (ctx) => {
    const project = await service.getById(ctx.params.id);
    if (!project) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      };
      return;
    }
    ctx.body = { success: true, data: project };
  });

  router.patch('/:id', async (ctx) => {
    const parsed = updateProjectSchema.safeParse(ctx.request.body);
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
        error: { code: 'NOT_FOUND', message: 'Project not found' },
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
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      };
      return;
    }
    ctx.status = 204;
  });

  return router;
}
