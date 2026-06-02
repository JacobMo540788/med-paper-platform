import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
  }
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = getRedis();
    const raw = await r.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec = 3600): Promise<void> {
  try {
    const r = getRedis();
    await r.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    /* Redis 不可用时静默降级 */
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  try {
    const r = getRedis();
    const keys = await r.keys(pattern);
    if (keys.length) await r.del(...keys);
  } catch {
    /* ignore */
  }
}
