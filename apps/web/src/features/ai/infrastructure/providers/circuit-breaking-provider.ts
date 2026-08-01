import type {
  AIProvider,
  AIProviderRequest,
  AIProviderStreamChunk,
} from "@/features/ai/application/ports";
import type { AIUsage } from "@/features/ai/domain/ai-types";
import { AIProviderError } from "@/features/ai/infrastructure/providers/provider-error";

export class CircuitBreakingAIProvider implements AIProvider {
  readonly name;
  readonly model;
  private consecutiveFailures = 0;
  private openUntil = 0;

  constructor(
    private readonly provider: AIProvider,
    private readonly failureThreshold = 3,
    private readonly resetAfterMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {
    this.name = provider.name;
    this.model = provider.model;
  }

  async *stream(
    request: AIProviderRequest,
    signal: AbortSignal,
  ): AsyncIterable<AIProviderStreamChunk> {
    this.ensureAvailable();
    try {
      for await (const chunk of this.provider.stream(request, signal))
        yield chunk;
      this.recordSuccess();
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  async generateStructured(
    request: AIProviderRequest,
    jsonSchema: Readonly<Record<string, unknown>>,
    signal: AbortSignal,
  ): Promise<Readonly<{ text: string; usage: AIUsage }>> {
    this.ensureAvailable();
    try {
      const result = await this.provider.generateStructured(
        request,
        jsonSchema,
        signal,
      );
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private ensureAvailable(): void {
    if (this.openUntil > this.now())
      throw new AIProviderError(
        "unavailable",
        `${this.name} circuit is temporarily open.`,
      );
    if (this.openUntil > 0) {
      this.openUntil = 0;
      this.consecutiveFailures = 0;
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold)
      this.openUntil = this.now() + this.resetAfterMs;
  }
}
