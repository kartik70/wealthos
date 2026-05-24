"use client";

import { ChevronDown, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calcSnapshotDiff } from "@/lib/finance/diff";
import { cn } from "@/lib/utils";
import type { PortfolioSnapshot } from "@/types/portfolio";

interface AllSnapshotsResponse {
  snapshots: PortfolioSnapshot[];
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type ChangePill = {
  key: string;
  label: string;
  tone: "positive" | "negative" | "neutral";
  emoji?: string;
  detail?: string;
  isPartialExit?: boolean;
};

function getSnapshotPills(current: PortfolioSnapshot, previous: PortfolioSnapshot | null): ChangePill[] {
  if (!previous) {
    return [];
  }

  const diff = calcSnapshotDiff(previous, current);
  const previousHoldingMap = new Map(previous.holdings.map((holding) => [holding.symbol, holding]));

  const unchangedCount = current.holdings
    .filter((holding) => previousHoldingMap.get(holding.symbol)?.quantity === holding.quantity)
    .length;

  const unchangedPill: ChangePill[] = unchangedCount > 0
    ? [{
        key: "unchanged-count",
        label: `${unchangedCount} unchanged`,
        tone: "neutral" as const,
      }]
    : [];

  const positive = [
    ...diff.newPositions.map((holding) => ({
      key: `new-${holding.symbol}`,
      label: `+ ${holding.symbol}`,
      tone: "positive" as const,
    })),
    ...diff.increasedPositions.map((holding) => ({
      key: `inc-${holding.symbol}`,
      label: `↑ ${holding.symbol}`,
      tone: "positive" as const,
    })),
    ...diff.partialExits
      .filter((exit) => exit.pnlType === "BOOKED_PROFIT")
      .map((exit) => ({
        key: `partial-${exit.symbol}`,
        label: `↗ ${exit.symbol} -${Math.round(exit.quantitySold)} qty +₹${Math.round(Math.abs(exit.realizedPnL))}`,
        tone: "positive" as const,
        isPartialExit: true,
      })),
  ];

  const negative = [
    ...diff.reducedPositions.map((holding) => ({
      key: `red-${holding.symbol}`,
      label: `↓ ${holding.symbol}`,
      tone: "negative" as const,
    })),
    ...diff.exitedPositions.map((holding) => ({
      key: `exit-${holding.symbol}`,
      label: `× ${holding.symbol}`,
      tone: "negative" as const,
    })),
    ...diff.partialExits
      .filter((exit) => exit.pnlType === "BOOKED_LOSS")
      .map((exit) => ({
        key: `partial-${exit.symbol}`,
        label: `↘ ${exit.symbol} -${Math.round(exit.quantitySold)} qty -₹${Math.round(Math.abs(exit.realizedPnL))}`,
        tone: "negative" as const,
        isPartialExit: true,
      })),
  ];

  return [...positive, ...negative, ...unchangedPill];
}

export default function TimelinePage() {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);
  const [pendingDeleteSnapshot, setPendingDeleteSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const response = await fetch("/api/snapshots/all");
        if (!response.ok) {
          throw new Error("Failed to fetch snapshots");
        }
        const data: AllSnapshotsResponse = await response.json();
        setSnapshots(data.snapshots);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch snapshots";
        setError(message);
        toast.error(message || "Failed to load timeline");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSnapshots();
  }, []);

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
      setExpandedSnapshotId((current) => (current === snapshotId ? null : current));
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

  if (isLoading) {
    return (
      <div className="animate-in fade-in-0 duration-300 grid gap-4 py-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl border border-border/70 bg-card/60 p-4">
            <div className="mb-3 h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">No snapshots yet. Upload your first portfolio CSV to get started.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in-0 duration-300 flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">Portfolio snapshots and changes</p>
      </div>

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

      <div className="relative ml-2 border-l border-border/70 pl-6">
        {snapshots.map((snapshot, index) => {
          const isFirst = index === snapshots.length - 1;
          const previous = index < snapshots.length - 1 ? snapshots[index + 1] : null;
          const isExpanded = expandedSnapshotId === snapshot.id;
          const valueDelta = previous ? snapshot.totalValue - previous.totalValue : null;
          const gainTone = snapshot.totalGain >= 0 ? "text-emerald-700" : "text-red-700";
          const pills = getSnapshotPills(snapshot, previous);

          return (
            <div key={snapshot.id} className="relative pb-6">
              <span className="absolute -left-[1.85rem] top-4 size-3 rounded-full border-2 border-background bg-foreground/70" />

              <div className="rounded-xl border border-border/70 bg-card/60">
                <div className="flex items-start gap-1 px-4 py-4">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSnapshotId(isExpanded ? null : snapshot.id)
                    }
                    className="min-w-0 flex-1 text-left transition-colors hover:bg-muted/30 rounded-md -m-2 p-2"
                  >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-mono text-sm text-muted-foreground">
                        {dateFormatter.format(new Date(snapshot.createdAt))}
                      </p>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {rupeeFormatter.format(snapshot.totalValue)}
                        </div>
                        <div className={cn("text-sm font-medium", gainTone)}>
                          {rupeeFormatter.format(snapshot.totalGain)} (
                          {percentFormatter.format(snapshot.totalGainPct)}%)
                        </div>
                      </div>
                    </div>

                    {isFirst ? (
                      <p className="text-sm text-muted-foreground">Initial import</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {pills.map((pill) => (
                          <Badge
                            key={pill.key}
                            variant="secondary"
                            className={cn(
                              "font-mono text-xs",
                              pill.tone === "positive" && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
                              pill.tone === "negative" && "bg-red-100 text-red-800 hover:bg-red-100",
                              pill.tone === "neutral" && "bg-muted text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {pill.label}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      <span>View holdings</span>
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </div>
                  </div>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete snapshot from ${dateFormatter.format(new Date(snapshot.createdAt))}`}
                    onClick={() => setPendingDeleteSnapshot(snapshot)}
                    disabled={deletingSnapshotId === snapshot.id}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 py-4">
                    <HoldingsTable holdings={snapshot.holdings} />
                  </div>
                )}
              </div>

              {valueDelta !== null && (
                <div className="mt-3 flex items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
                  <span>―――</span>
                  <p>
                    {valueDelta > 0 ? "+" : valueDelta < 0 ? "−" : ""}
                    {rupeeFormatter.format(Math.abs(valueDelta))}
                  </p>
                  <span>―――</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
