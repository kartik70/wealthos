export type AIProvider = "anthropic" | "gemini";

const AI_PROVIDER_STORAGE_KEY = "wealthos:ai-provider";

export function isAIProvider(value: unknown): value is AIProvider {
  return value === "anthropic" || value === "gemini";
}

export function getStoredAIProvider(): AIProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
  return isAIProvider(stored) ? stored : null;
}

export function setStoredAIProvider(provider: AIProvider): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider);
}
