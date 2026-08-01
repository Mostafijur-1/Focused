import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryAIRateLimiter } from "@/features/ai/application/ai-rate-limiter";
import {
  AIProviderError,
  normalizeProviderFailure,
  providerHttpError,
} from "@/features/ai/infrastructure/providers/provider-error";

afterEach(() => vi.useRealTimers());

describe("AI infrastructure policy helpers", () => {
  it("enforces a bounded in-memory development request window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    const limiter = new InMemoryAIRateLimiter(2, 10_000);
    expect(await limiter.check("user-1")).toMatchObject({ allowed: true });
    expect(await limiter.check("user-1")).toMatchObject({ allowed: true });
    expect(await limiter.check("user-1")).toMatchObject({
      allowed: false,
      retryAfterSeconds: 10,
    });
    vi.advanceTimersByTime(10_001);
    expect(await limiter.check("user-1")).toMatchObject({ allowed: true });
  });

  it("normalizes provider HTTP and abort failures without response bodies", () => {
    expect(
      providerHttpError(
        new Response(null, { status: 429, headers: { "retry-after": "12" } }),
        "Groq",
      ),
    ).toMatchObject({ code: "rate_limited", retryAfterSeconds: 12 });
    expect(
      providerHttpError(new Response(null, { status: 503 }), "Gemini"),
    ).toMatchObject({
      code: "unavailable",
    });
    expect(
      providerHttpError(new Response(null, { status: 400 }), "Gemini"),
    ).toMatchObject({
      code: "invalid_response",
    });
    const existing = new AIProviderError("unsafe_response", "unsafe");
    expect(normalizeProviderFailure(existing)).toBe(existing);
    expect(
      normalizeProviderFailure(new DOMException("aborted", "AbortError")),
    ).toMatchObject({
      code: "cancelled",
    });
    expect(normalizeProviderFailure(new Error("secret"))).toMatchObject({
      code: "unavailable",
      message: "The AI provider failed.",
    });
  });
});
