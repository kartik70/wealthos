"use client";

import { Upload, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { MutualFundHoldingsTable } from "@/components/portfolio/MutualFundHoldingsTable";
import { InsightCard } from "@/components/insights/InsightCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { withAIProviderHeaders } from "@/lib/ai/provider";
import type { CombinedPortfolioResult } from "@/lib/finance/combined";
import { cn } from "@/lib/utils";
import type {
  Holding,
  InsightResponse,
  MutualFundHolding,
  MutualFundTotals,
  PortfolioTotals,
} from "@/types/portfolio";

interface LatestEquitySnapshot {
  snapshotId: string;
  totals: PortfolioTotals;
  holdings: Holding[];
  source: "kite" | "groww";
  createdAt: string;
  insight?: InsightResponse;
}

interface LatestMutualFundSnapshot {
  snapshotId: string;
  snapshotDate: string;
  totals: MutualFundTotals;
  holdings: MutualFundHolding[];
  createdAt: string;
}

interface LatestSnapshotResponse {
  equity: LatestEquitySnapshot | null;
  mutualFund: LatestMutualFundSnapshot | null;
  combined: CombinedPortfolioResult | null;
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
  const [equitySnapshot, setEquitySnapshot] = useState<LatestEquitySnapshot | null>(null);
  const [mutualFundSnapshot, setMutualFundSnapshot] =
    useState<LatestMutualFundSnapshot | null>(null);
  const [combinedPortfolio, setCombinedPortfolio] =
    useState<CombinedPortfolioResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const fetchLatestSnapshot = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/snapshots/latest");

      if (response.status === 404) {
        setEquitySnapshot(null);
        setMutualFundSnapshot(null);
        setCombinedPortfolio(null);
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

      setEquitySnapshot(payload.equity);
      setMutualFundSnapshot(payload.mutualFund);
      setCombinedPortfolio(payload.combined);
      setInsight(payload.equity?.insight ?? null);
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

  const equityTotals = equitySnapshot?.totals;
  const mfTotals = mutualFundSnapshot?.totals;
  const hasEquityHoldings =
    equitySnapshot !== null && equitySnapshot.holdings.length > 0;
  const hasMutualFundHoldings =
    mutualFundSnapshot !== null && mutualFundSnapshot.holdings.length > 0;
  const hasAnyHoldings = hasEquityHoldings || hasMutualFundHoldings;

  const equityGainTone = useMemo(() => {
    if (equityTotals === undefined) {
      return "text-foreground";
    }

    return equityTotals.totalGain >= 0 ? "text-[color:var(--gain)]" : "text-[color:var(--loss)]";
  }, [equityTotals]);

  const mfGainTone = useMemo(() => {
    if (mfTotals === undefined) {
      return "text-foreground";
    }

    return mfTotals.totalReturns >= 0 ? "text-[color:var(--gain)]" : "text-[color:var(--loss)]";
  }, [mfTotals]);

  const totalReturnsTone = useMemo(() => {
    if (combinedPortfolio === null) {
      return "text-foreground";
    }

    return combinedPortfolio.totalReturns >= 0 ? "text-[color:var(--gain)]" : "text-[color:var(--loss)]";
  }, [combinedPortfolio]);

  async function handleGenerateInsights() {
    if (equitySnapshot?.snapshotId === null || equitySnapshot?.snapshotId === undefined) {
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
        headers: withAIProviderHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ snapshotId: equitySnapshot.snapshotId }),
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

  const showEmptyState = !isLoading && !hasAnyHoldings;

  return (
    <div className="animate-in fade-in-0 duration-300 flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Portfolio snapshot</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Combined Value"
          value={
            combinedPortfolio === null
              ? "--"
              : rupeeFormatter.format(combinedPortfolio.totalValue)
          }
          isLoading={isLoading}
        />
        <StatCard
          label="Equity Value"
          value={
            equityTotals === undefined
              ? "--"
              : rupeeFormatter.format(equityTotals.totalValue)
          }
          isLoading={isLoading}
        />
        <StatCard
          label="MF Value"
          value={
            mfTotals === undefined
              ? "--"
              : rupeeFormatter.format(mfTotals.totalCurrentValue)
          }
          isLoading={isLoading}
        />
        <StatCard
          label="Total Returns"
          value={
            combinedPortfolio === null
              ? "--"
              : rupeeFormatter.format(combinedPortfolio.totalReturns)
          }
          valueClassName={combinedPortfolio === null ? undefined : totalReturnsTone}
          isLoading={isLoading}
        />
        <StatCard
          label="Equity Gain %"
          value={
            equityTotals === undefined
              ? "--"
              : `${percentFormatter.format(equityTotals.totalGainPct)}%`
          }
          valueClassName={equityTotals === undefined ? undefined : equityGainTone}
          isLoading={isLoading}
        />
        <StatCard
          label="MF Returns %"
          value={
            mfTotals === undefined
              ? "--"
              : `${percentFormatter.format(mfTotals.totalReturnsPct)}%`
          }
          valueClassName={mfTotals === undefined ? undefined : mfGainTone}
          isLoading={isLoading}
        />
      </div>

      {showEmptyState && (
        <div className="grid gap-4">
          <Card className="border border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="grid size-14 place-items-center rounded-full bg-muted">
                <Upload className="size-7 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight">No portfolio imported</h3>
                <p className="text-sm text-muted-foreground">
                  Import Kite equity holdings or Groww mutual fund holdings to start tracking.
                </p>
              </div>
              <Button onClick={openImportModal}>Import Portfolio</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {hasEquityHoldings && equitySnapshot !== null && (
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
              hasHoldings={hasEquityHoldings}
            />
            {insightError !== null && (
              <p className="mt-3 text-sm text-destructive">{insightError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {hasAnyHoldings && !isLoading && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={hasEquityHoldings ? "equity" : "mutual-funds"}>
                <TabsList>
                  {hasEquityHoldings ? (
                    <TabsTrigger value="equity">Equity</TabsTrigger>
                  ) : null}
                  {hasMutualFundHoldings ? (
                    <TabsTrigger value="mutual-funds">Mutual funds</TabsTrigger>
                  ) : null}
                </TabsList>
                {hasEquityHoldings && equitySnapshot !== null ? (
                  <TabsContent value="equity" className="mt-4">
                    <HoldingsTable holdings={equitySnapshot.holdings} />
                  </TabsContent>
                ) : null}
                {hasMutualFundHoldings && mutualFundSnapshot !== null ? (
                  <TabsContent value="mutual-funds" className="mt-4">
                    <MutualFundHoldingsTable holdings={mutualFundSnapshot.holdings} />
                  </TabsContent>
                ) : null}
              </Tabs>
            </CardContent>
          </Card>

          {hasEquityHoldings && equitySnapshot !== null ? (
            <Card>
              <CardHeader>
                <CardTitle>Equity allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationChart holdings={equitySnapshot.holdings} />
              </CardContent>
            </Card>
          ) : null}
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
              <CardTitle>Equity allocation</CardTitle>
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
  // Subtle top accent: emerald if positive value text, rose if negative, otherwise transparent.
  const accentTop =
    valueClassName === undefined
      ? "transparent"
      : valueClassName.includes("--gain")
        ? "var(--gain)"
        : valueClassName.includes("--loss")
          ? "var(--loss)"
          : "transparent";

  return (
    <div
      className="flex flex-col gap-2 rounded-xl px-4 py-3.5"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderTop: `2px solid ${accentTop === "transparent" ? "var(--border)" : accentTop}`,
      }}
    >
      <span
        className="text-[10px] font-medium uppercase tracking-[0.18em]"
        style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-display)" }}
      >
        {label}
      </span>
      {isLoading ? (
        <div
          className="h-7 w-2/3 animate-pulse rounded"
          style={{ background: "var(--surface)" }}
        />
      ) : (
        <div
          className={cn(
            "font-mono text-2xl",
            valueClassName ?? "text-[color:var(--text-primary)]",
          )}
          style={{ fontWeight: 500 }}
        >
          {value}
        </div>
      )}
    </div>
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

  const equityValid =
    candidate.equity === null ||
    candidate.equity === undefined ||
    (typeof candidate.equity.snapshotId === "string" &&
      isPortfolioTotals(candidate.equity.totals) &&
      Array.isArray(candidate.equity.holdings) &&
      (candidate.equity.source === "kite" || candidate.equity.source === "groww") &&
      typeof candidate.equity.createdAt === "string");

  const mutualFundValid =
    candidate.mutualFund === null ||
    candidate.mutualFund === undefined ||
    (typeof candidate.mutualFund.snapshotId === "string" &&
      typeof candidate.mutualFund.snapshotDate === "string" &&
      Array.isArray(candidate.mutualFund.holdings) &&
      typeof candidate.mutualFund.createdAt === "string");

  return equityValid && mutualFundValid;
}
