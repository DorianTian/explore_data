import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaService } from '../../services/schema-service.js';
import { ProjectService } from '../../services/project-service.js';
import { DatasourceService } from '../../services/datasource-service.js';
import { getTestDb } from '../setup.js';
import {
  schemaColumns,
  schemaTables,
  schemaRelationships,
  datasources,
  projects,
} from '@nl2sql/db';

describe('SchemaService', () => {
  let service: SchemaService;
  let datasourceId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(schemaRelationships);
    await db.delete(schemaColumns);
    await db.delete(schemaTables);
    await db.delete(datasources);
    await db.delete(projects);

    service = new SchemaService(db);

    const project = await new ProjectService(db).create({ name: 'Test' });
    const ds = await new DatasourceService(db).create({
      projectId: project.id,
      name: 'TestDB',
      dialect: 'postgresql',
    });
    datasourceId = ds.id;
  });

  it('ingests a single table DDL', async () => {
    const result = await service.ingestDdl(
      datasourceId,
      `CREATE TABLE users (
        id BIGINT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(200)
      );`,
    );

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].table.name).toBe('users');
    expect(result.tables[0].columns).toHaveLength(3);
    expect(result.tables[0].columns[0].isPrimaryKey).toBe(true);
  });

  it('ingests multiple tables with FK relationships', async () => {
    const result = await service.ingestDdl(
      datasourceId,
      `CREATE TABLE users (
        id INT PRIMARY KEY,
        name TEXT
      );
      CREATE TABLE orders (
        id INT PRIMARY KEY,
        user_id INT REFERENCES users(id),
        amount DECIMAL(10,2)
      );`,
    );

    expect(result.tables).toHaveLength(2);
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].relationshipType).toBe('fk');
  });

  it('throws on invalid DDL', async () => {
    await expect(service.ingestDdl(datasourceId, 'SELECT * FROM foo')).rejects.toThrow(
      'No valid CREATE TABLE statements found',
    );
  });

  it('lists tables after ingest', async () => {
    await service.ingestDdl(
      datasourceId,
      `CREATE TABLE t1 (id INT PRIMARY KEY);
       CREATE TABLE t2 (id INT PRIMARY KEY);`,
    );

    const tables = await service.listTables(datasourceId);
    expect(tables).toHaveLength(2);
  });

  it('gets table with columns', async () => {
    const result = await service.ingestDdl(
      datasourceId,
      `CREATE TABLE products (
        id INT PRIMARY KEY,
        name TEXT NOT NULL,
        price DECIMAL(10,2)
      );`,
    );

    const detail = await service.getTableWithColumns(result.tables[0].table.id);
    expect(detail).not.toBeNull();
    expect(detail!.table.name).toBe('products');
    expect(detail!.columns).toHaveLength(3);
  });

  it('annotates a table comment', async () => {
    const result = await service.ingestDdl(
      datasourceId,
      'CREATE TABLE items (id INT PRIMARY KEY);',
    );

    const updated = await service.annotateTable(result.tables[0].table.id, {
      comment: 'Product items',
    });
    expect(updated!.comment).toBe('Product items');
  });

  it('annotates a column (PII, sample values)', async () => {
    const result = await service.ingestDdl(
      datasourceId,
      `CREATE TABLE users (
        id INT PRIMARY KEY,
        email VARCHAR(200)
      );`,
    );

    const emailCol = result.tables[0].columns.find((c) => c.name === 'email')!;
    const updated = await service.annotateColumn(emailCol.id, {
      isPii: true,
      sampleValues: ['alice@example.com', 'bob@test.com'],
    });
    expect(updated!.isPii).toBe(true);
    expect(updated!.sampleValues).toEqual(['alice@example.com', 'bob@test.com']);
  });

  it('deletes a table', async () => {
    const result = await service.ingestDdl(datasourceId, 'CREATE TABLE temp (id INT PRIMARY KEY);');

    const deleted = await service.removeTable(result.tables[0].table.id);
    expect(deleted).toBe(true);

    const found = await service.getTableWithColumns(result.tables[0].table.id);
    expect(found).toBeNull();
  });
});
