import { env } from "@/env";
import { Redis as UpstashRedis } from "@upstash/redis";
import Redis from "ioredis";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("redis");

type SetOptions = {
  ex?: number;
  nx?: boolean;
  xx?: boolean;
};

type ScanOptions = {
  match?: string;
  count?: number;
};

type RedisClient = {
  get<T = string>(key: string): Promise<T | null>;
  set(
    key: string,
    value: unknown,
    options?: SetOptions,
  ): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  hget<T = string>(key: string, field: string): Promise<T | null>;
  hgetall<T = Record<string, unknown>>(key: string): Promise<T>;
  hset(key: string, value: Record<string, unknown>): Promise<number>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  hincrbyfloat(key: string, field: string, increment: number): Promise<number>;
  publish(channel: string, message: string): Promise<number>;
  scan(
    cursor: number | string,
    options: ScanOptions,
  ): Promise<[string, string[]]>;
  expire(key: string, seconds: number): Promise<number>;
  unlink(...keys: string[]): Promise<number>;
};

function serialize(value: unknown): string {
  if (value === undefined) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function deserialize<T>(value: string | null): T | null {
  if (value === null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

class LocalRedisAdapter implements RedisClient {
  constructor(private client: Redis) {}

  async get<T = string>(key: string): Promise<T | null> {
    return deserialize<T>(await this.client.get(key));
  }

  async set(
    key: string,
    value: unknown,
    options?: SetOptions,
  ): Promise<"OK" | null> {
    const args: Array<string | number> = [];
    if (options?.ex) {
      args.push("EX", options.ex);
    }
    if (options?.nx) {
      args.push("NX");
    }
    if (options?.xx) {
      args.push("XX");
    }
    const result = await (this.client.set as any)(
      key,
      serialize(value),
      ...args,
    );
    return result as "OK" | null;
  }

  async del(...keys: string[]): Promise<number> {
    if (!keys.length) return 0;
    return this.client.del(...keys);
  }

  async hget<T = string>(key: string, field: string): Promise<T | null> {
    return deserialize<T>(await this.client.hget(key, field));
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T> {
    const result = await this.client.hgetall(key);
    const parsed: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(result)) {
      parsed[field] = deserialize(value);
    }
    return parsed as T;
  }

  async hset(key: string, value: Record<string, unknown>): Promise<number> {
    const args: string[] = [];
    for (const [field, fieldValue] of Object.entries(value)) {
      args.push(field, serialize(fieldValue));
    }
    if (!args.length) return 0;
    return this.client.hset(key, ...args);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (!fields.length) return 0;
    return this.client.hdel(key, ...fields);
  }

  async hincrby(
    key: string,
    field: string,
    increment: number,
  ): Promise<number> {
    return this.client.hincrby(key, field, increment);
  }

  async hincrbyfloat(
    key: string,
    field: string,
    increment: number,
  ): Promise<number> {
    return this.client.hincrbyfloat(key, field, increment);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async scan(
    cursor: number | string,
    options: ScanOptions,
  ): Promise<[string, string[]]> {
    const args: Array<string | number> = [String(cursor)];
    if (options.match) {
      args.push("MATCH", options.match);
    }
    if (options.count) {
      args.push("COUNT", options.count);
    }
    const result = await (this.client.scan as any)(...args);
    return [result[0], result[1]] as [string, string[]];
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async unlink(...keys: string[]): Promise<number> {
    if (!keys.length) return 0;
    if (typeof this.client.unlink === "function") {
      return this.client.unlink(...keys);
    }
    return this.client.del(...keys);
  }
}

class NoopRedisAdapter implements RedisClient {
  async get<T = string>(): Promise<T | null> {
    return null;
  }

  async set(): Promise<"OK" | null> {
    return null;
  }

  async del(): Promise<number> {
    return 0;
  }

  async hget<T = string>(): Promise<T | null> {
    return null;
  }

  async hgetall<T = Record<string, unknown>>(): Promise<T> {
    return {} as T;
  }

  async hset(): Promise<number> {
    return 0;
  }

  async hdel(): Promise<number> {
    return 0;
  }

  async hincrby(): Promise<number> {
    return 0;
  }

  async hincrbyfloat(): Promise<number> {
    return 0;
  }

  async publish(): Promise<number> {
    return 0;
  }

  async scan(): Promise<[string, string[]]> {
    return ["0", []];
  }

  async expire(): Promise<number> {
    return 0;
  }

  async unlink(): Promise<number> {
    return 0;
  }
}

function createRedisClient(): RedisClient {
  const hasUpstash = Boolean(
    env.UPSTASH_REDIS_URL && env.UPSTASH_REDIS_TOKEN,
  );
  if (hasUpstash) {
    logger.info("Using Upstash Redis");
    return new UpstashRedis({
      url: env.UPSTASH_REDIS_URL,
      token: env.UPSTASH_REDIS_TOKEN,
    }) as unknown as RedisClient;
  }

  if (env.REDIS_URL) {
    logger.info("Using local Redis");
    return new LocalRedisAdapter(new Redis(env.REDIS_URL));
  }

  logger.warn("Redis not configured; falling back to noop client");
  return new NoopRedisAdapter();
}

export const redis = createRedisClient();

export async function expire(key: string, seconds: number) {
  return redis.expire(key, seconds);
}
