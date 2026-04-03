import { describe, it, expect } from 'vitest';
import { createTestAgent } from '../helpers.js';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const agent = createTestAgent();
    const res = await agent.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
