import { describe, it, expect } from 'vitest';
import { redis, redisDeletePattern, redisIsMemory } from '../lib/redis.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Redis realism', () => {
  it('expires TTL keys, deletes matching keys, and respects NX dedupe locks', async () => {
    const ttlKey = `test:ttl:${Date.now()}`;
    await redis.set(ttlKey, '1', 'EX', 1);

    const ttlBefore = await redis.ttl(ttlKey);
    expect(ttlBefore).toBeGreaterThanOrEqual(0);

    await sleep(1100);
    const ttlAfter = await redis.get(ttlKey);
    expect(ttlAfter).toBeNull();

    const patternA = `test:evict:${Date.now()}:a`;
    const patternB = `test:evict:${Date.now()}:b`;
    await redis.set(patternA, '1');
    await redis.set(patternB, '1');

    if (redisIsMemory) {
      expect(redisDeletePattern('test:evict:*')).toBeGreaterThanOrEqual(2);
      expect(await redis.get(patternA)).toBeNull();
      expect(await redis.get(patternB)).toBeNull();
    } else {
      expect(await redis.del(patternA, patternB)).toBeGreaterThanOrEqual(2);
      expect(await redis.get(patternA)).toBeNull();
      expect(await redis.get(patternB)).toBeNull();
    }

    const lockKey = `test:dedupe:${Date.now()}`;
    const firstLock = await redis.set(lockKey, 'a', 'NX', 'PX', 1000);
    const secondLock = await redis.set(lockKey, 'b', 'NX', 'PX', 1000);
    expect(firstLock).toBe('OK');
    expect(secondLock).toBeNull();
  });
});
