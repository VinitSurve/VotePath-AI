/**
 * Cache Service Layer
 * Encapsulates all Redis/caching interactions
 */

import { log } from "../logger.js";

export class CacheService {
  constructor(redis, config) {
    this.redis = redis;
    this.config = config;
  }

  async getCached(key) {
    try {
      const raw = await this.redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      log("warn", "Cache get error", { key, error: err.message });
      return null;
    }
  }

  async setCached(key, data, ttlSeconds = null) {
    try {
      const value = JSON.stringify(data);
      if (ttlSeconds) {
        await this.redis.set(key, value, "EX", ttlSeconds);
      } else {
        await this.redis.set(key, value);
      }
      return true;
    } catch (err) {
      log("warn", "Cache set error", { key, error: err.message });
      return false;
    }
  }

  async acquireInflightLock(key, requestId, lockTtlMs = 10000) {
    try {
      const acquired = await this.redis.set(key, requestId, "NX", "PX", lockTtlMs);
      return acquired ? requestId : null;
    } catch (err) {
      log("warn", "Inflight lock error", { key, error: err.message });
      return null;
    }
  }

  async waitForInflightCache(cacheKey, timeoutMs = 10000) {
    const startTime = Date.now();
    const pollIntervalMs = 100;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        log("warn", "Inflight wait error", { cacheKey, error: err.message });
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    return null;
  }

  async releaseInflightLock(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (err) {
      log("warn", "Inflight release error", { key, error: err.message });
      return false;
    }
  }

  generateCacheKey(prompt, context, language, mode) {
    // This should use createHash in the caller for consistency
    // This just formats the key
    return `cache:${this._hashInput(prompt, context, language, mode)}`;
  }

  _hashInput(prompt, context, language, mode) {
    // Caller should handle hashing; this is just a placeholder
    return `${prompt}::${context}::${language}::${mode}`;
  }
}
