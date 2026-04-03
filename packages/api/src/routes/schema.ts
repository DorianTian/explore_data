import Router from '@koa/router';
import {
  ingestDdlSchema,
  annotateTableSchema,
  annotateColumnSchema,
} from '@nl2sql/shared';
import { SchemaService } from '../services/schema-service.js';
import type { DbClient } from '@nl2sql/db';

export function createSchemaRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/schema' });
  const service = new SchemaService(db);

  /** Ingest DDL — user feeds DDL, platform parses everything */
  router.post('/ingest/ddl', async (ctx) => {
    const parsed = ingestDdlSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }

    const result = await service.ingestDdl(parsed.data.datasourceId, parsed.data.ddl);
    ctx.status = 201;
    ctx.body = { success: true, data: result };
  });

  router.get('/tables', async (ctx) => {
    const datasourceId = ctx.query.datasourceId as string;
    if (!datasourceId) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'datasourceId query param required',
        },
      };
      return;
    }
    const tables = await service.listTables(datasourceId);
    ctx.body = { success: true, data: tables };
  });

  router.get('/tables/:id', async (ctx) => {
    const result = await service.getTableWithColumns(ctx.params.id);
    if (!result) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Table not found' },
      };
      return;
    }
    ctx.body = { success: true, data: result };
  });

  /** Annotate table — lightweight enrichment after ingest */
  router.patch('/tables/:id', async (ctx) => {
    const parsed = annotateTableSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const updated = await service.annotateTable(ctx.params.id, parsed.data);
    if (!updated) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Table not found' },
      };
      return;
    }
    ctx.body = { success: true, data: updated };
  });

  /** Annotate column — add comment, sample values, mark PII */
  router.patch('/columns/:id', async (ctx) => {
    const parsed = annotateColumnSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const updated = await service.annotateColumn(ctx.params.id, parsed.data);
    if (!updated) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Column not found' },
      };
      return;
    }
    ctx.body = { success: true, data: updated };
  });

  router.delete('/tables/:id', async (ctx) => {
    const deleted = await service.removeTable(ctx.params.id);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Table not found' },
      };
      return;
    }
    ctx.status = 204;
  });

  router.get('/relationships', async (ctx) => {
    const datasourceId = ctx.query.datasourceId as string;
    if (!datasourceId) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'datasourceId query param required',
        },
      };
      return;
    }
    const relationships = await service.listRelationships(datasourceId);
    ctx.body = { success: true, data: relationships };
  });

  return router;
}
