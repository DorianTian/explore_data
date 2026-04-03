import { describe, it, expect, beforeEach } from 'vitest';
import { DatasourceService } from '../../services/datasource-service.js';
import { ProjectService } from '../../services/project-service.js';
import { getTestDb } from '../setup.js';
import { datasources, projects } from '@nl2sql/db';

describe('DatasourceService', () => {
  let service: DatasourceService;
  let projectId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(datasources);
    await db.delete(projects);
    service = new DatasourceService(db);

    const projectService = new ProjectService(db);
    const project = await projectService.create({ name: 'Test Project' });
    projectId = project.id;
  });

  it('creates a datasource', async () => {
    const result = await service.create({
      projectId,
      name: 'Production DB',
      dialect: 'postgresql',
    });
    expect(result.name).toBe('Production DB');
    expect(result.dialect).toBe('postgresql');
    expect(result.projectId).toBe(projectId);
  });

  it('lists datasources by project', async () => {
    await service.create({ projectId, name: 'DS1', dialect: 'mysql' });
    await service.create({ projectId, name: 'DS2', dialect: 'postgresql' });
    const list = await service.listByProject(projectId);
    expect(list).toHaveLength(2);
  });

  it('gets a datasource by id', async () => {
    const created = await service.create({ projectId, name: 'Findable', dialect: 'hive' });
    const found = await service.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Findable');
  });

  it('deletes a datasource', async () => {
    const created = await service.create({ projectId, name: 'Gone', dialect: 'mysql' });
    const deleted = await service.remove(created.id);
    expect(deleted).toBe(true);
    const found = await service.getById(created.id);
    expect(found).toBeNull();
  });
});
