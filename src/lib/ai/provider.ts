export type AIProvider = "anthropic" | "gemini" | "openrouter" | "groq";

export const AI_PROVIDER_STORAGE_KEY = "ai_provider";
export const AI_PROVIDER_HEADER = "x-ai-provider";
const LEGACY_AI_PROVIDER_STORAGE_KEY = "wealthos:ai-provider";

export function isAIProvider(value: unknown): value is AIProvider {
  return (
    value === "anthropic" ||
    value === "gemini" ||
    value === "openrouter" ||
    value === "groq"
  );
}

export function providerLabel(provider: AIProvider): string {
  switch (provider) {
    case "anthropic": return "Claude";
    case "gemini": return "Gemini";
    case "openrouter": return "OpenRouter";
    case "groq": return "Groq";
  }
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

export const AI_MODEL_STORAGE_KEY_PREFIX = "wealthos:model:";
export const AI_MODEL_HEADER = "x-ai-model";

export function getStoredModelForProvider(provider: AIProvider): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`${AI_MODEL_STORAGE_KEY_PREFIX}${provider}`);
  } catch {
    return null;
  }
}

export function setStoredModelForProvider(provider: AIProvider, model: string): void {
  if (typeof window === "undefined") return;
  try {
    if (model === "") {
      window.localStorage.removeItem(`${AI_MODEL_STORAGE_KEY_PREFIX}${provider}`);
    } else {
      window.localStorage.setItem(`${AI_MODEL_STORAGE_KEY_PREFIX}${provider}`, model);
    }
  } catch {
    // ignore storage errors
  }
}

export function getModelFromRequest(request: Request): string | null {
  const v = request.headers.get(AI_MODEL_HEADER);
  return v !== null && v.trim() !== "" ? v.trim() : null;
}

/** Sends both the provider and the selected model for that provider. */
export function withAIHeaders(headers: HeadersInit = {}): HeadersInit {
  const provider = getStoredAIProvider();
  const merged = new Headers(headers);
  if (provider !== null) {
    merged.set(AI_PROVIDER_HEADER, provider);
    const model = getStoredModelForProvider(provider);
    if (model !== null) merged.set(AI_MODEL_HEADER, model);
  }
  return merged;
}
