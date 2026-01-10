import { NextResponse } from "next/server";
import { env } from "@/env";
import { getProviderHealth } from "@/utils/llms/circuit-breaker";
import { redis } from "@/utils/redis";

type ProviderStatus = "ok" | "degraded" | "down" | "not_configured";

type HealthResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  providers: Record<string, { status: ProviderStatus; failures?: number }>;
  redis: { status: "ok" | "down" };
};

const CACHE_KEY = "health:ai:cache";
const CACHE_TTL_SECONDS = 30;

async function checkRedisHealth(): Promise<"ok" | "down"> {
  try {
    await redis.set("health:ping", "pong", { ex: 60 });
    const result = await redis.get("health:ping");
    return result === "pong" ? "ok" : "down";
  } catch {
    return "down";
  }
}

function getConfiguredProviders(): string[] {
  const providers: string[] = [];

  if (env.OPENAI_API_KEY) providers.push("openai");
  if (env.ANTHROPIC_API_KEY) providers.push("anthropic");
  if (env.GOOGLE_API_KEY) providers.push("google");
  if (env.GROQ_API_KEY) providers.push("groq");
  if (env.OPENROUTER_API_KEY) providers.push("openrouter");

  return providers;
}

export async function GET() {
  try {
    const cached = await redis.get<HealthResponse>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }
  } catch {
    // Continue without cache
  }

  const configuredProviders = getConfiguredProviders();
  const providers: Record<
    string,
    { status: ProviderStatus; failures?: number }
  > = {};

  for (const provider of configuredProviders) {
    const health = await getProviderHealth(provider);
    providers[provider] = {
      status: health.status,
      failures: health.failures > 0 ? health.failures : undefined,
    };
  }

  const commonProviders = [
    "openai",
    "anthropic",
    "google",
    "groq",
    "openrouter",
  ];
  for (const provider of commonProviders) {
    if (!providers[provider]) {
      providers[provider] = { status: "not_configured" };
    }
  }

  const redisStatus = await checkRedisHealth();

  const providerStatuses = Object.values(providers)
    .filter((p) => p.status !== "not_configured")
    .map((p) => p.status);

  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  if (providerStatuses.every((s) => s === "down")) {
    overallStatus = "unhealthy";
  } else if (providerStatuses.some((s) => s === "down" || s === "degraded")) {
    overallStatus = "degraded";
  }

  if (redisStatus === "down") {
    overallStatus = overallStatus === "healthy" ? "degraded" : overallStatus;
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    providers,
    redis: { status: redisStatus },
  };

  try {
    await redis.set(CACHE_KEY, response, { ex: CACHE_TTL_SECONDS });
  } catch {
    // Ignore cache write failures
  }

  const httpStatus = overallStatus === "unhealthy" ? 503 : 200;
  return NextResponse.json(response, { status: httpStatus });
}
