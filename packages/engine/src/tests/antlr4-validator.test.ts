import { describe, it, expect } from 'vitest';
import { validateSql } from '../antlr4-validator.js';

describe('ANTLR4 SQL Validator', () => {
  describe('valid SELECT statements', () => {
    it('parses a basic SELECT', () => {
      const result = validateSql('SELECT id, name FROM users LIMIT 10');
      expect(result.valid).toBe(true);
      expect(result.statementType).toBe('select');
      expect(result.errors).toHaveLength(0);
    });

    it('parses SELECT with WHERE', () => {
      const result = validateSql("SELECT id FROM users WHERE name = 'Alice'");
      expect(result.valid).toBe(true);
      expect(result.tables).toContain('users');
    });

    it('parses SELECT with JOIN', () => {
      const result = validateSql(
        'SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id LIMIT 10',
      );
      expect(result.valid).toBe(true);
      expect(result.tables).toContain('users');
      expect(result.tables).toContain('orders');
    });

    it('parses SELECT with LEFT JOIN', () => {
      const result = validateSql(
        'SELECT u.name, o.amount FROM users u LEFT JOIN orders o ON u.id = o.user_id',
      );
      expect(result.valid).toBe(true);
      expect(result.tables).toContain('users');
      expect(result.tables).toContain('orders');
    });

    it('parses aggregation with GROUP BY', () => {
      const result = validateSql(
        'SELECT status, SUM(amount) AS total FROM orders GROUP BY status',
      );
      expect(result.valid).toBe(true);
      expect(result.tables).toContain('orders');
    });

    it('parses aggregation with HAVING', () => {
      const result = validateSql(
        'SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status HAVING COUNT(*) > 5',
      );
      expect(result.valid).toBe(true);
    });

    it('parses ORDER BY with ASC/DESC', () => {
      const result = validateSql(
        'SELECT name, amount FROM orders ORDER BY amount DESC, name ASC',
      );
      expect(result.valid).toBe(true);
    });

    it('parses LIMIT and OFFSET', () => {
      const result = validateSql('SELECT id FROM users LIMIT 10 OFFSET 20');
      expect(result.valid).toBe(true);
    });

    it('parses subquery in WHERE', () => {
      const result = validateSql(
        'SELECT name FROM users WHERE id IN (SELECT user_id FROM orders WHERE amount > 100)',
      );
      expect(result.valid).toBe(true);
      expect(result.tables).toContain('users');
      expect(result.tables).toContain('orders');
    });

    it('parses correlated subquery in SELECT', () => {
      const result = validateSql(
        'SELECT name, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count FROM users u',
      );
      expect(result.valid).toBe(true);
    });

    it('parses DISTINCT', () => {
      const result = validateSql('SELECT DISTINCT status FROM orders');
      expect(result.valid).toBe(true);
    });

    it('parses UNION', () => {
      const result = validateSql(
        'SELECT name FROM users UNION SELECT name FROM admins',
      );
      expect(result.valid).toBe(true);
    });

    it('parses UNION ALL', () => {
      const result = validateSql(
        'SELECT name FROM users UNION ALL SELECT name FROM admins',
      );
      expect(result.valid).toBe(true);
    });

    it('parses CTE (WITH clause)', () => {
      const result = validateSql(
        'WITH active_users AS (SELECT id, name FROM users WHERE status = 1) SELECT name FROM active_users',
      );
      expect(result.valid).toBe(true);
    });

    it('parses CASE expression', () => {
      const result = validateSql(
        "SELECT CASE WHEN amount > 100 THEN 'high' WHEN amount > 50 THEN 'medium' ELSE 'low' END AS tier FROM orders",
      );
      expect(result.valid).toBe(true);
    });

    it('parses CAST expression', () => {
      const result = validateSql(
        'SELECT CAST(amount AS DECIMAL(10, 2)) FROM orders',
      );
      expect(result.valid).toBe(true);
    });

    it('parses IS NULL / IS NOT NULL', () => {
      const result = validateSql(
        'SELECT name FROM users WHERE email IS NOT NULL',
      );
      expect(result.valid).toBe(true);
    });

    it('parses BETWEEN', () => {
      const result = validateSql(
        'SELECT id FROM orders WHERE amount BETWEEN 10 AND 100',
      );
      expect(result.valid).toBe(true);
    });

    it('parses LIKE', () => {
      const result = validateSql(
        "SELECT name FROM users WHERE name LIKE '%alice%'",
      );
      expect(result.valid).toBe(true);
    });

    it('parses EXISTS subquery', () => {
      const result = validateSql(
        'SELECT name FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)',
      );
      expect(result.valid).toBe(true);
    });

    it('parses SELECT *', () => {
      const result = validateSql('SELECT * FROM users');
      expect(result.valid).toBe(true);
    });

    it('parses table.* wildcard', () => {
      const result = validateSql('SELECT u.* FROM users u');
      expect(result.valid).toBe(true);
    });

    it('parses multiple JOINs', () => {
      const result = validateSql(
        'SELECT u.name, o.amount, p.name AS product ' +
          'FROM users u ' +
          'JOIN orders o ON u.id = o.user_id ' +
          'JOIN products p ON o.product_id = p.id',
      );
      expect(result.valid).toBe(true);
      expect(result.tables).toContain('users');
      expect(result.tables).toContain('orders');
      expect(result.tables).toContain('products');
    });

    it('handles comments in SQL', () => {
      const result = validateSql(
        '-- this is a comment\nSELECT id FROM users /* inline comment */ LIMIT 10',
      );
      expect(result.valid).toBe(true);
    });

    it('handles trailing semicolon', () => {
      const result = validateSql('SELECT id FROM users;');
      expect(result.valid).toBe(true);
    });
  });

  describe('table extraction', () => {
    it('extracts single table', () => {
      const result = validateSql('SELECT id FROM users');
      expect(result.tables).toEqual(['users']);
    });

    it('extracts joined tables', () => {
      const result = validateSql(
        'SELECT u.id, o.amount FROM users u INNER JOIN orders o ON u.id = o.user_id',
      );
      expect(result.tables).toContain('users');
      expect(result.tables).toContain('orders');
      expect(result.tables).toHaveLength(2);
    });

    it('extracts tables from subqueries', () => {
      const result = validateSql(
        'SELECT name FROM users WHERE id IN (SELECT user_id FROM orders)',
      );
      expect(result.tables).toContain('users');
      expect(result.tables).toContain('orders');
    });

    it('deduplicates table names', () => {
      const result = validateSql(
        'SELECT a.id FROM users a JOIN users b ON a.id = b.id',
      );
      expect(result.tables).toEqual(['users']);
    });

    it('handles backtick-quoted identifiers', () => {
      const result = validateSql('SELECT id FROM `user_table`');
      expect(result.tables).toContain('user_table');
    });

    it('handles double-quoted identifiers', () => {
      const result = validateSql('SELECT id FROM "user_table"');
      expect(result.tables).toContain('user_table');
    });
  });

  describe('column extraction', () => {
    it('extracts simple column names', () => {
      const result = validateSql('SELECT name, email FROM users');
      expect(result.columns).toContain('name');
      expect(result.columns).toContain('email');
    });

    it('extracts qualified column names', () => {
      const result = validateSql('SELECT u.name, u.email FROM users u');
      expect(result.columns).toContain('u.name');
      expect(result.columns).toContain('u.email');
    });
  });

  describe('statement type detection', () => {
    it('detects SELECT', () => {
      const result = validateSql('SELECT 1');
      expect(result.statementType).toBe('select');
    });

    it('rejects INSERT', () => {
      const result = validateSql("INSERT INTO users (name) VALUES ('evil')");
      expect(result.valid).toBe(false);
      expect(result.statementType).toBe('dml');
    });

    it('rejects UPDATE', () => {
      const result = validateSql("UPDATE users SET name = 'hacked'");
      expect(result.valid).toBe(false);
      expect(result.statementType).toBe('dml');
    });

    it('rejects DELETE', () => {
      const result = validateSql('DELETE FROM users WHERE id = 1');
      expect(result.valid).toBe(false);
      expect(result.statementType).toBe('dml');
    });

    it('rejects DROP TABLE', () => {
      const result = validateSql('DROP TABLE users');
      expect(result.valid).toBe(false);
      expect(result.statementType).toBe('ddl');
    });

    it('rejects CREATE TABLE', () => {
      const result = validateSql('CREATE TABLE evil (id INT)');
      expect(result.valid).toBe(false);
      expect(result.statementType).toBe('ddl');
    });

    it('rejects ALTER TABLE', () => {
      const result = validateSql('ALTER TABLE users ADD COLUMN hacked TEXT');
      expect(result.valid).toBe(false);
      expect(result.statementType).toBe('ddl');
    });

    it('rejects TRUNCATE', () => {
      const result = validateSql('TRUNCATE TABLE users');
      expect(result.valid).toBe(false);
      expect(result.statementType).toBe('ddl');
    });
  });

  describe('syntax error detection', () => {
    it('reports syntax errors', () => {
      const result = validateSql('SELCT id FROM users');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reports unbalanced parentheses', () => {
      const result = validateSql('SELECT id FROM users WHERE id IN (1, 2');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
