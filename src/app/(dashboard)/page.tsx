"use client";

import { Upload, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Holding, PortfolioTotals, InsightResponse } from "@/types/portfolio";

interface UploadResponse {
  snapshotId: string | null;
  totals: PortfolioTotals;
  holdings: Holding[];
  persisted?: boolean;
  warning?: string;
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
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"kite" | "groww">("kite");
  const [reportDate, setReportDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [snapshotSource, setSnapshotSource] = useState<"kite" | "groww">("kite");
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  // Fetch the latest snapshot on component mount
  useEffect(() => {
    async function fetchLatestSnapshot() {
      try {
        const response = await fetch("/api/snapshots/latest");
        if (response.ok) {
          const data: LatestSnapshotResponse = await response.json();
          setUploadResult({
            snapshotId: data.snapshotId,
            totals: data.totals,
            holdings: data.holdings,
            persisted: true,
          });
          setSnapshotSource(data.source);
          setSource(data.source);
          // If a saved insight exists for this snapshot, display it immediately
          if (data.insight) {
            setInsight(data.insight);
          }
        }
        // If no snapshot exists (404), that's fine - show empty state
      } catch (err) {
        console.error("Failed to fetch latest snapshot:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLatestSnapshot();
  }, []);

  const totals = uploadResult?.totals;
  const hasHoldings = uploadResult !== null && uploadResult.holdings.length > 0;
  const gainTone = useMemo(() => {
    if (uploadResult === null) {
      return "text-foreground";
    }

    return uploadResult.totals.totalGain >= 0 ? "text-emerald-700" : "text-red-700";
  }, [uploadResult]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (file === null) {
      setError("Select a CSV file before uploading.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setWarning(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);
    formData.append("reportDate", reportDate);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(payload));
        return;
      }

      if (!isUploadResponse(payload)) {
        setError("Upload succeeded, but the response was not in the expected shape.");
        return;
      }

      setUploadResult(payload);
      setWarning(payload.warning ?? null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleGenerateInsights() {
    if (uploadResult?.snapshotId === null || uploadResult?.snapshotId === undefined) {
      setInsightError("No snapshot available. Please upload a CSV first.");
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
        return;
      }

      if (!isInsightResponse(payload)) {
        setInsightError("Invalid insight response format");
        return;
      }

      setInsight(payload);
    } catch (err) {
      setInsightError(
        err instanceof Error ? err.message : "Failed to generate insights",
      );
    } finally {
      setIsGeneratingInsight(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Portfolio snapshot</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Value"
          value={totals === undefined ? "--" : rupeeFormatter.format(totals.totalValue)}
        />
        <StatCard
          label="Total Gain/Loss"
          value={totals === undefined ? "--" : rupeeFormatter.format(totals.totalGain)}
          valueClassName={totals === undefined ? undefined : gainTone}
        />
        <StatCard
          label="Gain %"
          value={
            totals === undefined
              ? "--"
              : `${percentFormatter.format(totals.totalGainPct)}%`
          }
          valueClassName={totals === undefined ? undefined : gainTone}
        />
      </div>

      {/* AI Insights Section - moved to top */}
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
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>Kite CSV snapshot import</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="portfolio-csv">CSV file</Label>
                <Input
                  id="portfolio-csv"
                  type="file"
                  accept=".csv,text/csv"
                  className="file:mr-3 file:rounded-md file:bg-muted file:px-2"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                  }}
                />
              </div>

              <div className="grid gap-2 sm:max-w-48">
                <Label htmlFor="source">Source</Label>
                <select
                  id="source"
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value === "groww" ? "groww" : "kite");
                  }}
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="kite">Kite</option>
                  <option value="groww">Groww</option>
                </select>
              </div>

              <div className="grid gap-2 sm:max-w-48">
                <Label htmlFor="report-date">Report date</Label>
                <Input
                  id="report-date"
                  type="date"
                  value={reportDate}
                  onChange={(event) => {
                    setReportDate(event.target.value);
                  }}
                  className="h-8"
                />
              </div>

              <div>
                <Button type="submit" disabled={isUploading}>
                  <Upload className="size-4" aria-hidden="true" />
                  {isUploading ? "Uploading" : "Upload"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

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

      {error !== null && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {warning !== null && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </div>
      )}

      {!isLoading && uploadResult === null && (
        <Card className="border border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="text-center">
              <h3 className="font-semibold">No portfolio data yet</h3>
              <p className="text-sm text-muted-foreground">
                Upload your first CSV file to get started
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasHoldings && uploadResult !== null && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingsTable holdings={uploadResult.holdings} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationChart holdings={uploadResult.holdings} />
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
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-semibold tracking-tight", valueClassName)}>
          {value}
        </div>
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

function isUploadResponse(value: unknown): value is UploadResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<UploadResponse>;

  return (
    (typeof candidate.snapshotId === "string" || candidate.snapshotId === null) &&
    isPortfolioTotals(candidate.totals) &&
    Array.isArray(candidate.holdings)
  );
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
