import { describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/features/ai/application/ports";
import { CircuitBreakingAIProvider } from "@/features/ai/infrastructure/providers/circuit-breaking-provider";

describe("CircuitBreakingAIProvider", () => {
  it("opens after consecutive failures and probes again after the reset window", async () => {
    let now = 1_000;
    const generateStructured = vi
      .fn<AIProvider["generateStructured"]>()
      .mockRejectedValueOnce(new Error("provider down"))
      .mockRejectedValueOnce(new Error("provider down"))
      .mockResolvedValue({
        text: "{}",
        usage: { inputTokens: 1, outputTokens: 1 },
      });
    const provider = new CircuitBreakingAIProvider(
      {
        name: "groq",
        model: "model",
        stream: vi.fn(),
        generateStructured,
      },
      2,
      5_000,
      () => now,
    );
    await expect(
      provider.generateStructured(request, {}, signal),
    ).rejects.toThrow();
    await expect(
      provider.generateStructured(request, {}, signal),
    ).rejects.toThrow();
    await expect(
      provider.generateStructured(request, {}, signal),
    ).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(generateStructured).toHaveBeenCalledTimes(2);
    now += 5_001;
    await expect(
      provider.generateStructured(request, {}, signal),
    ).resolves.toMatchObject({
      text: "{}",
    });
    expect(generateStructured).toHaveBeenCalledTimes(3);
  });
});

const request = {
  systemInstruction: "system",
  messages: [{ role: "user" as const, content: "message" }],
  maxOutputTokens: 10,
  temperature: 0,
};
const signal = new AbortController().signal;
