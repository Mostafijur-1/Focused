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

const endpoint = "https://api.groq.com/openai/v1/chat/completions";

export class GroqAIProvider implements AIProvider {
  readonly name = "groq" as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async *stream(
    request: AIProviderRequest,
    signal: AbortSignal,
  ): AsyncIterable<AIProviderStreamChunk> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: providerMessages(request),
          max_completion_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          stream: true,
          stream_options: { include_usage: true },
          store: false,
        }),
        signal,
        cache: "no-store",
      });
    } catch (error) {
      throw normalizeProviderFailure(error);
    }
    if (!response.ok) throw providerHttpError(response, "Groq");
    if (!response.body)
      throw new AIProviderError("invalid_response", "Groq stream was empty.");

    for await (const data of sseData(response.body)) {
      if (data === "[DONE]") break;
      const chunk = parseJson(data);
      const delta = readString(chunk, ["choices", 0, "delta", "content"]);
      if (delta) yield { type: "delta", text: delta };
      const usage = readUsage(chunk);
      if (usage) yield { type: "usage", usage };
    }
  }

  async generateStructured(
    request: AIProviderRequest,
    _jsonSchema: Readonly<Record<string, unknown>>,
    signal: AbortSignal,
  ): Promise<Readonly<{ text: string; usage: AIUsage }>> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: providerMessages(request),
          max_completion_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          response_format: { type: "json_object" },
          store: false,
        }),
        signal,
        cache: "no-store",
      });
    } catch (error) {
      throw normalizeProviderFailure(error);
    }
    if (!response.ok) throw providerHttpError(response, "Groq");
    const body = (await response.json()) as unknown;
    const text = readString(body, ["choices", 0, "message", "content"]);
    if (!text)
      throw new AIProviderError("invalid_response", "Groq output was empty.");
    return { text, usage: readUsage(body) ?? emptyUsage };
  }
}

function providerMessages(request: AIProviderRequest) {
  return [
    { role: "system", content: request.systemInstruction },
    ...request.messages,
  ];
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
      const events = buffer.split(/\r?\n\r?\n/u);
      buffer = events.pop() ?? "";
      for (const event of events)
        for (const line of event.split(/\r?\n/u))
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
      "Groq returned invalid JSON.",
    );
  }
}

function readString(
  value: unknown,
  path: readonly (string | number)[],
): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (typeof key === "number") {
      if (!Array.isArray(current)) return null;
      current = current[key];
    } else {
      if (!current || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[key];
    }
  }
  return typeof current === "string" ? current : null;
}

function readUsage(value: unknown): AIUsage | null {
  if (!value || typeof value !== "object") return null;
  const usage = (value as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return null;
  const record = usage as Record<string, unknown>;
  return {
    inputTokens:
      typeof record.prompt_tokens === "number" ? record.prompt_tokens : null,
    outputTokens:
      typeof record.completion_tokens === "number"
        ? record.completion_tokens
        : null,
  };
}

const emptyUsage: AIUsage = { inputTokens: null, outputTokens: null };
