import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAgent } from '../helpers.js';
import { getTestDb } from '../setup.js';
import {
  schemaRelationships,
  schemaColumns,
  schemaTables,
  datasources,
  projects,
} from '@nl2sql/db';

describe('Schema API', () => {
  let datasourceId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(schemaRelationships);
    await db.delete(schemaColumns);
    await db.delete(schemaTables);
    await db.delete(datasources);
    await db.delete(projects);

    const agent = createTestAgent();
    const projectRes = await agent.post('/api/projects').send({ name: 'Test' });
    const dsRes = await agent.post('/api/datasources').send({
      projectId: projectRes.body.data.id,
      name: 'TestDB',
      dialect: 'postgresql',
    });
    datasourceId = dsRes.body.data.id;
  });

  describe('POST /api/schema/ingest/ddl', () => {
    it('ingests a single table', async () => {
      const res = await createTestAgent()
        .post('/api/schema/ingest/ddl')
        .send({
          datasourceId,
          ddl: `CREATE TABLE users (
          id BIGINT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(200)
        );`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tables).toHaveLength(1);
      expect(res.body.data.tables[0].table.name).toBe('users');
      expect(res.body.data.tables[0].columns).toHaveLength(3);
    });

    it('ingests multiple tables with relationships', async () => {
      const res = await createTestAgent()
        .post('/api/schema/ingest/ddl')
        .send({
          datasourceId,
          ddl: `
          CREATE TABLE users (id INT PRIMARY KEY, name TEXT);
          CREATE TABLE orders (
            id INT PRIMARY KEY,
            user_id INT REFERENCES users(id),
            amount DECIMAL(10,2)
          );
        `,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tables).toHaveLength(2);
      expect(res.body.data.relationships).toHaveLength(1);
    });

    it('rejects invalid DDL', async () => {
      const res = await createTestAgent().post('/api/schema/ingest/ddl').send({
        datasourceId,
        ddl: 'SELECT * FROM foo',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/schema/tables', () => {
    it('lists ingested tables', async () => {
      const agent = createTestAgent();
      await agent.post('/api/schema/ingest/ddl').send({
        datasourceId,
        ddl: `CREATE TABLE t1 (id INT PRIMARY KEY);
              CREATE TABLE t2 (id INT PRIMARY KEY);`,
      });

      const res = await createTestAgent().get(`/api/schema/tables?datasourceId=${datasourceId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/schema/tables/:id', () => {
    it('returns table with columns', async () => {
      const agent = createTestAgent();
      const ingestRes = await agent.post('/api/schema/ingest/ddl').send({
        datasourceId,
        ddl: `CREATE TABLE products (id INT PRIMARY KEY, name TEXT, price DECIMAL(10,2));`,
      });

      const tableId = ingestRes.body.data.tables[0].table.id;
      const res = await createTestAgent().get(`/api/schema/tables/${tableId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.columns).toHaveLength(3);
    });
  });

  describe('PATCH /api/schema/tables/:id (annotate)', () => {
    it('updates table comment', async () => {
      const agent = createTestAgent();
      const ingestRes = await agent.post('/api/schema/ingest/ddl').send({
        datasourceId,
        ddl: 'CREATE TABLE items (id INT PRIMARY KEY);',
      });

      const tableId = ingestRes.body.data.tables[0].table.id;
      const res = await createTestAgent()
        .patch(`/api/schema/tables/${tableId}`)
        .send({ comment: 'Product items table' });

      expect(res.status).toBe(200);
      expect(res.body.data.comment).toBe('Product items table');
    });
  });

  describe('PATCH /api/schema/columns/:id (annotate)', () => {
    it('marks column as PII with sample values', async () => {
      const agent = createTestAgent();
      const ingestRes = await agent.post('/api/schema/ingest/ddl').send({
        datasourceId,
        ddl: `CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(200));`,
      });

      const emailCol = ingestRes.body.data.tables[0].columns.find(
        (c: { name: string }) => c.name === 'email',
      );
      const res = await createTestAgent()
        .patch(`/api/schema/columns/${emailCol.id}`)
        .send({ isPii: true, sampleValues: ['test@example.com'] });

      expect(res.status).toBe(200);
      expect(res.body.data.isPii).toBe(true);
      expect(res.body.data.sampleValues).toEqual(['test@example.com']);
    });
  });

  describe('DELETE /api/schema/tables/:id', () => {
    it('deletes a table', async () => {
      const agent = createTestAgent();
      const ingestRes = await agent.post('/api/schema/ingest/ddl').send({
        datasourceId,
        ddl: 'CREATE TABLE temp (id INT PRIMARY KEY);',
      });

      const tableId = ingestRes.body.data.tables[0].table.id;
      const res = await createTestAgent().delete(`/api/schema/tables/${tableId}`);
      expect(res.status).toBe(204);
    });
  });
});
