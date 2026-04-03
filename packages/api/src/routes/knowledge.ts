import Router from '@koa/router';
import {
  createKnowledgeDocSchema,
  createGlossaryEntrySchema,
  updateGlossaryEntrySchema,
} from '@nl2sql/shared';
import { KnowledgeService } from '../services/knowledge-service.js';
import type { DbClient } from '@nl2sql/db';

export function createKnowledgeRouter(db: DbClient): Router {
  const router = new Router({ prefix: '/api/knowledge' });
  const service = new KnowledgeService(db);

  /** Documents */
  router.post('/docs', async (ctx) => {
    const parsed = createKnowledgeDocSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const result = await service.createDoc(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: result };
  });

  router.get('/docs', async (ctx) => {
    const projectId = ctx.query.projectId as string;
    if (!projectId) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'projectId query param required' },
      };
      return;
    }
    const docs = await service.listDocs(projectId);
    ctx.body = { success: true, data: docs };
  });

  router.get('/docs/:id', async (ctx) => {
    const result = await service.getDoc(ctx.params.id);
    if (!result) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      };
      return;
    }
    ctx.body = { success: true, data: result };
  });

  router.delete('/docs/:id', async (ctx) => {
    const deleted = await service.removeDoc(ctx.params.id);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      };
      return;
    }
    ctx.status = 204;
  });

  /** Glossary */
  router.post('/glossary', async (ctx) => {
    const parsed = createGlossaryEntrySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const entry = await service.createGlossaryEntry(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: entry };
  });

  router.get('/glossary', async (ctx) => {
    const projectId = ctx.query.projectId as string;
    if (!projectId) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'projectId query param required' },
      };
      return;
    }
    const entries = await service.listGlossary(projectId);
    ctx.body = { success: true, data: entries };
  });

  router.patch('/glossary/:id', async (ctx) => {
    const parsed = updateGlossaryEntrySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      };
      return;
    }
    const updated = await service.updateGlossaryEntry(ctx.params.id, parsed.data);
    if (!updated) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Glossary entry not found' },
      };
      return;
    }
    ctx.body = { success: true, data: updated };
  });

  router.delete('/glossary/:id', async (ctx) => {
    const deleted = await service.removeGlossaryEntry(ctx.params.id);
    if (!deleted) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Glossary entry not found' },
      };
      return;
    }
    ctx.status = 204;
  });

  return router;
}
