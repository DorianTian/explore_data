import type Koa from 'koa';
import type { Logger } from 'pino';

export function requestLogger(logger: Logger): Koa.Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.info(
      { method: ctx.method, path: ctx.path, status: ctx.status, ms },
      'request completed',
    );
  };
}
