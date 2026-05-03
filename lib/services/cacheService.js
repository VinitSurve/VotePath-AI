/**
 * Cache Service Layer
 * Wraps Redis plus an in-memory fallback with TTL and LRU eviction.
 */

import { log } from "../logger.js";

const MAX_MEM_ENTRIES = 100;

export class CacheService {
  constructor(redis, config, memoryMode = false) {
    this.redis = redis;
    this.config = config;
    this.memoryMode = memoryMode;
    this.memory = new Map();
    this.waiters = new Map();
  }

  _now() {
    return Date.now();
  }

  _touchMemoryKey(key) {
    if (!this.memory.has(key)) return;
    const entry = this.memory.get(key);
    this.memory.delete(key);
    this.memory.set(key, entry);
  }

  _evictIfNeeded() {
    while (this.memory.size > MAX_MEM_ENTRIES) {
      const oldest = this.memory.keys().next().value;
      this.memory.delete(oldest);
    }
  }

  _setMemory(key, value, ttlMs = null) {
    this.memory.set(key, {
      value,
      expiresAt: ttlMs ? this._now() + ttlMs : null
    });
    this._touchMemoryKey(key);
    this._evictIfNeeded();
  }

  _getMemory(key) {
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= this._now()) {
      this.memory.delete(key);
      return null;
    }
    this._touchMemoryKey(key);
    return entry.value;
  }

  async getCache(key) {
    try {
      if (this.memoryMode) {
        return this._getMemory(key);
      }
      const raw = await this.redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      log("warn", "Cache get error", { key, error: err.message });
      return this._getMemory(key);
    }
  }

  async setCache(key, value, ttlSeconds = null) {
    try {
      const serialized = JSON.stringify(value);
      if (this.memoryMode) {
        this._setMemory(key, value, ttlSeconds ? ttlSeconds * 1000 : null);
        return true;
      }

      if (ttlSeconds) {
        await this.redis.set(key, serialized, "EX", ttlSeconds);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (err) {
      log("warn", "Cache set error", { key, error: err.message });
      this._setMemory(key, value, ttlSeconds ? ttlSeconds * 1000 : null);
      return false;
    }
  }

  async deleteCache(key) {
    try {
      if (this.memoryMode) {
        this.memory.delete(key);
        return true;
      }
      await this.redis.del(key);
      return true;
    } catch (err) {
      log("warn", "Cache delete error", { key, error: err.message });
      this.memory.delete(key);
      return false;
    }
  }

  async acquireLock(key, requestId, ttlMs = 10000) {
    try {
      const lockKey = `lock:${key}`;
      if (this.memoryMode) {
        if (this.memory.has(lockKey)) return false;
        this._setMemory(lockKey, requestId, ttlMs);
        return true;
      }

      const acquired = await this.redis.set(lockKey, requestId, "NX", "PX", ttlMs);
      return Boolean(acquired);
    } catch (err) {
      log("warn", "Lock acquire error", { key, error: err.message });
      return false;
    }
  }

  async releaseLock(key) {
    try {
      const lockKey = `lock:${key}`;
      if (this.memoryMode) {
        this.memory.delete(lockKey);
        const waiter = this.waiters.get(key);
        if (waiter) {
          this.waiters.delete(key);
          waiter.forEach((resolve) => resolve());
        }
        return true;
      }

      await this.redis.del(lockKey);
      const waiter = this.waiters.get(key);
      if (waiter) {
        this.waiters.delete(key);
        waiter.forEach((resolve) => resolve());
      }
      return true;
    } catch (err) {
      log("warn", "Lock release error", { key, error: err.message });
      return false;
    }
  }

  waitForRelease(key, timeoutMs = 10000) {
    return new Promise((resolve) => {
      const existing = this.waiters.get(key) || [];
      existing.push(resolve);
      this.waiters.set(key, existing);
      setTimeout(() => resolve(null), timeoutMs);
    });
  }

  async warmCommonPrompts(entries = []) {
    const ttlSeconds = Math.max(1, Math.floor((this.config?.CACHE_TTL || 60000) / 1000));
    for (const entry of entries) {
      await this.setCache(entry.key, entry.value, ttlSeconds);
    }
  }
}
