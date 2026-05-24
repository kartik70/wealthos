export type AIProvider = "anthropic" | "gemini";

export const AI_PROVIDER_STORAGE_KEY = "ai_provider";
export const AI_PROVIDER_HEADER = "x-ai-provider";
const LEGACY_AI_PROVIDER_STORAGE_KEY = "wealthos:ai-provider";

export function isAIProvider(value: unknown): value is AIProvider {
  return value === "anthropic" || value === "gemini";
}

export function getStoredAIProvider(): AIProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored =
    window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_AI_PROVIDER_STORAGE_KEY);

  return isAIProvider(stored) ? stored : null;
}

export function setStoredAIProvider(provider: AIProvider): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider);
  window.localStorage.removeItem(LEGACY_AI_PROVIDER_STORAGE_KEY);
}

export function getAIProviderFromRequest(request: Request): AIProvider {
  const headerValue = request.headers.get(AI_PROVIDER_HEADER);
  if (isAIProvider(headerValue)) {
    return headerValue;
  }

  const configured = process.env.AI_PROVIDER;
  if (isAIProvider(configured)) {
    return configured;
  }

  return "anthropic";
}

export function withAIProviderHeaders(headers: HeadersInit = {}): HeadersInit {
  const provider = getStoredAIProvider();
  if (provider === null) {
    return headers;
  }

  const merged = new Headers(headers);
  merged.set(AI_PROVIDER_HEADER, provider);
  return merged;
}
