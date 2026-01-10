import { redis } from "@/utils/redis";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("ratelimit");

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetIn: number;
};

const AI_RATE_LIMIT = 30; // requests per minute
const WINDOW_SIZE_SECONDS = 60;

export async function checkAiRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - WINDOW_SIZE_SECONDS;
  const key = `ratelimit:ai:${userId}`;

  try {
    const data = await redis.hgetall<Record<string, string>>(key);

    if (!data || Object.keys(data).length === 0) {
      await redis.hset(key, { [now.toString()]: "1" });
      await redis.expire(key, WINDOW_SIZE_SECONDS * 2);

      return {
        allowed: true,
        remaining: AI_RATE_LIMIT - 1,
        resetIn: WINDOW_SIZE_SECONDS,
      };
    }

    let count = 0;
    const keysToDelete: string[] = [];

    for (const [timestamp, value] of Object.entries(data)) {
      const ts = Number.parseInt(timestamp, 10);
      if (ts > windowStart) {
        count += Number.parseInt(String(value), 10);
      } else {
        keysToDelete.push(timestamp);
      }
    }

    if (keysToDelete.length > 0) {
      await redis.hdel(key, ...keysToDelete);
    }

    if (count >= AI_RATE_LIMIT) {
      const oldestInWindow = Math.min(
        ...Object.keys(data)
          .map((t) => Number.parseInt(t, 10))
          .filter((t) => t > windowStart),
      );
      const resetIn = Math.max(1, oldestInWindow + WINDOW_SIZE_SECONDS - now);

      logger.warn("Rate limit exceeded", { userId, count });

      return {
        allowed: false,
        remaining: 0,
        resetIn,
      };
    }

    await redis.hincrby(key, now.toString(), 1);
    await redis.expire(key, WINDOW_SIZE_SECONDS * 2);

    return {
      allowed: true,
      remaining: AI_RATE_LIMIT - count - 1,
      resetIn: WINDOW_SIZE_SECONDS,
    };
  } catch (error) {
    logger.error("Rate limit check failed, allowing request", { error });
    return {
      allowed: true,
      remaining: AI_RATE_LIMIT,
      resetIn: WINDOW_SIZE_SECONDS,
    };
  }
}

export function rateLimitResponse(resetIn: number) {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please wait a moment.",
      retryAfter: resetIn,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": resetIn.toString(),
      },
    },
  );
}
