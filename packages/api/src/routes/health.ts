import Router from '@koa/router';
import type { DbClient } from '@nl2sql/db';
import { sql } from 'drizzle-orm';

export function createHealthRouter(db?: DbClient): Router {
  const router = new Router();

  router.get('/health', async (ctx) => {
    const checks: Record<string, 'ok' | 'error'> = {};

    // DB connectivity
    if (db) {
      try {
        await db.execute(sql`SELECT 1`);
        checks.database = 'ok';
      } catch {
        checks.database = 'error';
      }
    }

    // LLM API keys configured
    checks.anthropic = process.env.ANTHROPIC_API_KEY ? 'ok' : 'error';
    checks.openai = process.env.OPENAI_API_KEY ? 'ok' : 'error';

    const allOk = Object.values(checks).every((v) => v === 'ok');
    ctx.status = allOk ? 200 : 503;
    ctx.body = { status: allOk ? 'ok' : 'degraded', checks };
  });

  return router;
}
