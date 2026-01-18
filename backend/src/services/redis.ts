import { Redis } from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Parse Redis URL
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number.parseInt(parsed.port) || 6379,
    password: parsed.password || undefined,
  };
}

const redisConfig = parseRedisUrl(REDIS_URL);

// BullMQ connection (for queues)
export const redisConnection = new Redis(redisConfig);

// Simple Redis client for rate limiting and caching
export const redis = {
  async get(key: string): Promise<string | null> {
    return redisConnection.get(key);
  },

  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    if (exSeconds) {
      await redisConnection.set(key, value, "EX", exSeconds);
    } else {
      await redisConnection.set(key, value);
    }
  },

  async incr(key: string): Promise<number> {
    return redisConnection.incr(key);
  },

  async expire(key: string, seconds: number): Promise<void> {
    await redisConnection.expire(key, seconds);
  },

  async del(key: string): Promise<void> {
    await redisConnection.del(key);
  },

  async ttl(key: string): Promise<number> {
    return redisConnection.ttl(key);
  },
};

// Graceful shutdown
process.on("SIGINT", async () => {
  await redisConnection.quit();
});

process.on("SIGTERM", async () => {
  await redisConnection.quit();
});
