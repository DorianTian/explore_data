import { describe, it, expect } from 'vitest';
import { SqlValidator } from '../sql-validator.js';
import type { SchemaContext } from '../types.js';

const testSchema: SchemaContext = {
  tables: [
    {
      name: 'users',
      comment: null,
      columns: [
        { name: 'id', dataType: 'INT', comment: null, sampleValues: null, isPrimaryKey: true },
        {
          name: 'name',
          dataType: 'VARCHAR',
          comment: null,
          sampleValues: null,
          isPrimaryKey: false,
        },
        {
          name: 'email',
          dataType: 'VARCHAR',
          comment: null,
          sampleValues: null,
          isPrimaryKey: false,
        },
      ],
    },
    {
      name: 'orders',
      comment: null,
      columns: [
        { name: 'id', dataType: 'INT', comment: null, sampleValues: null, isPrimaryKey: true },
        {
          name: 'user_id',
          dataType: 'INT',
          comment: null,
          sampleValues: null,
          isPrimaryKey: false,
        },
        {
          name: 'amount',
          dataType: 'DECIMAL',
          comment: null,
          sampleValues: null,
          isPrimaryKey: false,
        },
        {
          name: 'status',
          dataType: 'VARCHAR',
          comment: null,
          sampleValues: null,
          isPrimaryKey: false,
        },
      ],
    },
  ],
  relationships: [],
};

describe('SqlValidator', () => {
  const validator = new SqlValidator('mysql');

  describe('valid queries', () => {
    it('accepts a basic SELECT', () => {
      const result = validator.validate('SELECT id, name FROM users LIMIT 10');
      expect(result.valid).toBe(true);
      expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });

    it('accepts a query with JOIN', () => {
      const result = validator.validate(
        'SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id LIMIT 10',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts aggregation queries', () => {
      const result = validator.validate(
        'SELECT status, SUM(amount) AS total FROM orders GROUP BY status',
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('blocked statements', () => {
    it('blocks DROP TABLE', () => {
      const result = validator.validate('DROP TABLE users');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('BLOCKED_STATEMENT');
    });

    it('blocks DELETE', () => {
      const result = validator.validate('DELETE FROM users WHERE id = 1');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('BLOCKED_STATEMENT');
    });

    it('blocks UPDATE', () => {
      const result = validator.validate("UPDATE users SET name = 'hacked' WHERE id = 1");
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('BLOCKED_STATEMENT');
    });

    it('blocks INSERT', () => {
      const result = validator.validate("INSERT INTO users (name) VALUES ('evil')");
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('BLOCKED_STATEMENT');
    });

    it('blocks TRUNCATE', () => {
      const result = validator.validate('TRUNCATE TABLE users');
      expect(result.valid).toBe(false);
    });

    it('blocks ALTER', () => {
      const result = validator.validate('ALTER TABLE users ADD COLUMN hacked TEXT');
      expect(result.valid).toBe(false);
    });
  });

  describe('danger pattern warnings', () => {
    it('warns on SELECT * without LIMIT', () => {
      const result = validator.validate('SELECT * FROM users');
      expect(result.errors.some((e) => e.code === 'SELECT_STAR_NO_LIMIT')).toBe(true);
    });

    it('warns on CROSS JOIN', () => {
      const result = validator.validate('SELECT * FROM users CROSS JOIN orders LIMIT 10');
      expect(result.errors.some((e) => e.code === 'CROSS_JOIN')).toBe(true);
    });
  });

  describe('schema cross-validation', () => {
    it('rejects unknown table', () => {
      const result = validator.validate('SELECT * FROM nonexistent LIMIT 10', testSchema);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_TABLE')).toBe(true);
    });

    it('accepts known table', () => {
      const result = validator.validate('SELECT id, name FROM users LIMIT 10', testSchema);
      const tableErrors = result.errors.filter((e) => e.code === 'UNKNOWN_TABLE');
      expect(tableErrors).toHaveLength(0);
    });
  });

  describe('table and column extraction', () => {
    it('extracts table references', () => {
      const result = validator.validate(
        'SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id',
      );
      expect(result.tablesReferenced).toContain('users');
      expect(result.tablesReferenced).toContain('orders');
    });
  });
});
