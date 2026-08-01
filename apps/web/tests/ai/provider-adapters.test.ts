/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";

import { GeminiAIProvider } from "@/features/ai/infrastructure/providers/gemini-provider";
import { GroqAIProvider } from "@/features/ai/infrastructure/providers/groq-provider";

afterEach(() => vi.unstubAllGlobals());

describe("AI provider adapters", () => {
  it("normalizes Groq SSE deltas and usage without exposing the key", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          'data: {"choices":[{"delta":{"content":"হ্যালো"}}]}\n\n' +
            'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3}}\n\n' +
            "data: [DONE]\n\n",
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const chunks = [];
    for await (const chunk of new GroqAIProvider("secret", "model").stream(
      request,
      new AbortController().signal,
    ))
      chunks.push(chunk);
    expect(chunks).toEqual([
      { type: "delta", text: "হ্যালো" },
      { type: "usage", usage: { inputTokens: 12, outputTokens: 3 } },
    ]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("secret");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer secret",
    );
  });

  it("sends Gemini structured schema statelessly with a server header key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 2 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new GeminiAIProvider(
      "gemini-secret",
      "gemini-model",
    ).generateStructured(
      request,
      { type: "object", properties: { ok: { type: "boolean" } } },
      new AbortController().signal,
    );
    expect(result).toEqual({
      text: '{"ok":true}',
      usage: { inputTokens: 7, outputTokens: 2 },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("gemini-secret");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(
      "gemini-secret",
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      generationConfig: { responseMimeType: "application/json" },
    });
  });
});

const request = {
  systemInstruction: "System",
  messages: [{ role: "user" as const, content: "Hello" }],
  maxOutputTokens: 100,
  temperature: 0.2,
};
