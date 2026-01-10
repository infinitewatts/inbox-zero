import { redis } from "@/utils/redis";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("circuit-breaker");

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

type CircuitStatus = {
  state: CircuitState;
  failures: number;
  lastFailure: number | null;
  lastSuccess: number | null;
};

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 60_000; // 60 seconds
const HALF_OPEN_SUCCESS_THRESHOLD = 2;

function getCircuitKey(provider: string): string {
  return `circuit:${provider}`;
}

async function getCircuitStatus(provider: string): Promise<CircuitStatus> {
  const key = getCircuitKey(provider);
  const data = await redis.hgetall<Record<string, string>>(key);

  if (!data || Object.keys(data).length === 0) {
    return {
      state: "CLOSED",
      failures: 0,
      lastFailure: null,
      lastSuccess: null,
    };
  }

  return {
    state: (data.state as CircuitState) || "CLOSED",
    failures: Number.parseInt(data.failures || "0", 10),
    lastFailure: data.lastFailure
      ? Number.parseInt(data.lastFailure, 10)
      : null,
    lastSuccess: data.lastSuccess
      ? Number.parseInt(data.lastSuccess, 10)
      : null,
  };
}

async function setCircuitStatus(
  provider: string,
  status: Partial<CircuitStatus>,
): Promise<void> {
  const key = getCircuitKey(provider);
  const update: Record<string, string> = {};

  if (status.state !== undefined) update.state = status.state;
  if (status.failures !== undefined)
    update.failures = status.failures.toString();
  if (status.lastFailure !== undefined)
    update.lastFailure = status.lastFailure?.toString() ?? "";
  if (status.lastSuccess !== undefined)
    update.lastSuccess = status.lastSuccess?.toString() ?? "";

  await redis.hset(key, update);
  await redis.expire(key, 3600); // Keep circuit state for 1 hour
}

export async function isCircuitOpen(provider: string): Promise<boolean> {
  const status = await getCircuitStatus(provider);

  if (status.state === "CLOSED") {
    return false;
  }

  if (status.state === "OPEN") {
    const now = Date.now();
    if (status.lastFailure && now - status.lastFailure > COOLDOWN_MS) {
      logger.info("Circuit transitioning to HALF_OPEN", { provider });
      await setCircuitStatus(provider, { state: "HALF_OPEN", failures: 0 });
      return false;
    }
    return true;
  }

  // HALF_OPEN: allow requests through for testing
  return false;
}

export async function recordSuccess(provider: string): Promise<void> {
  const status = await getCircuitStatus(provider);
  const now = Date.now();

  if (status.state === "HALF_OPEN") {
    const successCount = (status.failures || 0) + 1; // Reusing failures as success counter in half-open
    if (successCount >= HALF_OPEN_SUCCESS_THRESHOLD) {
      logger.info("Circuit transitioning to CLOSED", { provider });
      await setCircuitStatus(provider, {
        state: "CLOSED",
        failures: 0,
        lastSuccess: now,
      });
    } else {
      await setCircuitStatus(provider, {
        failures: successCount,
        lastSuccess: now,
      });
    }
  } else {
    await setCircuitStatus(provider, {
      failures: 0,
      lastSuccess: now,
    });
  }
}

export async function recordFailure(provider: string): Promise<void> {
  const status = await getCircuitStatus(provider);
  const now = Date.now();
  const newFailures = status.failures + 1;

  if (newFailures >= FAILURE_THRESHOLD) {
    logger.warn("Circuit transitioning to OPEN", {
      provider,
      failures: newFailures,
    });
    await setCircuitStatus(provider, {
      state: "OPEN",
      failures: newFailures,
      lastFailure: now,
    });
  } else {
    await setCircuitStatus(provider, {
      failures: newFailures,
      lastFailure: now,
    });
  }
}

export async function withCircuitBreaker<T>(
  provider: string,
  operation: () => Promise<T>,
): Promise<T> {
  const circuitOpen = await isCircuitOpen(provider);

  if (circuitOpen) {
    logger.warn("Circuit is open, rejecting request", { provider });
    throw new Error(`AI provider ${provider} is temporarily unavailable`);
  }

  try {
    const result = await operation();
    await recordSuccess(provider);
    return result;
  } catch (error) {
    await recordFailure(provider);
    throw error;
  }
}

export async function getProviderHealth(
  provider: string,
): Promise<{ status: "ok" | "degraded" | "down"; failures: number }> {
  const status = await getCircuitStatus(provider);

  if (status.state === "OPEN") {
    return { status: "down", failures: status.failures };
  }

  if (status.state === "HALF_OPEN") {
    return { status: "degraded", failures: status.failures };
  }

  if (status.failures > 0) {
    return { status: "degraded", failures: status.failures };
  }

  return { status: "ok", failures: 0 };
}
