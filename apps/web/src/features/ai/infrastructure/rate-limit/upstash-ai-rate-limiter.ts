import "server-only";

import type {
  AIRateLimitDecision,
  AIRateLimiter,
} from "@/features/ai/application/ai-rate-limiter";
import { AppError } from "@/lib/errors/app-error";

interface UpstashResult {
  readonly result?: number;
}

export class UpstashAIRateLimiter implements AIRateLimiter {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly limit = 10,
    private readonly windowSeconds = 60,
  ) {}

  async check(userId: string): Promise<AIRateLimitDecision> {
    const response = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", `focused:ai:user:${userId}`],
        ["EXPIRE", `focused:ai:user:${userId}`, this.windowSeconds, "NX"],
        ["TTL", `focused:ai:user:${userId}`],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw unavailable();
    const results = (await response.json()) as readonly UpstashResult[];
    const count = results[0]?.result;
    const ttl = results[2]?.result;
    if (typeof count !== "number" || typeof ttl !== "number")
      throw unavailable();
    return {
      allowed: count <= this.limit,
      retryAfterSeconds: Math.max(1, ttl),
    };
  }
}

function unavailable(): AppError {
  return new AppError({
    code: "DEPENDENCY_UNAVAILABLE",
    safeMessage: "AI usage protection is temporarily unavailable.",
  });
}
