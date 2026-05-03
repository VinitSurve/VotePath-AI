import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../server.js';

describe('GET /health', () => {
  it('returns the unified response contract', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('errorType');
    expect(res.body).toHaveProperty('statusCode');
    expect(res.body).toHaveProperty('requestId');
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('timestamp');
  });
});
