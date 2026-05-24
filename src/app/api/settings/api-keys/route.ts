import { requireAuth } from "@/lib/db/require-auth";
import { getUserApiKeyStatus, saveUserApiKeys } from "@/lib/ai/user-api-keys";

export const runtime = "nodejs";

interface SaveApiKeysBody {
  anthropicKey?: string;
  geminiKey?: string;
}

export async function GET(): Promise<Response> {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return auth.error;
    }

    const status = await getUserApiKeyStatus(auth.data.userId);
    return Response.json(status);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load API keys" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await readRequestBody(request);
    if (!isSaveApiKeysBody(body)) {
      return Response.json({ error: "Invalid API key payload" }, { status: 400 });
    }

    const status = await saveUserApiKeys(auth.data.userId, body);
    return Response.json(status);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save API keys" },
      { status: 500 },
    );
  }
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isSaveApiKeysBody(value: unknown): value is SaveApiKeysBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SaveApiKeysBody>;
  return (
    (candidate.anthropicKey === undefined || typeof candidate.anthropicKey === "string") &&
    (candidate.geminiKey === undefined || typeof candidate.geminiKey === "string")
  );
}
