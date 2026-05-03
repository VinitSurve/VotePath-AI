import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ensure rate limit middleware is inactive for this test
process.env.ENABLE_RATE_LIMIT_TEST = 'false';

const mockGenerate = vi.fn();
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: function () {
      return {
        getGenerativeModel: () => ({
          generateContent: mockGenerate
        })
      };
    }
  };
});

import { app, clearRequestLog } from '../server.js';

beforeEach(() => {
  mockGenerate.mockReset();
  try { clearRequestLog(); } catch (e) {}
});

describe('In-flight deduplication', () => {
  it('dedupes concurrent identical requests', async () => {
    // slow response to allow concurrency
    mockGenerate.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({
      response: { text: () => JSON.stringify({ title: 'T', steps: [], simple: 'S', tips: [], source: 'Election Commission of India' }) }
    }), 150)));

    // send two requests in parallel
    const req1 = request(app).post('/api/ask').send({ prompt: 'dedupe-test' });
    // small delay before sending second to ensure first registers in-flight
    await new Promise(r => setTimeout(r, 10));
    const req2 = request(app).post('/api/ask').send({ prompt: 'dedupe-test' });

    const [res1, res2] = await Promise.all([req1, req2]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // One should be a miss and the other deduped
    const caches = [res1.headers['x-cache'], res2.headers['x-cache']].sort();
    expect(caches).toEqual(['deduped', 'miss']);

    // responses should contain same data contract
    expect(res1.body.data).toHaveProperty('title');
    expect(res2.body.data).toHaveProperty('title');
  });
});
