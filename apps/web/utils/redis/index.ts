import { env } from "@/env";
import { Redis } from "@upstash/redis";

const isRedisConfigured = Boolean(
  env.UPSTASH_REDIS_URL && env.UPSTASH_REDIS_TOKEN,
);

// No-op Redis client for when Upstash is not configured
const noopRedis = {
  get: async () => null,
  set: async () => null,
  del: async () => 0,
  expire: async () => 0,
  hget: async () => null,
  hset: async () => 0,
  hdel: async () => 0,
  hgetall: async () => null,
  hincrby: async () => 0,
  hincrbyfloat: async () => 0,
  scan: async () => [0, []] as [number, string[]],
  unlink: async () => 0,
  publish: async () => 0,
  pipeline: () => ({
    exec: async () => [],
  }),
} as unknown as Redis;

export const redis: Redis = isRedisConfigured
  ? new Redis({
      url: env.UPSTASH_REDIS_URL!,
      token: env.UPSTASH_REDIS_TOKEN!,
    })
  : noopRedis;

export const isRedisEnabled = isRedisConfigured;

export async function expire(key: string, seconds: number) {
  if (!isRedisConfigured) return 0;
  return redis.expire(key, seconds);
}
