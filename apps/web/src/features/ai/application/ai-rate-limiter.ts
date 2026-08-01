export interface AIRateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface AIRateLimiter {
  check(userId: string): Promise<AIRateLimitDecision>;
}

export class InMemoryAIRateLimiter implements AIRateLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  constructor(
    private readonly limit = 10,
    private readonly windowMs = 60_000,
  ) {}

  async check(userId: string): Promise<AIRateLimitDecision> {
    const now = Date.now();
    const current = this.buckets.get(userId);
    const bucket =
      !current || current.expiresAt <= now
        ? { count: 0, expiresAt: now + this.windowMs }
        : current;
    bucket.count += 1;
    this.buckets.set(userId, bucket);
    return {
      allowed: bucket.count <= this.limit,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.expiresAt - now) / 1_000),
      ),
    };
  }
}
