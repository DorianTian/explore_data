import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import pino from 'pino';
import type { DbClient } from '@nl2sql/db';
import { errorHandler, requestLogger } from './middleware/index.js';
import {
  createHealthRouter,
  createProjectRouter,
  createDatasourceRouter,
  createSchemaRouter,
  createMetricRouter,
  createKnowledgeRouter,
  createQueryRouter,
  createConversationRouter,
} from './routes/index.js';

export function createApp(db: DbClient) {
  const app = new Koa();
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

  app.context.db = db;
  app.context.logger = logger;

  app.use(errorHandler(logger));
  app.use(requestLogger(logger));
  app.use(cors());
  app.use(bodyParser());

  const routers = [
    createHealthRouter(),
    createProjectRouter(db),
    createDatasourceRouter(db),
    createSchemaRouter(db),
    createMetricRouter(db),
    createKnowledgeRouter(db),
    createQueryRouter(db),
    createConversationRouter(db),
  ];

  for (const router of routers) {
    app.use(router.routes());
    app.use(router.allowedMethods());
  }

  return app;
}
