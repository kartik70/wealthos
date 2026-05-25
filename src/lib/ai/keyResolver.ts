import { getUserApiKeyForProvider } from "./user-api-keys";
import type { AIProvider } from "./provider";

export type MissingKeyProvider = AIProvider;

export class MissingApiKeyError extends Error {
  readonly missingKey: MissingKeyProvider;

  constructor(missingKey: MissingKeyProvider) {
    super(`Missing API key for ${missingKey}`);
    this.name = "MissingApiKeyError";
    this.missingKey = missingKey;
  }
}

async function resolveKey(
  userId: string,
  provider: MissingKeyProvider,
): Promise<string> {
  const stored = await getUserApiKeyForProvider(userId, provider);
  if (stored !== null && stored.trim() !== "") {
    return stored;
  }

  const envKey =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.GEMINI_API_KEY;

  if (envKey !== undefined && envKey.trim() !== "") {
    return envKey;
  }

  throw new MissingApiKeyError(provider);
}

export async function resolveAnthropicKey(userId: string): Promise<string> {
  return resolveKey(userId, "anthropic");
}

export async function resolveGeminiKey(userId: string): Promise<string> {
  return resolveKey(userId, "gemini");
}

export async function resolveProviderKey(
  userId: string,
  provider: AIProvider,
): Promise<string> {
  return resolveKey(userId, provider);
}

/**
 * Convert a thrown error into a structured 402 response when it represents a
 * missing API key. Returns null if the error is not a MissingApiKeyError so the
 * caller can fall through to its generic error handling.
 */
export function missingApiKeyResponse(error: unknown): Response | null {
  if (!(error instanceof MissingApiKeyError)) {
    return null;
  }

  return Response.json(
    {
      error: "API key required",
      missingKey: error.missingKey,
      message: "Add your API key in Settings to use this feature.",
    },
    { status: 402 },
  );
}
