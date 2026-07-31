import type {
  AuthRateLimiter,
  RateLimitDecision,
} from "@/features/auth/application/ports";
import { AppError } from "@/lib/errors/app-error";

interface UpstashRateLimiterOptions {
  readonly url: string;
  readonly token: string;
}

interface UpstashResult {
  readonly result?: number;
  readonly error?: string;
}

export class UpstashAuthRateLimiter implements AuthRateLimiter {
  constructor(private readonly options: UpstashRateLimiterOptions) {}

  async check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision> {
    const response = await fetch(`${this.options.url}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", `focused:auth:${key}`],
        ["EXPIRE", `focused:auth:${key}`, windowSeconds, "NX"],
        ["TTL", `focused:auth:${key}`],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) throw unavailableRateLimiterError();
    const results = (await response.json()) as readonly UpstashResult[];
    const count = results[0]?.result;
    const ttl = results[2]?.result;
    if (typeof count !== "number" || typeof ttl !== "number") {
      throw unavailableRateLimiterError();
    }

    return { allowed: count <= limit, retryAfterSeconds: Math.max(1, ttl) };
  }
}

function unavailableRateLimiterError(): AppError {
  return new AppError({
    code: "DEPENDENCY_UNAVAILABLE",
    safeMessage: "Authentication is temporarily unavailable. Please try again.",
  });
}
