import { describe, it, expect } from 'vitest';
import { SchemaLinker } from '../schema-linker.js';
import type { SchemaContext } from '../types.js';

describe('SchemaLinker', () => {
  const mockSchema: SchemaContext = {
    tables: [
      {
        name: 'users',
        comment: 'User accounts',
        columns: [
          { name: 'id', dataType: 'BIGINT', comment: 'User ID', sampleValues: null, isPrimaryKey: true },
          { name: 'name', dataType: 'VARCHAR(100)', comment: 'Full name', sampleValues: ['Alice', 'Bob'], isPrimaryKey: false },
          { name: 'email', dataType: 'VARCHAR(200)', comment: null, sampleValues: null, isPrimaryKey: false },
        ],
      },
      {
        name: 'orders',
        comment: 'Order records',
        columns: [
          { name: 'id', dataType: 'INT', comment: null, sampleValues: null, isPrimaryKey: true },
          { name: 'user_id', dataType: 'INT', comment: 'FK to users', sampleValues: null, isPrimaryKey: false },
          { name: 'amount', dataType: 'DECIMAL(10,2)', comment: 'Order amount', sampleValues: ['99.99', '150.00'], isPrimaryKey: false },
        ],
      },
    ],
    relationships: [
      { fromTable: 'orders', fromColumn: 'user_id', toTable: 'users', toColumn: 'id' },
    ],
  };

  it('formats schema as DDL with comments and sample values', () => {
    const linker = new SchemaLinker(null as never);
    const ddl = linker.formatAsDdl(mockSchema);

    expect(ddl).toContain('CREATE TABLE users');
    expect(ddl).toContain('-- User accounts');
    expect(ddl).toContain("-- Full name, e.g. 'Alice', 'Bob'");
    expect(ddl).toContain('CREATE TABLE orders');
    expect(ddl).toContain("-- Order amount, e.g. '99.99', '150.00'");
    expect(ddl).toContain('-- orders.user_id -> users.id');
  });

  it('includes PRIMARY KEY in DDL output', () => {
    const linker = new SchemaLinker(null as never);
    const ddl = linker.formatAsDdl(mockSchema);

    expect(ddl).toContain('id BIGINT PRIMARY KEY');
  });
});
