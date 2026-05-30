/**
 * Phase 3C: Redis Caching Service
 * 
 * Provides centralized caching with:
 * - Automatic serialization/deserialization
 * - TTL management
 * - Pattern-based invalidation
 * - Cache statistics
 */

const config = require('../config/appConfig');

// In-memory fallback cache for development
const memoryCache = new Map();
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  operations: 0
};

// Try to load Redis client if available
let redisClient = null;
let useRedis = false;

try {
  const redis = require('redis');
  const redisConfig = {
    host: config.redisHost || '127.0.0.1',
    port: config.redisPort || 6379,
    connectTimeout: 5000
  };

  // Note: This is a simplified setup. In production, use proper async initialization
  useRedis = false; // Set to true after proper async initialization
  console.log('[Cache] Redis backend available (fallback mode enabled)');
} catch (error) {
  console.log('[Cache] Redis not available, using in-memory cache');
}

/**
 * Initialize cache service
 */
const initialize = async () => {
  console.log('[Cache] Initialized:', useRedis ? 'Redis' : 'In-Memory');
  return true;
};

/**
 * Get value from cache
 */
const get = async (key) => {
  try {
    cacheStats.operations++;

    if (useRedis && redisClient) {
      const value = await redisClient.get(key);
      if (value) {
        cacheStats.hits++;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
    } else {
      // In-memory cache
      if (memoryCache.has(key)) {
        const entry = memoryCache.get(key);
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
          memoryCache.delete(key);
          cacheStats.misses++;
          return null;
        }
        cacheStats.hits++;
        return entry.value;
      }
    }

    cacheStats.misses++;
    return null;
  } catch (error) {
    console.error('[Cache] Get error:', error.message);
    cacheStats.misses++;
    return null;
  }
};

/**
 * Set value in cache with TTL (in seconds)
 */
const set = async (key, value, ttl = 3600) => {
  try {
    cacheStats.sets++;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (useRedis && redisClient) {
      if (ttl) {
        await redisClient.setex(key, ttl, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
    } else {
      // In-memory cache
      memoryCache.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : null,
        createdAt: Date.now()
      });
    }

    return true;
  } catch (error) {
    console.error('[Cache] Set error:', error.message);
    return false;
  }
};

/**
 * Delete key from cache
 */
const del = async (key) => {
  try {
    cacheStats.deletes++;

    if (useRedis && redisClient) {
      await redisClient.del(key);
    } else {
      memoryCache.delete(key);
    }

    return true;
  } catch (error) {
    console.error('[Cache] Delete error:', error.message);
    return false;
  }
};

/**
 * Check if key exists in cache
 */
const exists = async (key) => {
  try {
    if (useRedis && redisClient) {
      const result = await redisClient.exists(key);
      return result === 1;
    } else {
      const exists = memoryCache.has(key);
      if (exists) {
        const entry = memoryCache.get(key);
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
          memoryCache.delete(key);
          return false;
        }
      }
      return exists;
    }
  } catch (error) {
    console.error('[Cache] Exists error:', error.message);
    return false;
  }
};

/**
 * Get multiple keys at once
 */
const getMultiple = async (keys) => {
  try {
    const results = {};

    for (const key of keys) {
      results[key] = await get(key);
    }

    return results;
  } catch (error) {
    console.error('[Cache] GetMultiple error:', error.message);
    return {};
  }
};

/**
 * Set multiple key-value pairs
 */
const setMultiple = async (keyValues, ttl = 3600) => {
  try {
    const results = [];

    for (const [key, value] of Object.entries(keyValues)) {
      const result = await set(key, value, ttl);
      results.push(result);
    }

    return results.every((r) => r === true);
  } catch (error) {
    console.error('[Cache] SetMultiple error:', error.message);
    return false;
  }
};

/**
 * Invalidate keys matching pattern
 * Pattern: use wildcards like "bills:*" or "bills:customer:*"
 */
const invalidatePattern = async (pattern) => {
  try {
    cacheStats.deletes++;

    if (useRedis && redisClient) {
      // Redis SCAN with pattern matching
      let cursor = '0';
      let count = 0;

      do {
        const result = await redisClient.scan(cursor, 'MATCH', pattern);
        cursor = result[0];
        const keys = result[1];

        if (keys.length > 0) {
          await redisClient.del(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');

      console.log(`[Cache] Invalidated ${count} keys matching ${pattern}`);
      return count;
    } else {
      // In-memory cache pattern matching
      let count = 0;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));

      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          memoryCache.delete(key);
          count++;
        }
      }

      console.log(`[Cache] Invalidated ${count} keys matching ${pattern}`);
      return count;
    }
  } catch (error) {
    console.error('[Cache] InvalidatePattern error:', error.message);
    return 0;
  }
};

/**
 * Domain-specific cache functions
 */

const getCachedBill = async (customerId, month) => {
  return get(`bill:${customerId}:${month}`);
};

const setCachedBill = async (customerId, month, data, ttl = 3600) => {
  return set(`bill:${customerId}:${month}`, data, ttl);
};

const invalidateBillCache = async (customerId, month) => {
  return del(`bill:${customerId}:${month}`);
};

const invalidateCustomerBills = async (customerId) => {
  return invalidatePattern(`bill:${customerId}:*`);
};

const getCachedPaymentHistory = async (customerId) => {
  return get(`payments:${customerId}`);
};

const setCachedPaymentHistory = async (customerId, data, ttl = 1800) => {
  return set(`payments:${customerId}`, data, ttl);
};

const invalidatePaymentCache = async (customerId) => {
  return del(`payments:${customerId}`);
};

const getCachedRevenueStats = async (month) => {
  return get(`revenue:${month}`);
};

const setCachedRevenueStats = async (month, data, ttl = 3600) => {
  return set(`revenue:${month}`, data, ttl);
};

const invalidateRevenueStats = async (month) => {
  return del(`revenue:${month}`);
};

/**
 * Get cache statistics
 */
const getStats = () => {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(2) : 0;

  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: `${hitRate}%`,
    totalOperations: cacheStats.operations,
    sets: cacheStats.sets,
    deletes: cacheStats.deletes,
    memoryUsage: useRedis ? 'Redis' : `In-Memory (${memoryCache.size} keys)`,
    backend: useRedis ? 'Redis' : 'Memory'
  };
};

/**
 * Reset statistics
 */
const resetStats = () => {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.sets = 0;
  cacheStats.deletes = 0;
  cacheStats.operations = 0;
};

/**
 * Clear all cache
 */
const clear = async () => {
  try {
    if (useRedis && redisClient) {
      await redisClient.flushdb();
      console.log('[Cache] Redis cache cleared');
    } else {
      memoryCache.clear();
      console.log('[Cache] Memory cache cleared');
    }

    resetStats();
    return true;
  } catch (error) {
    console.error('[Cache] Clear error:', error.message);
    return false;
  }
};

module.exports = {
  // Core operations
  initialize,
  get,
  set,
  del,
  exists,
  getMultiple,
  setMultiple,
  invalidatePattern,

  // Bill cache
  getCachedBill,
  setCachedBill,
  invalidateBillCache,
  invalidateCustomerBills,

  // Payment cache
  getCachedPaymentHistory,
  setCachedPaymentHistory,
  invalidatePaymentCache,

  // Revenue cache
  getCachedRevenueStats,
  setCachedRevenueStats,
  invalidateRevenueStats,

  // Monitoring
  getStats,
  resetStats,
  clear
};
