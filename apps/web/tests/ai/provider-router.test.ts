import { describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/features/ai/application/ports";
import { ConfiguredAIProviderRouter } from "@/features/ai/infrastructure/providers/provider-router";

describe("ConfiguredAIProviderRouter", () => {
  it("prefers Groq for fast text and Gemini for deep review", () => {
    const groq = provider("groq");
    const gemini = provider("gemini");
    const router = new ConfiguredAIProviderRouter([groq, gemini]);
    expect(router.select("fast_text", ["groq", "gemini"])).toBe(groq);
    expect(router.select("deep_review", ["groq", "gemini"])).toBe(gemini);
  });

  it("never falls back to a provider excluded by privacy policy", () => {
    const router = new ConfiguredAIProviderRouter([
      provider("groq"),
      provider("gemini"),
    ]);
    expect(router.fallback("groq", ["groq"])).toBeNull();
  });
});

function provider(name: "groq" | "gemini"): AIProvider {
  return {
    name,
    model: `${name}-model`,
    stream: vi.fn(),
    generateStructured: vi.fn(),
  };
}
