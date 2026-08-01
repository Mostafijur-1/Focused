export type AIProviderErrorCode =
  | "rate_limited"
  | "timeout"
  | "cancelled"
  | "invalid_response"
  | "unsafe_response"
  | "unavailable";

export class AIProviderError extends Error {
  constructor(
    readonly code: AIProviderErrorCode,
    message: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export function providerHttpError(
  response: Response,
  provider: string,
): AIProviderError {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : null;
  if (response.status === 429)
    return new AIProviderError(
      "rate_limited",
      `${provider} quota was exhausted.`,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
    );
  if (response.status >= 500)
    return new AIProviderError("unavailable", `${provider} is unavailable.`);
  return new AIProviderError(
    "invalid_response",
    `${provider} rejected the request.`,
  );
}

export function normalizeProviderFailure(error: unknown): AIProviderError {
  if (error instanceof AIProviderError) return error;
  if (error instanceof DOMException && error.name === "AbortError")
    return new AIProviderError("cancelled", "The AI request was cancelled.");
  return new AIProviderError("unavailable", "The AI provider failed.");
}
