import type Koa from 'koa';
import type { Logger } from 'pino';

export function errorHandler(logger: Logger): Koa.Middleware {
  const isDev = process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production';

  return async (ctx, next) => {
    try {
      await next();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const status =
        'status' in error && typeof (error as { status: unknown }).status === 'number'
          ? (error as { status: number }).status
          : 500;

      ctx.status = status;
      logger.error({ err: error, path: ctx.path, method: ctx.method }, 'request error');

      ctx.body = {
        success: false,
        error: {
          code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
          message:
            status === 500 ? (isDev ? error.message : 'Internal server error') : error.message,
        },
      };
    }
  };
}
