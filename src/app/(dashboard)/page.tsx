"use client";

import { Upload } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Holding, PortfolioTotals } from "@/types/portfolio";

interface UploadResponse {
  snapshotId: string;
  totals: PortfolioTotals;
  holdings: Holding[];
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
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);

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
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Upload a portfolio CSV to create the latest snapshot.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_160px_auto] md:items-end"
      >
        <div className="grid gap-2">
          <Label htmlFor="portfolio-csv">CSV file</Label>
          <Input
            id="portfolio-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
            }}
          />
        </div>

        <div className="grid gap-2">
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

        <Button type="submit" disabled={isUploading}>
          <Upload className="size-4" aria-hidden="true" />
          {isUploading ? "Uploading" : "Upload"}
        </Button>
      </form>

      {error !== null && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {uploadResult !== null && (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Total Value"
            value={rupeeFormatter.format(uploadResult.totals.totalValue)}
          />
          <StatCard
            label="Total Gain/Loss"
            value={rupeeFormatter.format(uploadResult.totals.totalGain)}
            valueClassName={gainTone}
          />
          <StatCard
            label="Gain %"
            value={`${percentFormatter.format(uploadResult.totals.totalGainPct)}%`}
            valueClassName={gainTone}
          />
        </div>
      )}

      {hasHoldings && uploadResult !== null && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
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
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-semibold", valueClassName)}>{value}</div>
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
    typeof candidate.snapshotId === "string" &&
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
