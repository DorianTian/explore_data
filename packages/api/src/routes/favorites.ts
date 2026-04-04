import Router from '@koa/router';
import { z } from 'zod';
import { FavoriteService } from '../services/favorite-service.js';
import type { DbClient } from '@nl2sql/db';

const toggleFavoriteSchema = z.object({
  projectId: z.string().uuid(),
  targetType: z.string().max(20),
  targetId: z.string().uuid(),
});

export function createFavoriteRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/favorites' });
  const service = new FavoriteService(db);

  router.post('/toggle', async (ctx) => {
    const parsed = toggleFavoriteSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const result = await service.toggle(
      parsed.data.projectId,
      parsed.data.targetType,
      parsed.data.targetId,
    );
    ctx.body = { success: true, data: result };
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
    const list = await service.listByProject(projectId);
    ctx.body = { success: true, data: list };
  });

  return router;
}
