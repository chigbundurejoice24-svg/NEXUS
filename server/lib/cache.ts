/**
 * cache.ts — In-memory server-side cache
 * Survives across warm Vercel invocations.
 * Swap .get/.set for Upstash Redis in production for multi-instance support.
 */

const store = new Map<string, { data: unknown; expires: number }>();

export function getCache<T = unknown>(key: string): T | null {
  const entry = store.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  store.delete(key);
  return null;
}

export function setCache(key: string, data: unknown, ttlMs = 15_000): void {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
