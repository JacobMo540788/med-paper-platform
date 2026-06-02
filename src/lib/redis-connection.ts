/**
 * 从 REDIS_URL 解析 BullMQ / ioredis 连接配置。
 * 新手解释：Redis = 高速临时存数据的内存数据库，用于缓存首页和任务队列。
 */
export function getRedisConnection(): { host: string; port: number; password?: string } {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
    };
  } catch {
    return {
      host: process.env.REDIS_HOST ?? "localhost",
      port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    };
  }
}
