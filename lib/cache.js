/**
 * Cache Management Module
 * Handles response caching with TTL and LRU eviction
 */

const cache = new Map();
let cacheStats = { hits: 0, misses: 0 };

// Configuration
const CACHE_TTL = 60000; // 1 minute
const CACHE_MAX_SIZE = 50;

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

  if (age > CACHE_TTL) {
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
  if (cache.size > CACHE_MAX_SIZE) {
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
