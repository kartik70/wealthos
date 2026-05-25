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
import {
  ApiKeyPrompt,
  parseMissingApiKeyPayload,
  type MissingApiKey,
} from "@/components/ui/ApiKeyPrompt";
import { calcHealthScore } from "@/lib/finance/health";
import { classifySectorsSync } from "@/lib/finance/sector-map";
import { cn } from "@/lib/utils";
import type {
  DetailedInsightResponse,
  HealthScoreResult,
  Holding,
  InvestorRiskProfile,
  MFVerdict,
  PriorityAction,
  SectorAllocation,
  StockVerdict,
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

export default function InsightsPage() {
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [snapshotDate, setSnapshotDate] = useState<string>("");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [insight, setInsight] = useState<DetailedInsightResponse | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingApiKey, setMissingApiKey] = useState<MissingApiKey | null>(null);
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

  const sortedStockVerdicts = useMemo<StockVerdict[]>(() => {
    if (insight === null) return [];
    const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    return [...insight.stockVerdicts].sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        a.symbol.localeCompare(b.symbol),
    );
  }, [insight]);

  const sortedMFVerdicts = useMemo<MFVerdict[]>(() => {
    if (insight === null) return [];
    const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    return [...insight.mfVerdicts].sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        a.schemeName.localeCompare(b.schemeName),
    );
  }, [insight]);

  const sortedPriorityActions = useMemo<PriorityAction[]>(() => {
    return insight === null
      ? []
      : [...insight.priorityActions].sort((a, b) => a.rank - b.rank);
  }, [insight]);

  async function handleGenerateDeepAnalysis() {
    if (snapshotId === null) {
      setError("No snapshot found. Upload a portfolio first.");
      toast.error("No snapshot found. Upload a portfolio first.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setMissingApiKey(null);

    try {
      const response = await fetch("/api/insights/detailed", {
        method: "POST",
        headers: withAIProviderHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ snapshotId }),
      });

      const payload: unknown = await response.json();

      if (response.status === 402) {
        const missing = parseMissingApiKeyPayload(payload);
        if (missing !== null) {
          setMissingApiKey(missing);
          return;
        }
      }

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

  const sectorCommentaryMap = useMemo<Record<string, string>>(() => {
    if (insight === null) return {};
    const map: Record<string, string> = {};
    for (const entry of insight.equityStructure.sectorBreakdown) {
      map[entry.sector] = entry.commentary;
    }
    return map;
  }, [insight]);

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

      {missingApiKey !== null && (
        <div className="mb-8">
          <ApiKeyPrompt
            missingKey={missingApiKey}
            onDismiss={() => setMissingApiKey(null)}
          />
        </div>
      )}

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
          {/* 1. Portfolio Story */}
          {insight.portfolioStory && (
            <blockquote className="mb-12 border-l-4 border-primary pl-6 py-2 text-lg font-light leading-relaxed text-foreground">
              {insight.portfolioStory}
            </blockquote>
          )}

          {/* 2. Investor Profile */}
          <section className="mb-12">
            <SectionHeading label="Investor Profile" />
            <div className="flex flex-col gap-4">
              <div>
                <RiskProfileBadge profile={insight.investorProfile} />
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                {insight.investorProfileReasoning}
              </p>
            </div>
          </section>

          {/* 3. Health Score */}
          <section className="mb-12">
            <SectionHeading label="Health Score" />

            <div className="grid gap-12 lg:grid-cols-[200px_1fr]">
              <div className="flex items-center justify-center">
                <div className="relative size-40">
                  <svg viewBox="0 0 120 120" className="size-full">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
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

            <div className="mt-8 rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
              {insight.combinedAnalysis.healthScoreReasoning}
            </div>
          </section>

          {/* 4. Equity Structure */}
          <section className="mb-12">
            <SectionHeading label="Equity Structure" />

            {/* Stacked sector bar */}
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
              {hoveredSector && (() => {
                const hovered = sectors.find(s => s.sector === hoveredSector);
                if (!hovered) return null;
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

            {/* Sector commentary rows */}
            <div className="space-y-0 divide-y divide-border mb-8">
              {sectors.map((sector) => (
                <div
                  key={sector.sector}
                  className="border-l-4 py-4 pl-4"
                  style={{ borderLeftColor: sectorColors[sector.sector] || sectorColors["Other"] }}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <span className="font-semibold text-foreground">{sector.sector}</span>
                    <span className="font-mono text-sm text-muted-foreground">{percentFormatter.format(sector.allocationPct)}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {sectorCommentaryMap[sector.sector] ?? "No AI commentary available for this sector yet."}
                  </p>
                </div>
              ))}
            </div>

            {/* Structural commentary blocks */}
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <StructureBlock label="PSU vs Private" text={insight.equityStructure.psuVsPrivate} />
              <StructureBlock label="Cap Split" text={insight.equityStructure.capSplit} />
            </div>

            {insight.equityStructure.topRisks.length > 0 && (
              <div className="mb-6 rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">Top Risks</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                  {insight.equityStructure.topRisks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground block mb-2">Reinvestment Suggestion</span>
              {insight.equityStructure.reinvestmentSuggestion}
            </div>
          </section>

          {/* 5. Stock Verdicts */}
          <section className="mb-12">
            <SectionHeading label="Stock-by-Stock Analysis" />

            {sortedStockVerdicts.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No stock verdicts available.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead>Symbol</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Verdict</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Reasoning</TableHead>
                      <TableHead>Tax Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedStockVerdicts.map((entry, idx) => (
                      <TableRow key={entry.symbol} className={cn(idx % 2 === 0 ? "bg-muted/20" : "")}>
                        <TableCell className="font-mono font-medium">{entry.symbol}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.classification === "LONG_TERM_HOLD" ? "Long Term" : "Short Term"}
                        </TableCell>
                        <TableCell><StockVerdictBadge verdict={entry.verdict} /></TableCell>
                        <TableCell><PriorityBadge priority={entry.priority} /></TableCell>
                        <TableCell className="text-sm">{entry.reasoning}</TableCell>
                        <TableCell className="text-xs italic text-muted-foreground">
                          {entry.taxImplication ?? entry.ltcgNote ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* 6. MF Verdicts */}
          <section className="mb-12">
            <SectionHeading label="Mutual Fund Analysis" />

            {sortedMFVerdicts.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No mutual fund holdings to analyse.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead>Scheme</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Verdict</TableHead>
                      <TableHead>Switch To</TableHead>
                      <TableHead>Reasoning</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMFVerdicts.map((entry, idx) => (
                      <TableRow key={entry.schemeName} className={cn(idx % 2 === 0 ? "bg-muted/20" : "")}>
                        <TableCell className="font-medium text-sm">{entry.schemeName}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-xs font-mono px-2 py-0.5 rounded border",
                              entry.planType === "REGULAR"
                                ? "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30"
                                : entry.planType === "DIRECT"
                                  ? "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30"
                                  : "bg-muted text-muted-foreground border-border",
                            )}
                          >
                            {entry.planType}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{entry.category}</TableCell>
                        <TableCell><MFVerdictBadge verdict={entry.verdict} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{entry.switchTo ?? "—"}</TableCell>
                        <TableCell className="text-sm">{entry.reasoning}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* 7. MF Structure */}
          <section className="mb-12">
            <SectionHeading label="MF Structure" />

            {insight.mfStructure.assetAllocation.length > 0 && (
              <div className="mb-6 space-y-3">
                {insight.mfStructure.assetAllocation.map((entry) => (
                  <div key={entry.type} className="space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-foreground">{entry.type}</span>
                      <span className="font-mono text-sm text-muted-foreground">
                        {percentFormatter.format(entry.allocationPct)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/70"
                        style={{ width: `${Math.min(entry.allocationPct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <StructureBlock label="Allocation Health" text={insight.mfStructure.allocationHealthComment} />
              <StructureBlock label="AMC Concentration" text={insight.mfStructure.amcConcentration} />
              <StructureBlock label="Goal Alignment" text={insight.mfStructure.goalAlignment} />
            </div>
          </section>

          {/* 8. Combined Analysis */}
          <section className="mb-12">
            <SectionHeading label="Combined Analysis" />

            <div className="grid gap-4 md:grid-cols-2">
              <StructureBlock label="Equity vs MF Split" text={insight.combinedAnalysis.equityVsMFSplit} />
              <StructureBlock label="Sector Overlap" text={insight.combinedAnalysis.sectorOverlap} />
              <StructureBlock label="Complement or Duplicate" text={insight.combinedAnalysis.complementOrDuplicate} />
              <StructureBlock label="Health Score Reasoning" text={insight.combinedAnalysis.healthScoreReasoning} />
            </div>
          </section>

          {/* 9. Tax Optimisation */}
          <section className="mb-12">
            <SectionHeading label="Tax Optimisation" />

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4 pt-0">
                <div className="border-t-2 border-red-500 pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">ESTIMATED STCG</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {rupeeFormatter.format(insight.taxOptimisation.estimatedSTCG)}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 pt-0">
                <div className="border-t-2 border-amber-500 pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">ESTIMATED LTCG</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {rupeeFormatter.format(insight.taxOptimisation.estimatedLTCG)}
                  </p>
                </div>
              </div>
            </div>

            {insight.taxOptimisation.ltcgThresholdWarning && (
              <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                <strong>LTCG threshold warning:</strong> Realised long-term gains are approaching or exceeding the ₹1.25L tax-free limit this financial year.
              </div>
            )}

            {insight.taxOptimisation.harvestingOpportunities.length > 0 && (
              <div className="mb-6 rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead>Holding</TableHead>
                      <TableHead className="text-right">Unrealised Loss</TableHead>
                      <TableHead className="text-right">Tax Saving</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insight.taxOptimisation.harvestingOpportunities.map((opportunity, idx) => (
                      <TableRow key={opportunity.name} className={cn(idx % 2 === 0 ? "bg-muted/20" : "")}>
                        <TableCell className="font-mono font-medium">{opportunity.name}</TableCell>
                        <TableCell className="text-right text-[color:var(--loss)]">
                          {rupeeFormatter.format(opportunity.loss)}
                        </TableCell>
                        <TableCell className="text-right text-[color:var(--gain)]">
                          {rupeeFormatter.format(opportunity.taxSaving)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {insight.taxOptimisation.ltcgHoldSuggestions.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                  LTCG Hold Suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {insight.taxOptimisation.ltcgHoldSuggestions.map((suggestion) => (
                    <span
                      key={suggestion}
                      className="text-xs font-mono px-2 py-1 rounded bg-muted text-foreground border border-border"
                    >
                      {suggestion}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 10. Priority Action Plan */}
          <section className="mb-12">
            <SectionHeading label="Priority Action Plan" />

            {sortedPriorityActions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No priority actions defined.</p>
            ) : (
              <div className="space-y-0 divide-y divide-border">
                {sortedPriorityActions.map((plan) => (
                  <div key={`${plan.rank}-${plan.action}`} className="flex items-center gap-6 py-6">
                    <div className="flex-shrink-0">
                      <p className="font-mono text-4xl font-light text-muted-foreground/30">{plan.rank}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{plan.action}</p>
                      {plan.rupeesImpacted !== null && (
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          Impact: {rupeeFormatter.format(plan.rupeesImpacted)}
                        </p>
                      )}
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

function StructureBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

function RiskProfileBadge({ profile }: { profile: InvestorRiskProfile }) {
  const classes: Record<InvestorRiskProfile, string> = {
    AGGRESSIVE: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    MODERATE: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    CONSERVATIVE: "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
  };
  return (
    <Badge variant="secondary" className={cn("text-xs font-mono", classes[profile])}>
      {profile}
    </Badge>
  );
}

function StockVerdictBadge({ verdict }: { verdict: StockVerdict["verdict"] }) {
  const classes: Record<StockVerdict["verdict"], string> = {
    EXIT: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    HOLD_TRIM: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    BOOK_PROFIT_PARTIAL: "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
    BOOK_PROFIT_FULL: "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
    HOLD: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="secondary" className={cn("text-xs font-mono whitespace-nowrap", classes[verdict])}>
      {verdict.replace(/_/g, " ")}
    </Badge>
  );
}

function MFVerdictBadge({ verdict }: { verdict: MFVerdict["verdict"] }) {
  const classes: Record<MFVerdict["verdict"], string> = {
    EXIT: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    SWITCH: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    REDUCE_SIP: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    INCREASE_SIP: "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
    CONTINUE: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="secondary" className={cn("text-xs font-mono whitespace-nowrap", classes[verdict])}>
      {verdict.replace(/_/g, " ")}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: StockVerdict["priority"] }) {
  const classes: Record<StockVerdict["priority"], string> = {
    HIGH: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    MEDIUM: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    LOW: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="secondary" className={cn("text-xs", classes[priority])}>
      {priority}
    </Badge>
  );
}

function ImpactBadge({ impact }: { impact: PriorityAction["impact"] }) {
  const classes: Record<PriorityAction["impact"], string> = {
    HIGH: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    MEDIUM: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    LOW: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="secondary" className={cn("text-xs", classes[impact])}>
      {impact}
    </Badge>
  );
}

function UrgencyBadge({ urgency }: { urgency: PriorityAction["urgency"] }) {
  const classes: Record<PriorityAction["urgency"], string> = {
    URGENT: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    THIS_WEEK: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    THIS_MONTH: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="secondary" className={cn("text-xs", classes[urgency])}>
      {urgency.replace("_", " ")}
    </Badge>
  );
}
