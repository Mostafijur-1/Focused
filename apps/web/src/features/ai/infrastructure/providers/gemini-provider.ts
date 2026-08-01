import "server-only";

import type {
  AIProvider,
  AIProviderRequest,
  AIProviderStreamChunk,
} from "@/features/ai/application/ports";
import type { AIUsage } from "@/features/ai/domain/ai-types";
import {
  AIProviderError,
  normalizeProviderFailure,
  providerHttpError,
} from "@/features/ai/infrastructure/providers/provider-error";

export class GeminiAIProvider implements AIProvider {
  readonly name = "gemini" as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async *stream(
    request: AIProviderRequest,
    signal: AbortSignal,
  ): AsyncIterable<AIProviderStreamChunk> {
    const response = await this.request(
      "streamGenerateContent?alt=sse",
      request,
      null,
      signal,
    );
    if (!response.body)
      throw new AIProviderError("invalid_response", "Gemini stream was empty.");
    for await (const data of sseData(response.body)) {
      const chunk = parseJson(data);
      const text = candidateText(chunk);
      if (text) yield { type: "delta", text };
      const usage = geminiUsage(chunk);
      if (usage) yield { type: "usage", usage };
    }
  }

  async generateStructured(
    request: AIProviderRequest,
    jsonSchema: Readonly<Record<string, unknown>>,
    signal: AbortSignal,
  ): Promise<Readonly<{ text: string; usage: AIUsage }>> {
    const response = await this.request(
      "generateContent",
      request,
      jsonSchema,
      signal,
    );
    const body = (await response.json()) as unknown;
    const text = candidateText(body);
    if (!text)
      throw new AIProviderError("invalid_response", "Gemini output was empty.");
    return {
      text,
      usage: geminiUsage(body) ?? { inputTokens: null, outputTokens: null },
    };
  }

  private async request(
    action: string,
    request: AIProviderRequest,
    schema: Readonly<Record<string, unknown>> | null,
    signal: AbortSignal,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:${action}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.systemInstruction }] },
            contents: request.messages.map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
            generationConfig: {
              maxOutputTokens: request.maxOutputTokens,
              temperature: request.temperature,
              ...(schema
                ? {
                    responseMimeType: "application/json",
                    responseJsonSchema: schema,
                  }
                : {}),
            },
          }),
          signal,
          cache: "no-store",
        },
      );
    } catch (error) {
      throw normalizeProviderFailure(error);
    }
    if (!response.ok) throw providerHttpError(response, "Gemini");
    return response;
  }
}

async function* sseData(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/u);
      buffer = lines.pop() ?? "";
      for (const line of lines)
        if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  } finally {
    reader.releaseLock();
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new AIProviderError(
      "invalid_response",
      "Gemini returned invalid JSON.",
    );
  }
}

function candidateText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const candidates = (value as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates)) return null;
  const candidate = candidates[0];
  if (!candidate || typeof candidate !== "object") return null;
  const content = (candidate as Record<string, unknown>).content;
  if (!content || typeof content !== "object") return null;
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) return null;
  return parts
    .map((part) =>
      part && typeof part === "object"
        ? (part as Record<string, unknown>).text
        : null,
    )
    .filter((text): text is string => typeof text === "string")
    .join("");
}

function geminiUsage(value: unknown): AIUsage | null {
  if (!value || typeof value !== "object") return null;
  const metadata = (value as Record<string, unknown>).usageMetadata;
  if (!metadata || typeof metadata !== "object") return null;
  const usage = metadata as Record<string, unknown>;
  return {
    inputTokens:
      typeof usage.promptTokenCount === "number"
        ? usage.promptTokenCount
        : null,
    outputTokens:
      typeof usage.candidatesTokenCount === "number"
        ? usage.candidatesTokenCount
        : null,
  };
}
