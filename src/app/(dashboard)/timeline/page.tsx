"use client";

import { ChevronDown, TrendingDown, TrendingUp, Plus, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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

      <div className="space-y-3">
        {snapshots.map((snapshot, index) => {
          const isFirst = index === snapshots.length - 1;
          const previous = index < snapshots.length - 1 ? snapshots[index + 1] : null;
          const diff = previous ? calcSnapshotDiff(previous, snapshot) : null;
          const isExpanded = expandedSnapshotId === snapshot.id;
          const gainTone = snapshot.totalGain >= 0 ? "text-emerald-700" : "text-red-700";

          return (
            <Card key={snapshot.id} className="overflow-hidden">
              <button
                onClick={() =>
                  setExpandedSnapshotId(isExpanded ? null : snapshot.id)
                }
                className="w-full text-left"
              >
                <CardHeader className="cursor-pointer hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">
                          {dateFormatter.format(new Date(snapshot.createdAt))}
                        </CardTitle>
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {isFirst ? (
                          <Badge variant="secondary">Initial import</Badge>
                        ) : diff ? (
                          <>
                            {diff.newPositions.map((h) => (
                              <Badge
                                key={`new-${h.symbol}`}
                                variant="outline"
                                className="gap-1"
                              >
                                <Plus className="size-3" />
                                {h.symbol}
                              </Badge>
                            ))}
                            {diff.exitedPositions.map((h) => (
                              <Badge
                                key={`exit-${h.symbol}`}
                                variant="outline"
                                className="gap-1"
                              >
                                <LogOut className="size-3" />
                                {h.symbol}
                              </Badge>
                            ))}
                            {diff.increasedPositions.map((h) => (
                              <Badge
                                key={`inc-${h.symbol}`}
                                variant="outline"
                                className="gap-1"
                              >
                                <TrendingUp className="size-3" />
                                {h.symbol}
                              </Badge>
                            ))}
                            {diff.reducedPositions.map((h) => (
                              <Badge
                                key={`red-${h.symbol}`}
                                variant="outline"
                                className="gap-1"
                              >
                                <TrendingDown className="size-3" />
                                {h.symbol}
                              </Badge>
                            ))}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {rupeeFormatter.format(snapshot.totalValue)}
                      </div>
                      <div className={cn("text-sm font-medium", gainTone)}>
                        {rupeeFormatter.format(snapshot.totalGain)} (
                        {percentFormatter.format(snapshot.totalGainPct)}%)
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </button>

              {isExpanded && (
                <CardContent className="border-t">
                  <div className="py-4">
                    <h3 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Holdings
                    </h3>
                    <HoldingsTable holdings={snapshot.holdings} />
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
