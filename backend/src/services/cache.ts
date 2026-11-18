type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class AppCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds = 60): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidatePrefix(prefix: string): number {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  invalidateAll(): void {
    this.store.clear();
  }

  stats(): { keys: number } {
    return { keys: this.store.size };
  }
}

export const appCache = new AppCache();

export function invalidatePublicCatalogCaches(): void {
  appCache.invalidatePrefix('homepage:');
  appCache.invalidatePrefix('hero:');
  appCache.invalidatePrefix('channels:');
  appCache.invalidatePrefix('catalog:');
  appCache.invalidatePrefix('packages:');
  appCache.invalidatePrefix('settings:');
  appCache.invalidatePrefix('navigation:');
  appCache.invalidatePrefix('pages:');
}
