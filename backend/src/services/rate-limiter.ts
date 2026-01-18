import { redis } from "./redis";

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

// Microsoft Graph API limits: ~15,000 requests per 15 minutes per app
// We'll be more conservative to leave headroom
const GRAPH_API_LIMITS: Record<string, RateLimitConfig> = {
  // Per-user limits (more conservative)
  user: {
    maxRequests: 1000,
    windowSeconds: 60, // 1000 requests per minute per user
  },
  // Global app limits
  global: {
    maxRequests: 10000,
    windowSeconds: 900, // 10,000 requests per 15 minutes globally
  },
};

export class RateLimiter {
  private prefix: string;

  constructor(prefix = "ratelimit") {
    this.prefix = prefix;
  }

  private getKey(type: string, identifier: string): string {
    return `${this.prefix}:${type}:${identifier}`;
  }

  async checkLimit(
    type: keyof typeof GRAPH_API_LIMITS,
    identifier: string
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const config = GRAPH_API_LIMITS[type];
    const key = this.getKey(type, identifier);

    const current = await redis.get(key);
    const count = current ? Number.parseInt(current) : 0;

    if (count >= config.maxRequests) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        resetIn: ttl > 0 ? ttl : config.windowSeconds,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - count - 1,
      resetIn: config.windowSeconds,
    };
  }

  async recordRequest(
    type: keyof typeof GRAPH_API_LIMITS,
    identifier: string
  ): Promise<void> {
    const config = GRAPH_API_LIMITS[type];
    const key = this.getKey(type, identifier);

    const current = await redis.get(key);
    if (current) {
      await redis.incr(key);
    } else {
      await redis.set(key, "1", config.windowSeconds);
    }
  }

  async acquirePermit(
    userId: string
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    // Check both user and global limits
    const [userLimit, globalLimit] = await Promise.all([
      this.checkLimit("user", userId),
      this.checkLimit("global", "app"),
    ]);

    if (!userLimit.allowed) {
      return { allowed: false, retryAfter: userLimit.resetIn };
    }

    if (!globalLimit.allowed) {
      return { allowed: false, retryAfter: globalLimit.resetIn };
    }

    // Record the request
    await Promise.all([
      this.recordRequest("user", userId),
      this.recordRequest("global", "app"),
    ]);

    return { allowed: true };
  }
}

export const graphRateLimiter = new RateLimiter("graph");

// Wrapper for Graph API calls with rate limiting
export async function withRateLimit<T>(
  userId: string,
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const permit = await graphRateLimiter.acquirePermit(userId);

    if (permit.allowed) {
      try {
        return await fn();
      } catch (error: unknown) {
        // Handle Graph API 429 responses
        if (error instanceof Error && error.message.includes("429")) {
          const retryAfter = 60; // Default 60 seconds
          console.warn(
            `Graph API 429 response, waiting ${retryAfter}s before retry`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000)
          );
          continue;
        }
        throw error;
      }
    }

    // Rate limited locally, wait and retry
    const waitTime = (permit.retryAfter || 60) * 1000;
    console.warn(`Rate limited, waiting ${permit.retryAfter}s before retry`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  throw new Error("Rate limit exceeded after max retries");
}
