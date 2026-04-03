import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectService } from '../../services/project-service.js';
import { getTestDb } from '../setup.js';
import { projects } from '@nl2sql/db';

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(projects);
    service = new ProjectService(db);
  });

  it('creates a project', async () => {
    const result = await service.create({ name: 'Test Project', description: 'A test' });
    expect(result.name).toBe('Test Project');
    expect(result.description).toBe('A test');
    expect(result.id).toBeDefined();
  });

  it('lists projects', async () => {
    await service.create({ name: 'P1' });
    await service.create({ name: 'P2' });
    const result = await service.list();
    expect(result).toHaveLength(2);
  });

  it('gets a project by id', async () => {
    const created = await service.create({ name: 'Findable' });
    const found = await service.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Findable');
  });

  it('returns null for non-existent project', async () => {
    const found = await service.getById('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('updates a project', async () => {
    const created = await service.create({ name: 'Old Name' });
    const updated = await service.update(created.id, { name: 'New Name' });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New Name');
  });

  it('deletes a project', async () => {
    const created = await service.create({ name: 'To Delete' });
    const deleted = await service.remove(created.id);
    expect(deleted).toBe(true);
    const found = await service.getById(created.id);
    expect(found).toBeNull();
  });
});
