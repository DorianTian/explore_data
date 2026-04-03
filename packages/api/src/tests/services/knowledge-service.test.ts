import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeService } from '../../services/knowledge-service.js';
import { ProjectService } from '../../services/project-service.js';
import { getTestDb } from '../setup.js';
import {
  knowledgeDocs,
  knowledgeChunks,
  glossaryEntries,
  projects,
} from '@nl2sql/db';

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let projectId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(knowledgeChunks);
    await db.delete(knowledgeDocs);
    await db.delete(glossaryEntries);
    await db.delete(projects);
    service = new KnowledgeService(db);

    const project = await new ProjectService(db).create({ name: 'Test' });
    projectId = project.id;
  });

  describe('Documents', () => {
    it('creates a doc and splits into chunks', async () => {
      const result = await service.createDoc({
        projectId,
        title: 'Data Dictionary',
        content: 'This is a short doc about the data model.',
        docType: 'document',
      });

      expect(result.doc.title).toBe('Data Dictionary');
      expect(result.chunkCount).toBe(1);
    });

    it('lists docs by project', async () => {
      await service.createDoc({
        projectId,
        title: 'Doc 1',
        content: 'Content 1',
        docType: 'document',
      });
      await service.createDoc({
        projectId,
        title: 'Doc 2',
        content: 'Content 2',
        docType: 'template',
      });

      const docs = await service.listDocs(projectId);
      expect(docs).toHaveLength(2);
    });

    it('gets doc with chunks', async () => {
      const created = await service.createDoc({
        projectId,
        title: 'Test Doc',
        content: 'Some content here',
        docType: 'document',
      });

      const result = await service.getDoc(created.doc.id);
      expect(result).not.toBeNull();
      expect(result!.doc.title).toBe('Test Doc');
      expect(result!.chunks).toHaveLength(1);
    });

    it('deletes a doc and cascades to chunks', async () => {
      const created = await service.createDoc({
        projectId,
        title: 'Temp',
        content: 'Temp content',
        docType: 'document',
      });
      const deleted = await service.removeDoc(created.doc.id);
      expect(deleted).toBe(true);

      const found = await service.getDoc(created.doc.id);
      expect(found).toBeNull();
    });
  });

  describe('Glossary', () => {
    it('creates a glossary entry', async () => {
      const entry = await service.createGlossaryEntry({
        projectId,
        term: '活跃用户',
        sqlExpression: "WHERE last_login > NOW() - INTERVAL '30 days'",
        description: '30天内有登录行为的用户',
      });

      expect(entry.term).toBe('活跃用户');
      expect(entry.sqlExpression).toContain('last_login');
    });

    it('lists glossary entries', async () => {
      await service.createGlossaryEntry({
        projectId,
        term: 'GMV',
        sqlExpression: "SUM(amount) WHERE status = 'completed'",
      });
      await service.createGlossaryEntry({
        projectId,
        term: 'DAU',
        sqlExpression: 'COUNT(DISTINCT user_id)',
      });

      const entries = await service.listGlossary(projectId);
      expect(entries).toHaveLength(2);
    });

    it('updates a glossary entry', async () => {
      const entry = await service.createGlossaryEntry({
        projectId,
        term: 'Old Term',
        sqlExpression: 'COUNT(*)',
      });

      const updated = await service.updateGlossaryEntry(entry.id, {
        term: 'New Term',
        description: 'Updated description',
      });
      expect(updated!.term).toBe('New Term');
      expect(updated!.description).toBe('Updated description');
    });

    it('deletes a glossary entry', async () => {
      const entry = await service.createGlossaryEntry({
        projectId,
        term: 'Temp',
        sqlExpression: 'SELECT 1',
      });
      const deleted = await service.removeGlossaryEntry(entry.id);
      expect(deleted).toBe(true);
    });
  });
});
