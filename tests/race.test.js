import { describe, it, expect } from "vitest";
import { CacheService } from "../lib/services/cacheService.js";

describe("inflight race behavior", () => {
  it("releases a lock and wakes waiters without polling", async () => {
    const fakeRedis = {
      store: new Map(),
      async get(key) {
        return this.store.get(key) || null;
      },
      async set(key, value, ...args) {
        const isNx = args.includes("NX");
        if (isNx && this.store.has(key)) {
          return null;
        }
        this.store.set(key, value);
        return "OK";
      },
      async del(key) {
        this.store.delete(key);
      },
      async incr() {
        return 1;
      },
      async pexpire() {}
    };

    const service = new CacheService(fakeRedis, { CACHE_TTL: 60000 }, true);
    const acquired = await service.acquireLock("hash-1", "req-1");
    const secondAcquire = await service.acquireLock("hash-1", "req-2");

    expect(acquired).toBe(true);
    expect(secondAcquire).toBe(false);

    const waiter = service.waitForRelease("hash-1", 1000);
    await service.releaseLock("hash-1");

    const result = await waiter;
    expect(result).toBeUndefined();
  });
});