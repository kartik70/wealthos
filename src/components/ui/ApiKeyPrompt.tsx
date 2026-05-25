"use client";

import { KeyRound, X } from "lucide-react";
import { useRouter } from "next/navigation";

export type MissingApiKey = "anthropic" | "gemini";

interface ApiKeyPromptProps {
  missingKey: MissingApiKey;
  onDismiss: () => void;
}

const KEY_LABEL: Record<MissingApiKey, string> = {
  anthropic: "Claude",
  gemini: "Gemini",
};

export function ApiKeyPrompt({ missingKey, onDismiss }: ApiKeyPromptProps): React.ReactElement {
  const router = useRouter();
  const label = KEY_LABEL[missingKey];

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#3b82f6]/50 bg-[#1d3a5f] p-4">
      <KeyRound className="mt-0.5 size-5 shrink-0 text-[#93c5fd]" aria-hidden="true" />
      <div className="flex-1 text-sm text-white">
        <p>
          This feature requires an API key. Add your {label} key in Settings to continue.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="rounded-md bg-[#3b82f6] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Go to Settings
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-[#3b82f6]/40 px-3 py-1.5 text-xs font-medium text-[#93c5fd] transition-colors hover:bg-[#3b82f6]/10"
          >
            Dismiss
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[#93c5fd] transition-colors hover:text-white"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/**
 * Parse a fetch Response into a MissingApiKey identifier if it represents the
 * structured 402 returned by `missingApiKeyResponse`. Returns null otherwise.
 *
 * The payload is consumed; callers should branch on the result before reading
 * the body for any other purpose.
 */
export function parseMissingApiKeyPayload(payload: unknown): MissingApiKey | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const candidate = payload as { missingKey?: unknown };
  if (candidate.missingKey === "anthropic" || candidate.missingKey === "gemini") {
    return candidate.missingKey;
  }
  return null;
}
