import { InMemoryAuthRateLimiter } from "@/features/auth/infrastructure/rate-limit/in-memory-auth-rate-limiter";

describe("InMemoryAuthRateLimiter", () => {
  it("allows a bounded number of attempts and then returns retry guidance", async () => {
    const limiter = new InMemoryAuthRateLimiter();
    await expect(limiter.check("login:key", 2, 60)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(limiter.check("login:key", 2, 60)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(limiter.check("login:key", 2, 60)).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: expect.any(Number),
    });
  });
});
