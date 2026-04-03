import { describe, it, expect } from 'vitest';
import { DdlParser } from '../../services/ddl-parser.js';

describe('DdlParser', () => {
  const parser = new DdlParser();

  it('parses a basic CREATE TABLE', () => {
    const result = parser.parse(`
      CREATE TABLE users (
        id BIGINT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(200)
      );
    `);

    expect(result).not.toBeNull();
    expect(result!.tableName).toBe('users');
    expect(result!.columns).toHaveLength(3);
    expect(result!.columns[0]).toEqual({
      name: 'id',
      dataType: 'BIGINT',
      comment: null,
      isPrimaryKey: true,
      isNullable: false,
    });
    expect(result!.columns[1].isNullable).toBe(false);
    expect(result!.columns[2].isNullable).toBe(true);
  });

  it('parses columns with DEFAULT and constraints', () => {
    const result = parser.parse(`
      CREATE TABLE orders (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    expect(result!.tableName).toBe('orders');
    expect(result!.columns).toHaveLength(4);
    expect(result!.columns[0].isPrimaryKey).toBe(true);
    expect(result!.columns[1].dataType).toBe('DECIMAL(10,2)');
  });

  it('parses MySQL COMMENT syntax', () => {
    const result = parser.parse(`
      CREATE TABLE products (
        id INT PRIMARY KEY COMMENT 'Product ID',
        name VARCHAR(100) NOT NULL COMMENT 'Product name'
      ) COMMENT='Product catalog';
    `);

    expect(result!.columns[0].comment).toBe('Product ID');
    expect(result!.columns[1].comment).toBe('Product name');
    expect(result!.comment).toBe('Product catalog');
  });

  it('parses PostgreSQL COMMENT ON syntax', () => {
    const result = parser.parse(`
      CREATE TABLE employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
      COMMENT ON TABLE employees IS 'All employees';
      COMMENT ON COLUMN employees.name IS 'Full name';
    `);

    expect(result!.tableName).toBe('employees');
    expect(result!.comment).toBe('All employees');
    expect(result!.columns[1].comment).toBe('Full name');
  });

  it('parses inline FOREIGN KEY references', () => {
    const result = parser.parse(`
      CREATE TABLE orders (
        id INT PRIMARY KEY,
        user_id INT REFERENCES users(id),
        product_id INT NOT NULL
      );
    `);

    expect(result!.foreignKeys).toHaveLength(1);
    expect(result!.foreignKeys[0]).toEqual({
      column: 'user_id',
      referencedTable: 'users',
      referencedColumn: 'id',
    });
  });

  it('parses table-level FOREIGN KEY constraints', () => {
    const result = parser.parse(`
      CREATE TABLE order_items (
        id INT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    expect(result!.foreignKeys).toHaveLength(2);
  });

  it('parses table-level PRIMARY KEY constraint', () => {
    const result = parser.parse(`
      CREATE TABLE logs (
        ts TIMESTAMP NOT NULL,
        level VARCHAR(10),
        message TEXT,
        PRIMARY KEY (ts, level)
      );
    `);

    expect(result!.columns[0].isPrimaryKey).toBe(true);
    expect(result!.columns[1].isPrimaryKey).toBe(true);
  });

  it('handles IF NOT EXISTS', () => {
    const result = parser.parse(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY
      );
    `);
    expect(result!.tableName).toBe('users');
  });

  it('returns null for non-CREATE TABLE', () => {
    expect(parser.parse('SELECT * FROM users')).toBeNull();
  });

  it('parses multiple tables via parseMultiple', () => {
    const results = parser.parseMultiple(`
      CREATE TABLE users (
        id INT PRIMARY KEY,
        name TEXT
      );
      CREATE TABLE orders (
        id INT PRIMARY KEY,
        user_id INT REFERENCES users(id)
      );
    `);

    expect(results).toHaveLength(2);
    expect(results[0].tableName).toBe('users');
    expect(results[1].tableName).toBe('orders');
  });
});
