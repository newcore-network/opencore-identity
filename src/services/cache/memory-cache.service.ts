import { injectable } from "tsyringe";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache with TTL support.
 * Used to cache API responses and reduce external calls.
 */
@injectable()
export class MemoryCacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultTtlMs = 300000; // 5 minutes
  private readonly cleanupIntervalMs = 60000; // 1 minute

  constructor() {
    this.startCleanup();
  }

  /**
   * Get a value from cache if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a value in cache with TTL
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if a key exists in cache (and is not expired)
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanExpired();
    }, this.cleanupIntervalMs);
  }

  /**
   * Clean up all expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Stop the cleanup interval (useful for testing or shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
