const Cache = require('../models/Cache');

const TTL = {
  PLACES:      24 * 60 * 60,  // 24 hours — opening hours rarely change day-to-day
  WEATHER:      3 * 60 * 60,  // 3 hours  — forecasts update a few times a day
  DIRECTIONS:  12 * 60 * 60,  // 12 hours — transit routes are stable within a day
  RESTAURANTS: 24 * 60 * 60,  // 24 hours — restaurant listings are stable
};

/**
 * Get a cached value by key. Returns null if not found or expired.
 */
const get = async (key) => {
  const entry = await Cache.findOne({ key });
  if (!entry) return null;
  return entry.data;
};

/**
 * Store a value in the cache with a TTL (in seconds).
 */
const set = async (key, data, ttlSeconds) => {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await Cache.findOneAndUpdate(
    { key },
    { key, data, expiresAt },
    { upsert: true, new: true }
  );
};

/**
 * Wrap an async function with cache-aside logic.
 * If the key exists in cache, return it. Otherwise call fn(), cache the result, and return it.
 *
 * @param {string}   key        - Unique cache key.
 * @param {Function} fn         - Async function to call on cache miss.
 * @param {number}   ttlSeconds - How long to cache the result.
 */
const withCache = async (key, fn, ttlSeconds) => {
  const cached = await get(key);
  if (cached !== null) return cached;

  const fresh = await fn();
  if (fresh !== null && fresh !== undefined) {
    await set(key, fresh, ttlSeconds);
  }
  return fresh;
};

module.exports = { get, set, withCache, TTL };
