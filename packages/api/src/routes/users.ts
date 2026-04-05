import Router from '@koa/router';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { accounts } from '@nl2sql/db';
import type { DbClient } from '@nl2sql/db';

const loginSchema = z.object({
  name: z.string().min(1).max(100),
});

export function createUserRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/users' });

  /** Login or register — find by name, create if not exists */
  router.post('/login', async (ctx) => {
    const parsed = loginSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }

    const [existing] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.name, parsed.data.name));

    if (existing) {
      ctx.body = { success: true, data: existing };
      return;
    }

    const [created] = await db
      .insert(accounts)
      .values({ name: parsed.data.name })
      .returning();

    ctx.status = 201;
    ctx.body = { success: true, data: created };
  });

  router.get('/', async (ctx) => {
    const list = await db.select().from(accounts).orderBy(accounts.createdAt);
    ctx.body = { success: true, data: list };
  });

  return router;
}
