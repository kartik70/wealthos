"use client";

import { Download, LogOut, Trash2 } from "lucide-react";
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
  type AIProvider,
} from "@/lib/ai/provider";
import { cn } from "@/lib/utils";
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
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({
    anthropicLast4: null,
    geminiLast4: null,
    updatedAt: null,
  });
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(true);
  const [isSavingApiKeys, setIsSavingApiKeys] = useState(false);

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

  function handleProviderChange(nextProvider: AIProvider) {
    setProvider(nextProvider);
    setStoredAIProvider(nextProvider);
    toast.success(`AI provider set to ${nextProvider === "anthropic" ? "Claude" : "Gemini"}`);
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
    if (anthropicKey.trim() === "" && geminiKey.trim() === "") {
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
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Account
        </h2>

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
              <div className="grid size-12 place-items-center rounded-full bg-foreground text-sm font-semibold text-background">
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {email ?? "Signed in"}
              </p>
              <p className="text-xs text-muted-foreground">Google account</p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => void signOut()}
            disabled={isSigningOut}
            className="justify-start sm:justify-center"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          AI Provider
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your preference is saved in this browser.
        </p>

        <div className="mt-4 grid max-w-md grid-cols-2 gap-2">
          {(
            [
              { id: "anthropic" as const, label: "Claude" },
              { id: "gemini" as const, label: "Gemini" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleProviderChange(option.id)}
              className={cn(
                "rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                provider === option.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted/50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Label className="sr-only">AI Provider</Label>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              API Keys
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keys are encrypted before storage. Saved keys are shown by last four characters only.
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
            <Label htmlFor="anthropic-api-key">Anthropic API Key</Label>
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
            />
            <p className="text-xs text-muted-foreground">
              {isLoadingApiKeys
                ? "Checking saved key..."
                : apiKeyStatus.anthropicLast4 === null
                  ? "No Anthropic key saved."
                  : `Saved key ends in ${apiKeyStatus.anthropicLast4}.`}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="gemini-api-key">Gemini API Key</Label>
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
            />
            <p className="text-xs text-muted-foreground">
              {isLoadingApiKeys
                ? "Checking saved key..."
                : apiKeyStatus.geminiLast4 === null
                  ? "No Gemini key saved."
                  : `Saved key ends in ${apiKeyStatus.geminiLast4}.`}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Data
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
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
