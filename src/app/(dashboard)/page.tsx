"use client";

import { Upload, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { InsightCard } from "@/components/insights/InsightCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Holding, PortfolioTotals, InsightResponse } from "@/types/portfolio";

interface UploadResponse {
  snapshotId: string | null;
  totals: PortfolioTotals;
  holdings: Holding[];
  persisted?: boolean;
}

interface LatestSnapshotResponse {
  snapshotId: string;
  totals: PortfolioTotals;
  holdings: Holding[];
  source: "kite" | "groww";
  createdAt: string;
  insight?: InsightResponse;
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export default function DashboardPage() {
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [snapshotSource, setSnapshotSource] = useState<"kite" | "groww">("kite");
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const fetchLatestSnapshot = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/snapshots/latest");

      if (response.status === 404) {
        setUploadResult(null);
        setInsight(null);
        return;
      }

      const payload: unknown = await response.json();

      if (!response.ok) {
        const message = getErrorMessage(payload) || "Failed to load portfolio";
        toast.error(message);
        return;
      }

      if (!isLatestSnapshotResponse(payload)) {
        toast.error("Failed to load portfolio");
        return;
      }

      setUploadResult({
        snapshotId: payload.snapshotId,
        totals: payload.totals,
        holdings: payload.holdings,
        persisted: true,
      });
      setSnapshotSource(payload.source);
      setInsight(payload.insight ?? null);
    } catch {
      toast.error("Failed to load portfolio");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void fetchLatestSnapshot();
    });

    function handleSnapshotUpdated() {
      void fetchLatestSnapshot();
    }

    window.addEventListener("wealthos:snapshot-updated", handleSnapshotUpdated);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("wealthos:snapshot-updated", handleSnapshotUpdated);
    };
  }, [fetchLatestSnapshot]);

  const totals = uploadResult?.totals;
  const hasHoldings = uploadResult !== null && uploadResult.holdings.length > 0;
  const gainTone = useMemo(() => {
    if (uploadResult === null) {
      return "text-foreground";
    }

    return uploadResult.totals.totalGain >= 0 ? "text-emerald-700" : "text-red-700";
  }, [uploadResult]);

  const holdingsInLoss = useMemo(() => {
    if (uploadResult === null) {
      return 0;
    }

    return uploadResult.holdings.filter((holding) => holding.unrealisedGain < 0).length;
  }, [uploadResult]);

  async function handleGenerateInsights() {
    if (uploadResult?.snapshotId === null || uploadResult?.snapshotId === undefined) {
      setInsightError("No snapshot available. Please upload a CSV first.");
      toast.error("No snapshot available. Please upload a CSV first.");
      return;
    }

    setIsGeneratingInsight(true);
    setInsightError(null);
    setInsight(null);

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: uploadResult.snapshotId }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const errorMsg =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Failed to generate insights";
        setInsightError(errorMsg);
        toast.error(errorMsg || "Insight generation failed");
        return;
      }

      if (!isInsightResponse(payload)) {
        setInsightError("Invalid insight response format");
        toast.error("Insight generation failed");
        return;
      }

      setInsight(payload);
    } catch (err) {
      setInsightError(
        err instanceof Error ? err.message : "Failed to generate insights",
      );
      toast.error("Insight generation failed");
    } finally {
      setIsGeneratingInsight(false);
    }
  }

  function openImportModal() {
    window.dispatchEvent(new Event("wealthos:open-import"));
  }

  const showEmptyState = !isLoading && uploadResult === null;

  return (
    <div className="animate-in fade-in-0 duration-300 flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Portfolio snapshot</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Value"
          value={
            isLoading
              ? "--"
              : totals === undefined
                ? "--"
                : rupeeFormatter.format(totals.totalValue)
          }
          isLoading={isLoading}
        />
        <StatCard
          label="Total Gain/Loss"
          value={
            isLoading
              ? "--"
              : totals === undefined
                ? "--"
                : rupeeFormatter.format(totals.totalGain)
          }
          valueClassName={totals === undefined ? undefined : gainTone}
          isLoading={isLoading}
        />
        <StatCard
          label="Gain %"
          value={
            totals === undefined
              ? "--"
              : `${percentFormatter.format(totals.totalGainPct)}%`
          }
          valueClassName={totals === undefined ? undefined : gainTone}
          isLoading={isLoading}
        />
        <StatCard
          label="Holdings in Loss"
          value={uploadResult === null ? "--" : String(holdingsInLoss)}
          valueClassName={uploadResult === null ? undefined : "text-red-700"}
          isLoading={isLoading}
        />
      </div>

      {showEmptyState && (
        <Card className="border border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-muted">
              <Upload className="size-7 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold tracking-tight">No portfolio yet</h3>
              <p className="text-sm text-muted-foreground">
                Upload your first Kite CSV to get started
              </p>
            </div>
            <Button onClick={openImportModal}>Upload CSV</Button>
          </CardContent>
        </Card>
      )}

      {hasHoldings && uploadResult !== null && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>Portfolio analysis and recommendations</CardDescription>
            </div>
            <Button
              onClick={handleGenerateInsights}
              disabled={isGeneratingInsight}
              variant="default"
              size="sm"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {isGeneratingInsight ? "Generating..." : "Generate"}
            </Button>
          </CardHeader>
          <CardContent>
            <InsightCard
              insight={insight}
              onGenerateInsights={handleGenerateInsights}
              isGenerating={isGeneratingInsight}
              hasHoldings={hasHoldings}
            />
            {insightError !== null && (
              <p className="mt-3 text-sm text-destructive">{insightError}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Snapshot</CardTitle>
            <CardDescription>
              {uploadResult?.snapshotId ?? "No saved snapshot"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Source</span>
              <span className="font-medium capitalize">{snapshotSource}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Holdings</span>
              <span className="font-medium">
                {uploadResult === null ? "--" : uploadResult.holdings.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">
                {uploadResult === null
                  ? "Ready"
                  : uploadResult.persisted === false
                    ? "Preview"
                    : "Saved"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {hasHoldings && uploadResult !== null && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingsTable holdings={uploadResult.holdings} isLoading={isLoading} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 w-full animate-pulse rounded bg-muted" />
              ) : (
                <AllocationChart holdings={uploadResult.holdings} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingsTable holdings={[]} isLoading skeletonRows={8} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClassName,
  isLoading,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  isLoading?: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-1">
        {isLoading ? (
          <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
        ) : (
          <div className={cn("text-lg font-semibold tracking-tight", valueClassName)}>
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getErrorMessage(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Upload failed.";
}

function isPortfolioTotals(value: unknown): value is PortfolioTotals {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PortfolioTotals>;

  return (
    typeof candidate.totalValue === "number" &&
    typeof candidate.totalCost === "number" &&
    typeof candidate.totalGain === "number" &&
    typeof candidate.totalGainPct === "number"
  );
}

function isInsightResponse(value: unknown): value is InsightResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<InsightResponse>;

  return (
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.recommendations) &&
    Array.isArray(candidate.alerts) &&
    typeof candidate.generatedAt === "string"
  );
}

function isLatestSnapshotResponse(value: unknown): value is LatestSnapshotResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LatestSnapshotResponse>;

  return (
    typeof candidate.snapshotId === "string" &&
    isPortfolioTotals(candidate.totals) &&
    Array.isArray(candidate.holdings) &&
    (candidate.source === "kite" || candidate.source === "groww") &&
    typeof candidate.createdAt === "string"
  );
}
