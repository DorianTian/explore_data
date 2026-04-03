import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAgent } from '../helpers.js';
import { getTestDb } from '../setup.js';
import { projects } from '@nl2sql/db';

describe('Projects API', () => {
  beforeEach(async () => {
    await getTestDb().delete(projects);
  });

  describe('POST /api/projects', () => {
    it('creates a project', async () => {
      const res = await createTestAgent()
        .post('/api/projects')
        .send({ name: 'My Project', description: 'Test' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('My Project');
    });

    it('rejects empty name', async () => {
      const res = await createTestAgent().post('/api/projects').send({ name: '' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/projects', () => {
    it('lists all projects', async () => {
      const agent = createTestAgent();
      await agent.post('/api/projects').send({ name: 'P1' });
      await agent.post('/api/projects').send({ name: 'P2' });

      const res = await createTestAgent().get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns 404 for non-existent project', async () => {
      const res = await createTestAgent().get(
        '/api/projects/00000000-0000-0000-0000-000000000000',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('deletes a project', async () => {
      const agent = createTestAgent();
      const created = await agent.post('/api/projects').send({ name: 'Bye' });
      const res = await agent.delete(`/api/projects/${created.body.data.id}`);
      expect(res.status).toBe(204);
    });
  });
});
