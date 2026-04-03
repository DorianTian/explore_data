import { beforeAll, afterAll } from 'vitest';
import { createDbClient, type DbClient } from '@nl2sql/db';

let db: DbClient;

export function getTestDb(): DbClient {
  return db;
}

beforeAll(() => {
  const url =
    process.env.DATABASE_URL ?? 'postgresql://tianqiyin:@localhost:5432/nl2sql';
  db = createDbClient(url);
});

afterAll(async () => {
  // Pool cleanup handled by process exit in tests
});
