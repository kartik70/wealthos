"use client";

import { Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { withAIProviderHeaders } from "@/lib/ai/provider";
import { calcHealthScore } from "@/lib/finance/health";
import { classifySectorsSync } from "@/lib/finance/sector-map";
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
  equity: {
    snapshotId: string;
    holdings: Holding[];
    createdAt: string;
  } | null;
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

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const sectorColors: Record<string, string> = {
  "Power": "#c4956a",
  "Financials": "#5b7fa6",
  "Metals": "#a07850",
  "Infrastructure": "#8b7fb5",
  "Consumer": "#7a9e7e",
  "Auto": "#9e7a7a",
  "ETFs": "#6ba3a3",
  "Technology": "#888888",
  "Other": "#888888",
};

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
  const [snapshotDate, setSnapshotDate] = useState<string>("");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [insight, setInsight] = useState<DetailedInsightResponse | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

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
          throw new Error("Failed to load portfolio");
        }

        const latest: LatestSnapshotResponse = await snapshotRes.json();
        if (latest.equity === null) {
          setSnapshotId(null);
          setHoldings([]);
          return;
        }

        setSnapshotId(latest.equity.snapshotId);
        setHoldings(latest.equity.holdings);
        setSnapshotDate(latest.equity.createdAt);

        const cachedRes = await fetch(
          `/api/insights/detailed?snapshotId=${encodeURIComponent(latest.equity.snapshotId)}`,
        );

        if (cachedRes.ok) {
          const cached: DetailedInsightApiResponse = await cachedRes.json();
          setInsight(cached.insight);
        } else if (cachedRes.status !== 404) {
          throw new Error("Failed to load deep analysis");
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Failed to load insights page";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoadingSnapshot(false);
      }
    }

    loadPageData();
  }, []);

  const healthScore = useMemo<HealthScoreResult>(() => calcHealthScore(holdings), [holdings]);
  const sectors = useMemo<SectorAllocation[]>(() => classifySectorsSync(holdings), [holdings]);
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
      toast.error("No snapshot found. Upload a portfolio first.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/insights/detailed", {
        method: "POST",
        headers: withAIProviderHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ snapshotId }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String(payload.error)
            : "Insight generation failed";
        throw new Error(message);
      }

      const data = payload as DetailedInsightApiResponse;
      setInsight(data.insight);
      toast.success("Deep analysis generated");
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Insight generation failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function openImportModal() {
    window.dispatchEvent(new Event("wealthos:open-import"));
  }

  const healthTone =
    healthScore.score >= 70
      ? "text-[color:var(--gain)]"
      : healthScore.score >= 40
        ? "text-amber-700"
        : "text-[color:var(--loss)]";

  const strokeColor =
    healthScore.score >= 70
      ? "#22c55e"
      : healthScore.score >= 40
        ? "#f59e0b"
        : "#ef4444";

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (healthScore.score / 100) * circumference;

  if (isLoadingSnapshot) {
    return (
      <div className="animate-in fade-in-0 duration-300 grid gap-4 py-2">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="h-64 w-full animate-pulse rounded bg-muted" />
        <div className="h-64 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (snapshotId === null) {
    return (
      <div className="animate-in fade-in-0 duration-300 flex flex-col gap-5 py-2">
        <div className="flex flex-col gap-1 border-b pb-4">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI-backed deep portfolio analysis</p>
        </div>

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
      </div>
    );
  }

  return (
    <div className="animate-in fade-in-0 duration-300 flex flex-col gap-0">
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex items-start justify-between gap-6">

          <div className="flex-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Insights</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Deterministic financial insights powered by AI interpretation
            </p>
          </div>
          <Button onClick={handleGenerateDeepAnalysis} disabled={isGenerating} size="sm">
            <Sparkles className="size-4" aria-hidden="true" />
            {isGenerating
              ? "Generating..."
              : insight === null
                ? "Generate Deep Analysis"
                : "Regenerate Deep Analysis"}
          </Button>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
          <span>Snapshot: {dateFormatter.format(new Date(snapshotDate))}</span>
        </div>
      </div>

      {error !== null && (
        <div className="mb-8 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {insight === null && (
        <Card className="mb-12 border border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-muted">
              <Sparkles className="size-7 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">No deep analysis yet</h2>
              <p className="text-sm text-muted-foreground">
                Generate your first deep report to see detailed recommendations.
              </p>
            </div>
            <Button onClick={handleGenerateDeepAnalysis} disabled={isGenerating}>
              <Sparkles className="size-4" aria-hidden="true" />
              {isGenerating ? "Generating..." : "Generate Deep Analysis"}
            </Button>
          </CardContent>
        </Card>
      )}

      {insight !== null && (
        <>

      {/* Portfolio Story */}
      {insight.portfolioStory && (
        <blockquote className="mb-12 border-l-4 border-primary pl-6 py-2 text-lg font-light leading-relaxed text-foreground">
          {insight.portfolioStory}
        </blockquote>
      )}

      {/* Health Score Section */}
      <section className="mb-12">
        <SectionHeading label={sectionOrder[0]} />

        <div className="grid gap-12 lg:grid-cols-[200px_1fr]">
          {/* Left: Large Score with Ring */}
          <div className="flex items-center justify-center">
            <div className="relative size-40">
              <svg viewBox="0 0 120 120" className="size-full">
                {/* Background circle */}
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                {/* Progress circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={progressOffset}
                  className="transition-all"
                  transform="rotate(-90 60 60)"
                />
                {/* Score text */}
                <text
                  x="60"
                  y="66"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="48"
                  fontWeight="300"
                  fontFamily="monospace"
                  fill="currentColor"
                  className={healthTone}
                >
                  {healthScore.score}
                </text>
              </svg>
            </div>
          </div>

          {/* Right: Breakdown Bars */}
          <div className="space-y-6">
            {[
              { label: "Concentration", value: healthScore.breakdown.concentration },
              { label: "Diversification", value: healthScore.breakdown.diversification },
              { label: "Loss Ratio", value: healthScore.breakdown.lossRatio },
              { label: "Sector Balance", value: healthScore.breakdown.sectorBalance },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
                  <span className="font-mono text-sm text-foreground">{value}</span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground/70" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commentary */}
        <div className="mt-8 rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
          {insight.healthcommentary ??
            "Generate report to see AI insights on portfolio health drivers and improvement opportunities."}
        </div>
      </section>

      {/* Sector Allocation Section */}
      <section className="mb-12">
        <SectionHeading label={sectionOrder[1]} />

        {/* Stacked Bar */}
        <div className="mb-8 relative">
          <div className="flex h-8 w-full overflow-hidden rounded-full bg-muted relative z-0">
            {sectors.map((sector) => (
              <div
                key={sector.sector}
                className="h-full border-r border-background/30 last:border-r-0 relative group cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  width: `${sector.allocationPct}%`,
                  backgroundColor: sectorColors[sector.sector] || sectorColors["Other"],
                }}
                onMouseEnter={() => setHoveredSector(sector.sector)}
                onMouseLeave={() => setHoveredSector(null)}
              />
            ))}
          </div>
          {/* Tooltip rendered above bar, not clipped */}
          {hoveredSector && (() => {
            const hovered = sectors.find(s => s.sector === hoveredSector);
            if (!hovered) return null;
            // Calculate left offset for tooltip center
            let left = 0;
            for (const s of sectors) {
              if (s.sector === hoveredSector) {
                left += (s.allocationPct / 2);
                break;
              }
              left += s.allocationPct;
            }
            return (
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  left: `calc(${left}% )`,
                  top: '-0.5rem',
                  transform: 'translateX(-50%) translateY(-100%)',
                }}
              >
                <div className="px-3 py-1.5 bg-foreground text-background text-xs font-mono rounded whitespace-nowrap shadow-lg">
                  {hovered.sector}: {percentFormatter.format(hovered.allocationPct)}%
                </div>
              </div>
            );
          })()}
        </div>

        {/* Sector Rows */}
        <div className="space-y-0 divide-y divide-border">
          {sectors.map((sector) => (
            <div key={sector.sector} className="border-l-4 py-4 pl-4" style={{ borderLeftColor: `var(--${getSectorColorVariable(sector.sector)})` }}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <span className="font-semibold text-foreground">{sector.sector}</span>
                <span className="font-mono text-sm text-muted-foreground">{percentFormatter.format(sector.allocationPct)}%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {insight.sectorCommentary?.[sector.sector] ?? "No AI commentary available for this sector yet."}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Action Plan Section */}
      <section className="mb-12">
        <SectionHeading label={sectionOrder[2]} />

        {sortedActionPlan.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Generate report to receive AI-prioritized action items.</p>
        ) : (
          <div className="space-y-0 divide-y divide-border">
            {sortedActionPlan.map((plan) => (
              <div key={`${plan.priority}-${plan.action}`} className="flex items-center gap-6 border-b py-6 last:border-b-0">
                <div className="flex-shrink-0">
                  <p className="font-mono text-4xl font-light text-muted-foreground/30">{plan.priority}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{plan.action}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <ImpactBadge impact={plan.impact} />
                  <UrgencyBadge urgency={plan.urgency} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Stock Analysis Section */}
      <section className="mb-12">
        <SectionHeading label={sectionOrder[3]} />

        {sortedStockAnalysis.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Generate report to see stock-level analysis and verdicts.</p>
        ) : (
          <div className="space-y-0 divide-y divide-border">
            {sortedStockAnalysis.map((entry, idx) => (
              <div
                key={entry.symbol}
                className={cn("flex items-start gap-4 py-4", idx % 2 === 0 ? "bg-muted/20" : "")}
              >
                <span className="w-20 font-mono font-medium text-foreground flex-shrink-0">{entry.symbol}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <VerdictBadge verdict={entry.verdict} />
                </div>
                <p className="flex-1 text-sm text-muted-foreground">{entry.reasoning}</p>
                <p className="text-xs text-muted-foreground italic flex-shrink-0 max-w-xs text-right">{entry.taxNote}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tax Summary Section */}
      <section className="mb-12">
        <SectionHeading label={sectionOrder[4]} />

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 pt-0">
            <div className="border-t-2 border-red-500 pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">ESTIMATED STCG LIABILITY</p>
              <p className="text-2xl font-semibold text-foreground">{rupeeFormatter.format(taxSummary.estimatedSTCG)}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 pt-0">
            <div className="border-t-2 border-amber-500 pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">ESTIMATED LTCG LIABILITY</p>
              <p className="text-2xl font-semibold text-foreground">{rupeeFormatter.format(taxSummary.estimatedLTCG)}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 pt-0">
            <div className="border-t-2 border-green-500 pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">HARVESTING OPPORTUNITIES</p>
              <p className="text-2xl font-semibold text-foreground">{taxSummary.harvestingOpportunities.length}</p>
            </div>
          </div>
        </div>

        {/* Harvesting Table */}
        {taxSummary.harvestingOpportunities.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border">
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Unrealised Loss</TableHead>
                  <TableHead className="text-right">Potential Tax Saving</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxSummary.harvestingOpportunities.map((opportunity, idx) => (
                  <TableRow key={opportunity.symbol} className={cn(idx % 2 === 0 ? "bg-muted/20" : "")}>
                    <TableCell className="font-mono font-medium">{opportunity.symbol}</TableCell>
                    <TableCell className="text-right text-[color:var(--loss)]">{rupeeFormatter.format(opportunity.loss)}</TableCell>
                    <TableCell className="text-right text-[color:var(--gain)]">
                      {rupeeFormatter.format(opportunity.saving)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Risk Profile Section */}
      <section className="mb-12">
        <SectionHeading label={sectionOrder[5]} />

        <blockquote className="rounded-xl border border-border bg-muted/40 p-8 text-base font-light leading-relaxed italic text-foreground">
          {insight.riskProfile ?? "Generate report to understand the investor profile reflected by this portfolio."}
        </blockquote>
      </section>
      </>
      )}
    </div>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function getSectorColorVariable(sector: string): string {
  const colorMap: Record<string, string> = {
    "Power": "yellow-400",
    "Financials": "blue-500",
    "Metals": "slate-500",
    "Infrastructure": "purple-500",
    "Consumer": "green-500",
    "Auto": "red-500",
    "ETFs": "cyan-500",
    "Technology": "violet-500",
    "Other": "gray-400",
  };
  return colorMap[sector] || colorMap["Other"];
}

function VerdictBadge({ verdict }: { verdict: DetailedStockAnalysis["verdict"] }) {
  const classes: Record<DetailedStockAnalysis["verdict"], string> = {
    EXIT: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    AVERAGE_DOWN: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    BOOK_PROFIT: "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
    HOLD: "bg-[color:var(--surface-raised)] text-[color:var(--text-secondary)] border-border",
  };

  return (
    <Badge variant="secondary" className={cn("text-xs font-mono", classes[verdict])}>
      {verdict}
    </Badge>
  );
}

function ImpactBadge({ impact }: { impact: DetailedActionPlan["impact"] }) {
  const classes: Record<DetailedActionPlan["impact"], string> = {
    HIGH: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    MEDIUM: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    LOW: "bg-[color:var(--surface-raised)] text-[color:var(--text-secondary)] border-border",
  };

  return (
    <Badge variant="secondary" className={cn("text-xs", classes[impact])}>
      {impact}
    </Badge>
  );
}

function UrgencyBadge({ urgency }: { urgency: DetailedActionPlan["urgency"] }) {
  const classes: Record<DetailedActionPlan["urgency"], string> = {
    NOW: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    THIS_MONTH: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    THIS_QUARTER: "bg-[color:var(--surface-raised)] text-[color:var(--text-secondary)] border-border",
  };

  return (
    <Badge variant="secondary" className={cn("text-xs", classes[urgency])}>
      {urgency.replace("_", " ")}
    </Badge>
  );
}
