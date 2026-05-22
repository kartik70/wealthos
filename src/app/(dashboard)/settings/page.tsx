"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { getStoredAIProvider, setStoredAIProvider } from "@/lib/ai/provider";
import type { AIProvider } from "@/lib/ai/provider";

export default function SettingsPage() {
  const [provider, setProvider] = useState<AIProvider>(() => {
    return getStoredAIProvider() ?? "anthropic";
  });

  function handleProviderChange(nextProvider: AIProvider) {
    setProvider(nextProvider);
    setStoredAIProvider(nextProvider);
  }

  return (
    <div className="animate-in fade-in-0 duration-300 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure AI and account preferences.
        </p>
      </div>

      <div className="max-w-sm rounded-lg border bg-card p-4">
        <div className="grid gap-2">
          <Label htmlFor="ai-provider">AI Provider</Label>
          <select
            id="ai-provider"
            value={provider}
            onChange={(event) => {
              handleProviderChange(
                event.target.value === "gemini" ? "gemini" : "anthropic",
              );
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="anthropic">Anthropic Claude</option>
            <option value="gemini">Google Gemini</option>
          </select>
          <p className="text-xs text-muted-foreground">
            This preference is stored in your browser and used for new insight generation requests.
          </p>
        </div>
      </div>
    </div>
  );
}
