import { requireAuth } from "@/lib/db/require-auth";
import { getUserApiKeyForProvider } from "@/lib/ai/user-api-keys";
import { isAIProvider } from "@/lib/ai/provider";

export const runtime = "nodejs";

export interface ModelOption {
  id: string;
  name: string;
  free?: boolean;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  if (!isAIProvider(provider)) {
    return Response.json({ error: "Invalid provider" }, { status: 400 });
  }

  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const apiKey = await getUserApiKeyForProvider(auth.data.userId, provider);

  try {
    const models = await fetchModels(provider, apiKey ?? undefined);
    return Response.json({ models });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch models" },
      { status: 500 },
    );
  }
}

async function fetchModels(
  provider: string,
  apiKey?: string,
): Promise<ModelOption[]> {
  if (provider === "anthropic") {
    if (apiKey === undefined || apiKey === "") throw new Error("Anthropic API key required");
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
    const data = await res.json() as { data: { id: string; display_name?: string }[] };
    return data.data
      .filter((m) => m.id.startsWith("claude-"))
      .map((m) => ({ id: m.id, name: m.display_name ?? m.id }));
  }

  if (provider === "gemini") {
    if (apiKey === undefined || apiKey === "") throw new Error("Gemini API key required");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json() as {
      models: { name: string; displayName: string; supportedGenerationMethods: string[] }[];
    };
    return data.models
      .filter(
        (m) =>
          m.supportedGenerationMethods.includes("generateContent") &&
          !m.name.includes("embedding") &&
          !m.name.includes("aqa"),
      )
      .map((m) => ({ id: m.name.replace("models/", ""), name: m.displayName }));
  }

  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`);
    const data = await res.json() as {
      data: {
        id: string;
        name: string;
        context_length?: number;
        pricing?: { prompt: string; completion: string };
      }[];
    };
    return data.data
      .filter((m) => (m.context_length ?? 0) >= 8000)
      .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
      .slice(0, 60)
      .map((m) => ({
        id: m.id,
        name: m.name,
        free:
          m.pricing?.prompt === "0" ||
          m.pricing?.prompt === "0.0" ||
          m.id.endsWith(":free"),
      }));
  }

  if (provider === "groq") {
    if (apiKey === undefined || apiKey === "") throw new Error("Groq API key required");
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
    const data = await res.json() as { data: { id: string }[] };
    return data.data.map((m) => ({ id: m.id, name: m.id }));
  }

  throw new Error(`Unknown provider: ${provider}`);
}
