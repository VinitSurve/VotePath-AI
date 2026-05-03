import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

describe('Integration: caching flow', () => {
  it('sends prompt, receives response, then returns cached response on retry', async () => {
    mockGenerate.mockResolvedValueOnce({ response: { text: () => JSON.stringify({ title: 'Integration', steps: [], simple: 'OK', tips: [], source: 'Election Commission of India' }) } });

    const res1 = await request(app).post('/api/ask').send({ prompt: 'integration cache prompt' });
    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data._meta.cached).toBe(false);

    // clear request log to avoid rate limiting
    clearRequestLog();

    const res2 = await request(app).post('/api/ask').send({ prompt: 'integration cache prompt' });
    expect(res2.status).toBe(200);
    // cached response should be indicated in _meta
    expect(res2.body.data._meta.cached).toBe(true);
  });
});
