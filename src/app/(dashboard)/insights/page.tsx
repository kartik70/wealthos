"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calcHealthScore } from "@/lib/finance/health";
import { classifySectors } from "@/lib/finance/sectors";
import { calcTaxSummary } from "@/lib/finance/tax";
import { cn } from "@/lib/utils";
import type {
  DetailedActionPlan,
  DetailedInsightResponse,
  DetailedStockAnalysis,
  Holding,
  HealthScoreResult,
  SectorAllocation,
  TaxSummary,
} from "@/types/portfolio";

interface LatestSnapshotResponse {
  snapshotId: string;
  holdings: Holding[];
  createdAt: string;
}

interface DetailedInsightApiResponse {
  snapshotId: string;
  insight: DetailedInsightResponse;
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

const sectionOrder = [
  "Health Score",
  "Sector Allocation",
  "Action Plan",
  "Stock Analysis",
  "Tax Summary",
  "Risk Profile",
] as const;

export default function InsightsPage() {
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [insight, setInsight] = useState<DetailedInsightResponse | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPageData() {
      setIsLoadingSnapshot(true);
      setError(null);

      try {
        const snapshotRes = await fetch("/api/snapshots/latest");
        if (!snapshotRes.ok) {
          if (snapshotRes.status === 404) {
            setSnapshotId(null);
            setHoldings([]);
            return;
          }
          throw new Error("Failed to load latest snapshot");
        }

        const latest: LatestSnapshotResponse = await snapshotRes.json();
        setSnapshotId(latest.snapshotId);
        setHoldings(latest.holdings);

        const cachedRes = await fetch(
          `/api/insights/detailed?snapshotId=${encodeURIComponent(latest.snapshotId)}`,
        );

        if (cachedRes.ok) {
          const cached: DetailedInsightApiResponse = await cachedRes.json();
          setInsight(cached.insight);
        } else if (cachedRes.status !== 404) {
          throw new Error("Failed to load cached deep analysis");
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load insights page");
      } finally {
        setIsLoadingSnapshot(false);
      }
    }

    loadPageData();
  }, []);

  const healthScore = useMemo<HealthScoreResult>(() => calcHealthScore(holdings), [holdings]);
  const sectors = useMemo<SectorAllocation[]>(() => classifySectors(holdings), [holdings]);
  const taxSummary = useMemo<TaxSummary>(() => calcTaxSummary(holdings), [holdings]);

  const sortedActionPlan = useMemo<DetailedActionPlan[]>(() => {
    return insight ? [...insight.actionPlan].sort((left, right) => left.priority - right.priority) : [];
  }, [insight]);

  const sortedStockAnalysis = useMemo<DetailedStockAnalysis[]>(() => {
    return insight
      ? [...insight.stockAnalysis].sort((left, right) => left.symbol.localeCompare(right.symbol))
      : [];
  }, [insight]);

  async function handleGenerateDeepAnalysis() {
    if (snapshotId === null) {
      setError("No snapshot found. Upload a portfolio first.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/insights/detailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof payload === "object" && payload !== null && "error" in payload
            ? String(payload.error)
            : "Failed to generate deep analysis",
        );
      }

      const data = payload as DetailedInsightApiResponse;
      setInsight(data.insight);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate deep analysis",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  const healthTone =
    healthScore.score >= 70
      ? "text-emerald-700"
      : healthScore.score >= 40
        ? "text-amber-700"
        : "text-red-700";

  const circleTone =
    healthScore.score >= 70
      ? "stroke-emerald-600"
      : healthScore.score >= 40
        ? "stroke-amber-500"
        : "stroke-red-600";

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (healthScore.score / 100) * circumference;

  if (isLoadingSnapshot) {
    return <div className="py-12 text-sm text-muted-foreground">Loading insights...</div>;
  }

  if (snapshotId === null) {
    return (
      <div className="flex flex-col gap-3 py-10">
        <h1 className="font-heading text-2xl font-semibold">Insights</h1>
        <p className="text-sm text-muted-foreground">No snapshot found yet. Upload a portfolio to generate insights.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">Deep AI analysis powered by deterministic portfolio metrics</p>
        </div>
        <Button onClick={handleGenerateDeepAnalysis} disabled={isGenerating}>
          <Sparkles className="size-4" aria-hidden="true" />
          {isGenerating ? "Claude is thinking..." : "Generate Deep Analysis"}
        </Button>
      </div>

      {error !== null && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {insight?.portfolioStory && (
        <Card>
          <CardContent className="pt-4 text-sm leading-relaxed text-muted-foreground">
            {insight.portfolioStory}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <SectionTitle label={sectionOrder[0]} />
        <Card>
          <CardContent className="grid gap-5 pt-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex items-center justify-center">
              <div className="relative size-36">
                <svg viewBox="0 0 140 140" className="size-full -rotate-90">
                  <circle cx="70" cy="70" r={radius} className="fill-none stroke-muted" strokeWidth="10" />
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    className={cn("fill-none transition-all", circleTone)}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={progressOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className={cn("text-4xl font-semibold", healthTone)}>{healthScore.score}</p>
                  <p className="text-xs text-muted-foreground">/ 100</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <BreakdownBar label="Concentration" value={healthScore.breakdown.concentration} />
              <BreakdownBar label="Diversification" value={healthScore.breakdown.diversification} />
              <BreakdownBar label="Loss Ratio" value={healthScore.breakdown.lossRatio} />
              <BreakdownBar label="Sector Balance" value={healthScore.breakdown.sectorBalance} />
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {insight?.healthcommentary ??
                  "Generate deep analysis to get AI commentary on what is pulling the health score down and improvement paths."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle label={sectionOrder[1]} />
        <Card>
          <CardHeader>
            <CardTitle>Sector Mix</CardTitle>
            <CardDescription>Allocation distribution across sectors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
              {sectors.map((sector) => (
                <div
                  key={sector.sector}
                  className="h-full border-r border-background/50 bg-foreground/70 last:border-r-0"
                  style={{ width: `${sector.allocationPct}%` }}
                />
              ))}
            </div>

            <div className="space-y-2">
              {sectors.map((sector) => (
                <div key={sector.sector} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{sector.sector}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {percentFormatter.format(sector.allocationPct)}%
                    </div>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {insight?.sectorCommentary?.[sector.sector] ?? "No AI commentary yet for this sector."}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle label={sectionOrder[2]} />
        <div className="grid gap-3 md:grid-cols-2">
          {sortedActionPlan.length === 0 ? (
            <Card>
              <CardContent className="pt-4 text-sm text-muted-foreground">
                Generate deep analysis to receive prioritized actions.
              </CardContent>
            </Card>
          ) : (
            sortedActionPlan.map((plan) => (
              <Card key={`${plan.priority}-${plan.action}`}>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Priority {plan.priority}</div>
                    <div className="flex items-center gap-2">
                      <ImpactBadge impact={plan.impact} />
                      <UrgencyBadge urgency={plan.urgency} />
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{plan.action}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle label={sectionOrder[3]} />
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Reasoning</TableHead>
                  <TableHead>Tax Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStockAnalysis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Generate deep analysis to view stock-level verdicts.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedStockAnalysis.map((entry) => (
                    <TableRow key={entry.symbol}>
                      <TableCell className="font-mono font-medium">{entry.symbol}</TableCell>
                      <TableCell>
                        <VerdictBadge verdict={entry.verdict} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.reasoning}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.taxNote}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle label={sectionOrder[4]} />
        <div className="grid gap-3 md:grid-cols-3">
          <TaxCard label="Estimated STCG Liability" value={rupeeFormatter.format(taxSummary.estimatedSTCG)} />
          <TaxCard label="Estimated LTCG Liability" value={rupeeFormatter.format(taxSummary.estimatedLTCG)} />
          <TaxCard
            label="Harvesting Opportunities"
            value={String(taxSummary.harvestingOpportunities.length)}
          />
        </div>

        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Unrealised Loss</TableHead>
                  <TableHead className="text-right">Potential Tax Saving</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxSummary.harvestingOpportunities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No harvesting opportunities right now.
                    </TableCell>
                  </TableRow>
                ) : (
                  taxSummary.harvestingOpportunities.map((opportunity) => (
                    <TableRow key={opportunity.symbol}>
                      <TableCell className="font-mono font-medium">{opportunity.symbol}</TableCell>
                      <TableCell className="text-right text-red-700">
                        {rupeeFormatter.format(opportunity.loss)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-700">
                        {rupeeFormatter.format(opportunity.saving)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle label={sectionOrder[5]} />
        <Card>
          <CardContent className="pt-4 text-sm leading-relaxed text-muted-foreground">
            {insight?.riskProfile ??
              "Generate deep analysis to see what type of investor this portfolio currently reflects."}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <h2 className="text-base font-semibold tracking-tight">{label}</h2>;
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: DetailedStockAnalysis["verdict"] }) {
  const classes: Record<DetailedStockAnalysis["verdict"], string> = {
    EXIT: "bg-red-100 text-red-700",
    AVERAGE_DOWN: "bg-amber-100 text-amber-700",
    BOOK_PROFIT: "bg-emerald-100 text-emerald-700",
    HOLD: "bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="secondary" className={cn("text-xs", classes[verdict])}>
      {verdict}
    </Badge>
  );
}

function ImpactBadge({ impact }: { impact: DetailedActionPlan["impact"] }) {
  const classes: Record<DetailedActionPlan["impact"], string> = {
    HIGH: "bg-red-100 text-red-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="secondary" className={cn("text-xs", classes[impact])}>
      {impact}
    </Badge>
  );
}

function UrgencyBadge({ urgency }: { urgency: DetailedActionPlan["urgency"] }) {
  const classes: Record<DetailedActionPlan["urgency"], string> = {
    NOW: "bg-red-100 text-red-700",
    THIS_MONTH: "bg-amber-100 text-amber-700",
    THIS_QUARTER: "bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="secondary" className={cn("text-xs", classes[urgency])}>
      {urgency.replace("_", " ")}
    </Badge>
  );
}

function TaxCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
