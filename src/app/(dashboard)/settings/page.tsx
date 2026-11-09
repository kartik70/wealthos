"use client";

import { AlertTriangle, CheckCircle2, Download, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/db/supabase";
import {
  getStoredAIProvider,
  setStoredAIProvider,
  getStoredModelForProvider,
  setStoredModelForProvider,
  providerLabel,
  type AIProvider,
} from "@/lib/ai/provider";
import type { ModelOption } from "@/app/api/settings/models/route";
import type { PortfolioSnapshot } from "@/types/portfolio";

interface AllSnapshotsResponse {
  snapshots: PortfolioSnapshot[];
}

interface SnapshotListItem {
  id: string;
  createdAt: string;
  totalValue: number;
}

interface ApiKeyStatus {
  anthropicLast4: string | null;
  geminiLast4: string | null;
  openrouterLast4: string | null;
  groqLast4: string | null;
  updatedAt: string | null;
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function getInitials(email: string | undefined): string {
  if (email === undefined || email === "") {
    return "?";
  }

  const localPart = email.split("@")[0] ?? "";
  const parts = localPart.split(/[._-]/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return localPart.slice(0, 2).toUpperCase();
}

function getAvatarUrl(metadata: Record<string, unknown> | undefined): string | null {
  if (metadata === undefined) {
    return null;
  }

  const avatarUrl = metadata.avatar_url;
  if (typeof avatarUrl === "string" && avatarUrl !== "") {
    return avatarUrl;
  }

  const picture = metadata.picture;
  if (typeof picture === "string" && picture !== "") {
    return picture;
  }

  return null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [provider, setProvider] = useState<AIProvider>(() => getStoredAIProvider() ?? "anthropic");
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [pendingDeleteSnapshot, setPendingDeleteSnapshot] = useState<SnapshotListItem | null>(null);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({
    anthropicLast4: null,
    geminiLast4: null,
    openrouterLast4: null,
    groqLast4: null,
    updatedAt: null,
  });
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(true);
  const [isSavingApiKeys, setIsSavingApiKeys] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => getStoredModelForProvider(getStoredAIProvider() ?? "anthropic") ?? "",
  );
  const [modelFilter, setModelFilter] = useState("");

  const loadSnapshots = useCallback(async () => {
    setIsLoadingSnapshots(true);

    try {
      const response = await fetch("/api/snapshots/all");
      if (!response.ok) {
        throw new Error("Failed to load snapshots");
      }

      const data = (await response.json()) as AllSnapshotsResponse;
      setSnapshots(
        data.snapshots.map((snapshot) => ({
          id: snapshot.id,
          createdAt: snapshot.createdAt,
          totalValue: snapshot.totalValue,
        })),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load snapshots";
      toast.error(message);
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, []);

  const loadApiKeys = useCallback(async () => {
    setIsLoadingApiKeys(true);

    try {
      const response = await fetch("/api/settings/api-keys");
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Failed to load API keys";
        throw new Error(message);
      }

      setApiKeyStatus(payload as ApiKeyStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load API keys";
      toast.error(message);
    } finally {
      setIsLoadingApiKeys(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    void supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      setAvatarUrl(getAvatarUrl(user?.user_metadata));
    });

    void loadSnapshots();
    void loadApiKeys();
  }, [loadApiKeys, loadSnapshots]);

  const loadModels = useCallback(async (p: AIProvider) => {
    setIsLoadingModels(true);
    setModels([]);
    try {
      const res = await fetch(`/api/settings/models?provider=${p}`);
      const data = (await res.json()) as { models?: ModelOption[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load models");
      setModels(data.models ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  function handleProviderChange(nextProvider: AIProvider) {
    setProvider(nextProvider);
    setStoredAIProvider(nextProvider);
    setSelectedModel(getStoredModelForProvider(nextProvider) ?? "");
    setModelFilter("");
    void loadModels(nextProvider);
    toast.success(`AI provider set to ${providerLabel(nextProvider)}`);
  }

  function handleModelSelect(modelId: string) {
    const next = modelId === selectedModel ? "" : modelId;
    setSelectedModel(next);
    setStoredModelForProvider(provider, next);
    toast.success(next === "" ? "Using default model" : `Model set to ${next}`);
  }

  async function signOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleExportHoldings() {
    setIsExporting(true);

    try {
      const response = await fetch("/api/export/holdings");

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to export holdings");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "wealthos-holdings.csv";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Holdings exported");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export holdings";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSaveApiKeys() {
    if (
      anthropicKey.trim() === "" &&
      geminiKey.trim() === "" &&
      openrouterKey.trim() === "" &&
      groqKey.trim() === ""
    ) {
      toast.error("Enter at least one API key to save");
      return;
    }

    setIsSavingApiKeys(true);

    try {
      const response = await fetch("/api/settings/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthropicKey,
          geminiKey,
          openrouterKey,
          groqKey,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Failed to save API keys";
        throw new Error(message);
      }

      setApiKeyStatus(payload as ApiKeyStatus);
      setAnthropicKey("");
      setGeminiKey("");
      setOpenrouterKey("");
      setGroqKey("");
      toast.success("API keys saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save API keys";
      toast.error(message);
    } finally {
      setIsSavingApiKeys(false);
    }
  }

  async function handleDeleteSnapshot() {
    if (pendingDeleteSnapshot === null) {
      return;
    }

    const snapshotId = pendingDeleteSnapshot.id;
    setDeletingSnapshotId(snapshotId);

    try {
      const response = await fetch(`/api/snapshots/${snapshotId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete snapshot");
      }

      setSnapshots((current) => current.filter((snapshot) => snapshot.id !== snapshotId));
      setPendingDeleteSnapshot(null);
      window.dispatchEvent(new Event("wealthos:snapshot-updated"));
      toast.success("Snapshot deleted");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete snapshot";
      toast.error(message);
    } finally {
      setDeletingSnapshotId(null);
    }
  }

  const initials = getInitials(email ?? undefined);

  return (
    <div className="animate-in fade-in-0 duration-300 flex flex-col gap-6">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account, AI preferences, and portfolio data.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-6">
        <SectionHeader label="Account" />

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {avatarUrl !== null ? (
              <img
                src={avatarUrl}
                alt=""
                className="size-12 rounded-full border border-border object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="grid size-12 place-items-center rounded-full font-mono text-sm"
                style={{
                  background: "#1d3a5f",
                  color: "#3b82f6",
                  fontWeight: 500,
                }}
              >
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-white">
                {email ?? "Signed in"}
              </p>
              <p className="text-xs" style={{ color: "#4a5568" }}>Google account</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            disabled={isSigningOut}
            className="inline-flex items-center gap-1.5 self-start rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-50 sm:self-center"
            style={{ color: "#8899aa" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f43f5e")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#8899aa")}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <SectionHeader label="AI Provider" />
        <p className="mt-2 text-sm" style={{ color: "#8899aa" }}>
          Your preference is saved in this browser.
        </p>

        <div className="mt-4 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              { id: "anthropic" as const, label: "Claude", sub: "Anthropic" },
              { id: "gemini" as const, label: "Gemini", sub: "Google" },
              { id: "openrouter" as const, label: "OpenRouter", sub: "Free tier" },
              { id: "groq" as const, label: "Groq", sub: "Free tier" },
            ] as const
          ).map((option) => {
            const active = provider === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleProviderChange(option.id)}
                className="rounded-lg px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  background: active ? "#1d3a5f" : "#111827",
                  border: active ? "1px solid #3b82f6" : "1px solid #1e2d40",
                  color: active ? "#ffffff" : "#8899aa",
                }}
              >
                <div>{option.label}</div>
                <div className="text-[11px] opacity-60">{option.sub}</div>
              </button>
            );
          })}
        </div>
        <Label className="sr-only">AI Provider</Label>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <SectionHeader label="API Keys" />
            <p className="mt-2 text-sm" style={{ color: "#8899aa" }}>
              Keys are encrypted before storage. Saved keys are shown by last four characters only.
            </p>
            <p className="mt-1 text-sm" style={{ color: "#8899aa" }}>
              <span className="font-medium text-white">Minimum setup:</span> a Gemini key is always
              required (it powers portfolio search). Add one more key for your selected AI provider —
              or just use Gemini for both.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void handleSaveApiKeys()}
            disabled={isSavingApiKeys}
          >
            {isSavingApiKeys ? "Saving..." : "Save keys"}
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="anthropic-api-key">Anthropic API Key</Label>
              <KeyStatusIndicator
                isLoading={isLoadingApiKeys}
                hasKey={apiKeyStatus.anthropicLast4 !== null}
                required={provider === "anthropic"}
              />
            </div>
            <p className="text-xs" style={{ color: "#8899aa" }}>
              {provider === "anthropic"
                ? "Required — Claude is your selected provider."
                : "Only needed if you select Claude as your provider."}
            </p>
            <Input
              id="anthropic-api-key"
              type="password"
              value={anthropicKey}
              placeholder={
                apiKeyStatus.anthropicLast4 === null
                  ? "sk-ant-..."
                  : `Saved ending in ${apiKeyStatus.anthropicLast4}`
              }
              autoComplete="off"
              onChange={(event) => setAnthropicKey(event.target.value)}
              className="border-[#1e2d40] bg-[#0a0f1e] font-mono text-sm text-white placeholder:text-[#4a5568]"
            />
            <p className="text-xs" style={{ color: "#4a5568" }}>
              {isLoadingApiKeys
                ? "Checking saved key..."
                : apiKeyStatus.anthropicLast4 === null
                  ? "No Anthropic key saved."
                  : `Saved key ends in ${apiKeyStatus.anthropicLast4}.`}
            </p>
            <p className="text-xs" style={{ color: "#4a5568" }}>
              Get your key at{" "}
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                console.anthropic.com
              </a>
              .
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="gemini-api-key">
                Gemini API Key{" "}
                <span className="text-[10px] font-normal" style={{ color: "#3b82f6" }}>
                  always required
                </span>
              </Label>
              <KeyStatusIndicator
                isLoading={isLoadingApiKeys}
                hasKey={apiKeyStatus.geminiLast4 !== null}
                required={true}
              />
            </div>
            <p className="text-xs" style={{ color: "#8899aa" }}>
              Powers advisor memory and portfolio search (embeddings). Free tier — no billing
              required.{provider === "gemini" ? " Also your selected LLM provider." : ""}
            </p>
            <Input
              id="gemini-api-key"
              type="password"
              value={geminiKey}
              placeholder={
                apiKeyStatus.geminiLast4 === null
                  ? "AIza..."
                  : `Saved ending in ${apiKeyStatus.geminiLast4}`
              }
              autoComplete="off"
              onChange={(event) => setGeminiKey(event.target.value)}
              className="border-[#1e2d40] bg-[#0a0f1e] font-mono text-sm text-white placeholder:text-[#4a5568]"
            />
            <p className="text-xs" style={{ color: "#4a5568" }}>
              {isLoadingApiKeys
                ? "Checking saved key..."
                : apiKeyStatus.geminiLast4 === null
                  ? "No Gemini key saved."
                  : `Saved key ends in ${apiKeyStatus.geminiLast4}.`}
            </p>
            <p className="text-xs" style={{ color: "#4a5568" }}>
              Get your key at{" "}
              <a
                href="https://aistudio.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                aistudio.google.com
              </a>
              .
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="openrouter-api-key">OpenRouter API Key</Label>
              <KeyStatusIndicator
                isLoading={isLoadingApiKeys}
                hasKey={apiKeyStatus.openrouterLast4 !== null}
                required={provider === "openrouter"}
              />
            </div>
            <p className="text-xs" style={{ color: "#8899aa" }}>
              {provider === "openrouter"
                ? "Required — OpenRouter is your selected provider."
                : "Only needed if you select OpenRouter as your provider."}{" "}
              Free tier available; routes to 100+ models.
            </p>
            <Input
              id="openrouter-api-key"
              type="password"
              value={openrouterKey}
              placeholder={
                apiKeyStatus.openrouterLast4 === null
                  ? "sk-or-..."
                  : `Saved ending in ${apiKeyStatus.openrouterLast4}`
              }
              autoComplete="off"
              onChange={(event) => setOpenrouterKey(event.target.value)}
              className="border-[#1e2d40] bg-[#0a0f1e] font-mono text-sm text-white placeholder:text-[#4a5568]"
            />
            <p className="text-xs" style={{ color: "#4a5568" }}>
              {isLoadingApiKeys
                ? "Checking saved key..."
                : apiKeyStatus.openrouterLast4 === null
                  ? "No OpenRouter key saved."
                  : `Saved key ends in ${apiKeyStatus.openrouterLast4}.`}
            </p>
            <p className="text-xs" style={{ color: "#4a5568" }}>
              Get your key at{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                openrouter.ai/keys
              </a>
              .
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="groq-api-key">Groq API Key</Label>
              <KeyStatusIndicator
                isLoading={isLoadingApiKeys}
                hasKey={apiKeyStatus.groqLast4 !== null}
                required={provider === "groq"}
              />
            </div>
            <p className="text-xs" style={{ color: "#8899aa" }}>
              {provider === "groq"
                ? "Required — Groq is your selected provider."
                : "Only needed if you select Groq as your provider."}{" "}
              Free tier available; runs Llama 3.3 70B at very high speed.
            </p>
            <Input
              id="groq-api-key"
              type="password"
              value={groqKey}
              placeholder={
                apiKeyStatus.groqLast4 === null
                  ? "gsk_..."
                  : `Saved ending in ${apiKeyStatus.groqLast4}`
              }
              autoComplete="off"
              onChange={(event) => setGroqKey(event.target.value)}
              className="border-[#1e2d40] bg-[#0a0f1e] font-mono text-sm text-white placeholder:text-[#4a5568]"
            />
            <p className="text-xs" style={{ color: "#4a5568" }}>
              {isLoadingApiKeys
                ? "Checking saved key..."
                : apiKeyStatus.groqLast4 === null
                  ? "No Groq key saved."
                  : `Saved key ends in ${apiKeyStatus.groqLast4}.`}
            </p>
            <p className="text-xs" style={{ color: "#4a5568" }}>
              Get your key at{" "}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                console.groq.com/keys
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <SectionHeader label="Model" />
        <p className="mt-2 mb-4 text-sm" style={{ color: "#8899aa" }}>
          Choose a specific model for <strong>{providerLabel(provider)}</strong>. Leave blank to use the default.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Search models…"
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="flex-1 rounded-md border border-[#1e2d40] bg-[#0a0f1e] px-3 py-1.5 text-sm text-white placeholder:text-[#4a5568] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadModels(provider)}
            disabled={isLoadingModels}
          >
            {isLoadingModels ? "Loading…" : "Load models"}
          </Button>
        </div>
        {selectedModel !== "" && (
          <p className="mb-2 text-xs" style={{ color: "#8899aa" }}>
            Active: <span className="font-mono text-white">{selectedModel}</span>{" "}
            <button
              className="text-[#3b82f6] hover:underline"
              onClick={() => handleModelSelect("")}
            >
              clear
            </button>
          </p>
        )}
        {models.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-md border border-[#1e2d40] divide-y divide-[#1e2d40]">
            {models
              .filter((m) =>
                modelFilter === "" ||
                m.id.toLowerCase().includes(modelFilter.toLowerCase()) ||
                m.name.toLowerCase().includes(modelFilter.toLowerCase()),
              )
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelSelect(m.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#0d1526] transition-colors ${
                    selectedModel === m.id ? "bg-[#0d1526] text-[#3b82f6]" : "text-white"
                  }`}
                >
                  <span className="font-mono truncate">{m.id}</span>
                  <span className="flex shrink-0 items-center gap-1.5" style={{ color: "#8899aa" }}>
                    {m.free === true && (
                      <span className="rounded bg-green-900/50 px-1 py-0.5 text-[10px] text-green-400">
                        free
                      </span>
                    )}
                    {m.name !== m.id && <span className="text-xs truncate max-w-32">{m.name}</span>}
                  </span>
                </button>
              ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <SectionHeader label="Data" />
            <p className="mt-2 text-sm" style={{ color: "#8899aa" }}>
              Manage portfolio snapshots and export your latest holdings.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => void handleExportHoldings()}
            disabled={isExporting || snapshots.length === 0}
          >
            <Download className="size-4" aria-hidden="true" />
            {isExporting ? "Exporting…" : "Export holdings CSV"}
          </Button>
        </div>

        <div className="mt-4 divide-y rounded-lg border border-border">
          {isLoadingSnapshots ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Loading snapshots…</div>
          ) : snapshots.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No snapshots yet. Import a CSV to create your first snapshot.
            </div>
          ) : (
            snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm">
                    {dateFormatter.format(new Date(snapshot.createdAt))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {rupeeFormatter.format(snapshot.totalValue)}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete snapshot from ${dateFormatter.format(new Date(snapshot.createdAt))}`}
                  onClick={() => setPendingDeleteSnapshot(snapshot)}
                  disabled={deletingSnapshotId === snapshot.id}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {pendingDeleteSnapshot !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setPendingDeleteSnapshot(null)}
            aria-label="Close confirmation"
            disabled={deletingSnapshotId !== null}
          />

          <div className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold tracking-tight">Delete snapshot?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently delete the snapshot from{" "}
              <span className="font-medium text-foreground">
                {dateFormatter.format(new Date(pendingDeleteSnapshot.createdAt))}
              </span>
              , including holdings, insights, and embeddings. This cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingDeleteSnapshot(null)}
                disabled={deletingSnapshotId !== null}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDeleteSnapshot()}
                disabled={deletingSnapshotId !== null}
              >
                {deletingSnapshotId !== null ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2
        className="text-[10px] uppercase tracking-[0.14em] whitespace-nowrap"
        style={{ color: "#4a5568" }}
      >
        {label}
      </h2>
      <div className="h-px flex-1" style={{ background: "#1e2d40" }} />
    </div>
  );
}

function KeyStatusIndicator({
  isLoading,
  hasKey,
  required,
}: {
  isLoading: boolean;
  hasKey: boolean;
  required: boolean;
}) {
  if (isLoading) {
    return null;
  }
  if (hasKey) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        Saved
      </span>
    );
  }
  if (required) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-rose-500">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        Required
      </span>
    );
  }
  return (
    <span className="text-[11px]" style={{ color: "#4a5568" }}>
      Optional
    </span>
  );
}
