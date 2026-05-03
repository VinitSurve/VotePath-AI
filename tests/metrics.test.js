import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../server.js';

describe('GET /metrics', () => {
  it('returns uptime, requests and cacheSize', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('requests');
    expect(res.body).toHaveProperty('cacheSize');
    expect(typeof res.body.cacheSize).toBe('number');
  });
});
