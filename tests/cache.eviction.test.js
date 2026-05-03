import { describe, it, expect, beforeEach } from 'vitest';
import { setCachedResponse, getCachedResponse, clearCache } from '../lib/cache.js';
import { CONFIG } from '../config.js';

beforeEach(() => {
  // reset cache and default TTL
  clearCache();
  CONFIG.CACHE_TTL = 60000;
});

describe('Cache eviction', () => {
  it('evicts entries after TTL', async () => {
    // shorten TTL for test
    CONFIG.CACHE_TTL = 50;

    setCachedResponse('test-key', { foo: 'bar' });
    const present = getCachedResponse('test-key');
    expect(present).not.toBeNull();

    // wait past TTL
    await new Promise((r) => setTimeout(r, 120));

    const after = getCachedResponse('test-key');
    expect(after).toBeNull();
  });
});
