import type {
  AIProvider,
  AIProviderName,
  AIProviderRouter,
} from "@/features/ai/application/ports";

export class ConfiguredAIProviderRouter implements AIProviderRouter {
  private readonly providers: ReadonlyMap<AIProviderName, AIProvider>;

  constructor(providers: readonly AIProvider[]) {
    this.providers = new Map(
      providers.map((provider) => [provider.name, provider]),
    );
  }

  select(
    capability: "fast_text" | "deep_review",
    eligible: readonly AIProviderName[],
  ): AIProvider | null {
    const order: readonly AIProviderName[] =
      capability === "fast_text" ? ["groq", "gemini"] : ["gemini", "groq"];
    return this.first(order, eligible);
  }

  fallback(
    current: AIProviderName,
    eligible: readonly AIProviderName[],
  ): AIProvider | null {
    return this.first(current === "groq" ? ["gemini"] : ["groq"], eligible);
  }

  private first(
    order: readonly AIProviderName[],
    eligible: readonly AIProviderName[],
  ): AIProvider | null {
    for (const name of order) {
      const provider = this.providers.get(name);
      if (provider && eligible.includes(name)) return provider;
    }
    return null;
  }
}
