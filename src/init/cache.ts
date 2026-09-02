// Asuna - A blazing-fast, progressive microservice framework.
// SPDX-License-Identifier: BSD-3-Clause (https://ncurl.xyz/s/mI23sevHR)

/**
 * In-memory TTL cache implementing Asuna Cache interface.
 */
export class Cache {
  private store = new Map<string, {value: string; expiresAt: number}>();

  /**
   * Check if a key exists in the cache and has not expired.
   * @param key - The cache key.
   * @returns True if exists and not expired.
   */
  async has(key: string): Promise<boolean> {
    const item = this.store.get(key);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get a cached value via its key.
   * @param key - The cache key.
   * @returns The cached element or null.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    try {
      return JSON.parse(item.value) as T;
    } catch {
      return item.value as unknown as T;
    }
  }

  /**
   * Set a cached key with given value and TTL in seconds.
   * @param key - The cache key.
   * @param value - The value to cache.
   * @param ttl - The time to live in seconds.
   * @returns 'OK'
   */
  async set(key: string, value: unknown, ttl: number): Promise<'OK'> {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    this.store.set(key, {
      value: strValue,
      expiresAt: Date.now() + ttl * 1000,
    });
    return 'OK';
  }

  /**
   * Refresh a key's TTL in seconds.
   * @param key - The cache key.
   * @param ttl - The time to live in seconds.
   * @returns True if key exists and is updated.
   */
  async ttl(key: string, ttl: number): Promise<boolean> {
    const item = this.store.get(key);
    if (!item || Date.now() > item.expiresAt) {
      if (item) this.store.delete(key);
      return false;
    }
    item.expiresAt = Date.now() + ttl * 1000;
    return true;
  }

  /**
   * Delete cached values via their key.
   * @param keys - The cache key or array of keys.
   * @returns The number of deleted keys.
   */
  async del(keys: string | string[]): Promise<number> {
    if (Array.isArray(keys)) {
      let count = 0;
      for (const k of keys) {
        if (this.store.delete(k)) count++;
      }
      return count;
    }
    return this.store.delete(keys) ? 1 : 0;
  }

  /**
   * Flush all entries.
   * @returns 'OK'
   */
  async flushAll(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }
}

let instance: Cache | null = null;

/**
 * Get or create the unified cache layer.
 * @returns The Cache instance.
 */
export function useCache(): Cache {
  if (!instance) {
    instance = new Cache();
  }
  return instance;
}
