export interface CacheOptions {
  maxSize?: number;
  ttl?: number;
  cleanupInterval?: number;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class SimpleCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;
  private ttl: number;
  private cleanupTimer: NodeJS.Timeout | null;
  private cleanupInterval: number;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 500;
    this.ttl = options.ttl || 60 * 60 * 1000; // 1 hour default
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes default
    this.cleanupTimer = null;
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  set(key: K, value: V): void {
    // Remove oldest entry if we're at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    this.stopCleanupTimer();
    this.clear();
  }
}
