import type {
  AuthRateLimiter,
  RateLimitDecision,
} from "@/features/auth/application/ports";

interface Counter {
  count: number;
  resetsAt: number;
}

export class InMemoryAuthRateLimiter implements AuthRateLimiter {
  private readonly counters = new Map<string, Counter>();

  async check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision> {
    const now = Date.now();
    const current = this.counters.get(key);
    const counter =
      !current || current.resetsAt <= now
        ? { count: 0, resetsAt: now + windowSeconds * 1000 }
        : current;

    counter.count += 1;
    this.counters.set(key, counter);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((counter.resetsAt - now) / 1000),
    );
    return { allowed: counter.count <= limit, retryAfterSeconds };
  }
}
