"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { Badge } from "@/components/ui/badge";
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
};

function getSnapshotPills(current: PortfolioSnapshot, previous: PortfolioSnapshot | null): ChangePill[] {
  if (!previous) {
    return [];
  }

  const diff = calcSnapshotDiff(previous, current);
  const previousHoldingMap = new Map(previous.holdings.map((holding) => [holding.symbol, holding]));

  const unchanged = current.holdings
    .filter((holding) => previousHoldingMap.get(holding.symbol)?.quantity === holding.quantity)
    .map((holding) => ({
      key: `same-${holding.symbol}`,
      label: `= ${holding.symbol}`,
      tone: "neutral" as const,
    }));

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
  ];

  return [...positive, ...negative, ...unchanged];
}

export default function TimelinePage() {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);
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
        setError(err instanceof Error ? err.message : "Failed to fetch snapshots");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSnapshots();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading timeline...</p>
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-sm text-muted-foreground">Portfolio snapshots and changes</p>
      </div>

      <div className="relative ml-2 border-l border-border/70 pl-6">
        {snapshots.map((snapshot, index) => {
          const isFirst = index === snapshots.length - 1;
          const previous = index < snapshots.length - 1 ? snapshots[index + 1] : null;
          const isExpanded = expandedSnapshotId === snapshot.id;
          const valueDelta = previous ? snapshot.totalValue - previous.totalValue : null;
          const gainTone = snapshot.totalGain >= 0 ? "text-emerald-700" : "text-red-700";
          const valueDeltaTone = valueDelta === null || valueDelta === 0
            ? "text-muted-foreground"
            : valueDelta > 0
              ? "text-emerald-700"
              : "text-red-700";
          const pills = getSnapshotPills(snapshot, previous);

          return (
            <div key={snapshot.id} className="relative pb-6">
              <span className="absolute -left-[1.85rem] top-4 size-3 rounded-full border-2 border-background bg-foreground/70" />

              <div className="rounded-xl border border-border/70 bg-card/60">
                <button
                  onClick={() =>
                    setExpandedSnapshotId(isExpanded ? null : snapshot.id)
                  }
                  className="w-full px-4 py-4 text-left transition-colors hover:bg-muted/30"
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

                {isExpanded && (
                  <div className="border-t px-4 py-4">
                    <HoldingsTable holdings={snapshot.holdings} />
                  </div>
                )}
              </div>

              {valueDelta !== null && (
                <div className="mt-3 flex items-center gap-2 pl-1">
                  <span className="h-px w-8 bg-border/80" />
                  <p className={cn("text-xs font-mono", valueDeltaTone)}>
                    {valueDelta > 0 ? "+" : valueDelta < 0 ? "-" : ""}
                    {rupeeFormatter.format(Math.abs(valueDelta))}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
