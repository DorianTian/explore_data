import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAgent } from '../helpers.js';
import { getTestDb } from '../setup.js';
import { datasources, projects } from '@nl2sql/db';

describe('Datasources API', () => {
  let projectId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(datasources);
    await db.delete(projects);

    const res = await createTestAgent().post('/api/projects').send({ name: 'Test Project' });
    projectId = res.body.data.id;
  });

  describe('POST /api/datasources', () => {
    it('creates a datasource', async () => {
      const res = await createTestAgent().post('/api/datasources').send({
        projectId,
        name: 'My DB',
        dialect: 'postgresql',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('My DB');
      expect(res.body.data.dialect).toBe('postgresql');
    });

    it('rejects invalid dialect', async () => {
      const res = await createTestAgent().post('/api/datasources').send({
        projectId,
        name: 'Bad',
        dialect: 'oracle',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/datasources?projectId=xxx', () => {
    it('lists datasources for a project', async () => {
      const agent = createTestAgent();
      await agent.post('/api/datasources').send({ projectId, name: 'DS1', dialect: 'mysql' });
      await agent.post('/api/datasources').send({ projectId, name: 'DS2', dialect: 'hive' });

      const res = await createTestAgent().get(`/api/datasources?projectId=${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('DELETE /api/datasources/:id', () => {
    it('deletes a datasource', async () => {
      const agent = createTestAgent();
      const created = await agent
        .post('/api/datasources')
        .send({ projectId, name: 'Bye', dialect: 'mysql' });

      const res = await agent.delete(`/api/datasources/${created.body.data.id}`);
      expect(res.status).toBe(204);
    });
  });
});
