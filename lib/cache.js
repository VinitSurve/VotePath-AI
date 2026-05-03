/**
 * Cache Management Module
 * Handles response caching with TTL and LRU eviction
 */

import { CONFIG } from '../config.js';

const cache = new Map();
let cacheStats = { hits: 0, misses: 0 };

/**
 * Get cached response if valid (not expired)
 * @param {string} key - Cache key
 * @returns {object|null} Cached data or null if expired/missing
 */
export function getCachedResponse(key) {
  if (!cache.has(key)) {
    cacheStats.misses++;
    return null;
  }

  const cached = cache.get(key);
  const age = Date.now() - cached.time;

  if (age > CONFIG.CACHE_TTL) {
    cache.delete(key);
    cacheStats.misses++;
    return null;
  }

  cacheStats.hits++;
  return { ...cached.data };
}

/**
 * Store response in cache
 * @param {string} key - Cache key
 * @param {object} data - Response data to cache
 */
export function setCachedResponse(key, data) {
  cache.set(key, { data, time: Date.now() });

  // LRU eviction: remove oldest if over limit
  if (cache.size > CONFIG.CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

/**
 * Get cache statistics
 * @returns {object} {hits, misses}
 */
export function getCacheStats() {
  return { ...cacheStats };
}

/**
 * Clear all cached responses
 */
export function clearCache() {
  cache.clear();
  cacheStats = { hits: 0, misses: 0 };
}

/**
 * Get current cache size
 * @returns {number}
 */
export function getCacheSize() {
  return cache.size;
}

// Periodic sweep to remove expired entries (prevents memory growth when keys aren't accessed)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.time > CONFIG.CACHE_TTL) {
      cache.delete(key);
    }
  }
}, Math.max(1000, Math.floor(CONFIG.CLEANUP_INTERVAL_MS / 10)));
