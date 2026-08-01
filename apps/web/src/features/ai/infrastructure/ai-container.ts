import "server-only";

import { getPrismaClient } from "@focused/database";

import { InMemoryAIRateLimiter } from "@/features/ai/application/ai-rate-limiter";
import { AIService } from "@/features/ai/application/ai-service";
import type { AIProvider } from "@/features/ai/application/ports";
import { GoalProposalExecutor } from "@/features/ai/infrastructure/goal-proposal-executor";
import { PrismaAIRepository } from "@/features/ai/infrastructure/persistence/prisma-ai-repository";
import { CircuitBreakingAIProvider } from "@/features/ai/infrastructure/providers/circuit-breaking-provider";
import { GeminiAIProvider } from "@/features/ai/infrastructure/providers/gemini-provider";
import { GroqAIProvider } from "@/features/ai/infrastructure/providers/groq-provider";
import { ConfiguredAIProviderRouter } from "@/features/ai/infrastructure/providers/provider-router";
import { UpstashAIRateLimiter } from "@/features/ai/infrastructure/rate-limit/upstash-ai-rate-limiter";
import { SystemClock } from "@/infrastructure/time/system-clock";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

let service: AIService | undefined;

export function getAIService(): AIService {
  if (service) return service;
  const environment = getServerEnvironment();
  if (!environment.DATABASE_URL)
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "AI Coach is temporarily unavailable.",
    });
  const providers: AIProvider[] = [];
  if (environment.GROQ_API_KEY)
    providers.push(
      new CircuitBreakingAIProvider(
        new GroqAIProvider(environment.GROQ_API_KEY, environment.GROQ_MODEL),
      ),
    );
  if (environment.GEMINI_API_KEY)
    providers.push(
      new CircuitBreakingAIProvider(
        new GeminiAIProvider(
          environment.GEMINI_API_KEY,
          environment.GEMINI_MODEL,
        ),
      ),
    );
  const rateLimiter =
    environment.UPSTASH_REDIS_REST_URL && environment.UPSTASH_REDIS_REST_TOKEN
      ? new UpstashAIRateLimiter(
          environment.UPSTASH_REDIS_REST_URL,
          environment.UPSTASH_REDIS_REST_TOKEN,
        )
      : new InMemoryAIRateLimiter();
  service = new AIService({
    repository: new PrismaAIRepository(
      getPrismaClient(environment.DATABASE_URL),
    ),
    router: new ConfiguredAIProviderRouter(providers),
    proposalExecutor: new GoalProposalExecutor(),
    rateLimiter,
    clock: new SystemClock(),
    privacy: {
      groqConfigured: Boolean(environment.GROQ_API_KEY),
      groqZeroDataRetention: environment.GROQ_ZERO_DATA_RETENTION,
      geminiConfigured: Boolean(environment.GEMINI_API_KEY),
      geminiServiceTier: environment.GEMINI_SERVICE_TIER,
    },
  });
  return service;
}

export function resetAIServiceForTests(): void {
  service = undefined;
}
