import supertest from 'supertest';
import { createApp } from '../app.js';
import { getTestDb } from './setup.js';

export function createTestAgent() {
  const db = getTestDb();
  const app = createApp(db);
  return supertest(app.callback());
}
