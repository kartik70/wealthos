"use client";

import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  InsightResponse,
  InvestorRiskProfile,
  MFVerdict,
  PriorityAction,
  StockVerdict,
} from "@/types/portfolio";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  insight: InsightResponse | null;
  onGenerateInsights: () => void;
  isGenerating: boolean;
  hasHoldings: boolean;
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function InsightCard({
  insight,
  onGenerateInsights,
  isGenerating,
  hasHoldings,
}: InsightCardProps) {
  const generatedLabel = formatGeneratedAt(insight?.generatedAt);

  if (isGenerating && insight === null) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-10/12 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (insight === null) {
    if (!hasHoldings) {
      return null;
    }

    return (
      <div
        className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-xl py-14 text-center"
        style={{
          backgroundImage:
            "linear-gradient(#1e2d40 1px, transparent 1px), linear-gradient(90deg, #1e2d40 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          backgroundPosition: "center center",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, #111827 75%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <p className="text-sm" style={{ color: "#4a5568" }}>
            <span className="mr-1.5" style={{ color: "#3b82f6" }}>
              ✦
            </span>
            No insights yet
          </p>
          <button
            type="button"
            onClick={onGenerateInsights}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "#3b82f6" }}
          >
            Generate insights
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header: Risk Profile + Summary */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Investor risk profile
          </span>
          <RiskProfileBadge profile={insight.investorRiskProfile} />
        </div>
        <p className="text-sm leading-relaxed text-foreground">{insight.summary}</p>
      </div>

      {/* Stock Verdicts */}
      {insight.stockVerdicts.length > 0 && (
        <section className="space-y-3">
          <SectionLabel label="Equity verdicts" />
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="min-w-[260px]">Reasoning</TableHead>
                  <TableHead className="min-w-[220px]">LTCG note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insight.stockVerdicts.map((entry) => (
                  <TableRow key={`${entry.symbol}-${entry.verdict}`}>
                    <TableCell className="font-mono font-medium text-foreground">
                      {entry.symbol}
                    </TableCell>
                    <TableCell>
                      <ClassificationBadge classification={entry.classification} />
                    </TableCell>
                    <TableCell>
                      <StockVerdictBadge verdict={entry.verdict} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={entry.priority} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.reasoning}
                      {entry.taxImplication ? (
                        <div className="mt-1 text-xs text-muted-foreground/80">
                          {entry.taxImplication}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.ltcgNote ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* MF Verdicts */}
      {insight.mfVerdicts.length > 0 && (
        <section className="space-y-3">
          <SectionLabel label="Mutual fund verdicts" />
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Fund</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="min-w-[240px]">Reasoning</TableHead>
                  <TableHead className="min-w-[220px]">Switch to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insight.mfVerdicts.map((entry, index) => (
                  <TableRow key={`${entry.schemeName}-${index}`}>
                    <TableCell className="text-sm text-foreground">
                      {entry.schemeName}
                    </TableCell>
                    <TableCell>
                      <PlanTypeBadge planType={entry.planType} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {entry.category}
                    </TableCell>
                    <TableCell>
                      <MFVerdictBadge verdict={entry.verdict} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={entry.priority} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.reasoning}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.switchTo ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Portfolio Structure */}
      <section className="space-y-3">
        <SectionLabel label="Portfolio structure" />
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StructureRow
            label="Sector concentration"
            value={insight.portfolioStructure.sectorConcentration}
          />
          <StructureRow
            label="PSU vs private"
            value={insight.portfolioStructure.psuVsPrivate}
          />
          <StructureRow
            label="Equity vs MF split"
            value={insight.portfolioStructure.equityVsMFSplit}
          />
          <StructureRow
            label="Sector overlap"
            value={insight.portfolioStructure.sectorOverlap}
          />
        </dl>
      </section>

      {/* Tax Summary */}
      <section className="space-y-3">
        <SectionLabel label="Tax summary" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TaxStat
            label="Est. STCG"
            value={rupeeFormatter.format(insight.taxSummary.estimatedSTCG)}
          />
          <TaxStat
            label="Est. LTCG"
            value={rupeeFormatter.format(insight.taxSummary.estimatedLTCG)}
            tone={insight.taxSummary.ltcgThresholdWarning ? "warning" : "neutral"}
          />
          <TaxStat
            label="LTCG ₹1L threshold"
            value={insight.taxSummary.ltcgThresholdWarning ? "Breached" : "Clear"}
            tone={insight.taxSummary.ltcgThresholdWarning ? "warning" : "positive"}
          />
        </div>
        {insight.taxSummary.harvestingOpportunities.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Harvesting opportunities
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {insight.taxSummary.harvestingOpportunities.map((symbol) => (
                <span
                  key={symbol}
                  className="rounded border border-border bg-background px-2 py-0.5 font-mono text-xs text-foreground"
                >
                  {symbol}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Priority Actions */}
      {insight.priorityActions.length > 0 && (
        <section className="space-y-3">
          <SectionLabel label="Priority actions" />
          <ol className="space-y-2">
            {[...insight.priorityActions]
              .sort((a, b) => a.rank - b.rank)
              .map((action) => (
                <li
                  key={action.rank}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <span className="grid size-6 flex-shrink-0 place-items-center rounded-full bg-foreground text-xs font-mono font-medium text-background">
                    {action.rank}
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <UrgencyBadgePriority urgency={action.urgency} />
                      <ImpactBadge impact={action.impact} />
                      {action.rupeesImpacted !== null && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {rupeeFormatter.format(action.rupeesImpacted)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{action.action}</p>
                  </div>
                </li>
              ))}
          </ol>
        </section>
      )}

      {/* Alerts */}
      {insight.alerts.length > 0 && (
        <section className="space-y-2">
          <SectionLabel label="Alerts" />
          {insight.alerts.map((alert, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm",
                alert.urgency === "ACTION_NEEDED"
                  ? "border-l-2 border-l-[color:var(--loss)]"
                  : alert.urgency === "WARNING"
                    ? "border-l-2 border-l-[color:var(--warning)]"
                    : "border-l-2 border-l-[#3b82f6]",
              )}
            >
              <AlertCircle
                className={cn(
                  "size-4 flex-shrink-0 mt-0.5",
                  alert.urgency === "ACTION_NEEDED"
                    ? "text-[color:var(--loss)]"
                    : alert.urgency === "WARNING"
                      ? "text-[color:var(--warning)]"
                      : "text-[#3b82f6]",
                )}
              />
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
                    {alert.type}
                  </span>
                  <UrgencyBadge urgency={alert.urgency} />
                </div>
                <p className="text-sm text-foreground">{alert.message}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {generatedLabel !== null && (
        <div className="pt-2 text-xs text-muted-foreground">Generated {generatedLabel}</div>
      )}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <div className="h-px w-full bg-border" />
    </div>
  );
}

function RiskProfileBadge({ profile }: { profile: InvestorRiskProfile }) {
  const tone =
    profile === "AGGRESSIVE"
      ? "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30"
      : profile === "MODERATE"
        ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30"
        : "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30";

  return (
    <Badge variant="outline" className={cn("font-mono text-[10px]", tone)}>
      {profile}
    </Badge>
  );
}

function ClassificationBadge({
  classification,
}: {
  classification: StockVerdict["classification"];
}) {
  const tone =
    classification === "LONG_TERM_HOLD"
      ? "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30"
      : "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30";
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px]", tone)}>
      {classification.replace("_", " ")}
    </Badge>
  );
}

function StockVerdictBadge({ verdict }: { verdict: StockVerdict["verdict"] }) {
  const variants: Record<StockVerdict["verdict"], string> = {
    BOOK_PROFIT_FULL:
      "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
    BOOK_PROFIT_PARTIAL:
      "bg-[color:var(--gain)]/10 text-[color:var(--gain)] border-[color:var(--gain)]/20",
    HOLD: "bg-muted text-muted-foreground border-border",
    HOLD_TRIM:
      "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    EXIT: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px]", variants[verdict])}>
      {verdict.replace(/_/g, " ")}
    </Badge>
  );
}

function MFVerdictBadge({ verdict }: { verdict: MFVerdict["verdict"] }) {
  const variants: Record<MFVerdict["verdict"], string> = {
    CONTINUE: "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
    INCREASE_SIP:
      "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
    REDUCE_SIP:
      "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    SWITCH: "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30",
    EXIT: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px]", variants[verdict])}>
      {verdict.replace(/_/g, " ")}
    </Badge>
  );
}

function PlanTypeBadge({ planType }: { planType: MFVerdict["planType"] }) {
  const variants: Record<MFVerdict["planType"], string> = {
    DIRECT:
      "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
    REGULAR:
      "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    UNKNOWN: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px]", variants[planType])}>
      {planType}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: "LOW" | "MEDIUM" | "HIGH" }) {
  const variants: Record<string, string> = {
    HIGH: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    MEDIUM:
      "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    LOW: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[10px]", variants[priority] ?? variants.LOW)}
    >
      {priority}
    </Badge>
  );
}

function UrgencyBadge({ urgency }: { urgency: "INFO" | "WARNING" | "ACTION_NEEDED" }) {
  const variants: Record<string, string> = {
    ACTION_NEEDED:
      "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    WARNING:
      "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    INFO: "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30",
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px]", variants[urgency])}>
      {urgency.replace("_", " ")}
    </Badge>
  );
}

function UrgencyBadgePriority({ urgency }: { urgency: PriorityAction["urgency"] }) {
  const variants: Record<PriorityAction["urgency"], string> = {
    URGENT:
      "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    THIS_WEEK:
      "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    THIS_MONTH: "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30",
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px]", variants[urgency])}>
      {urgency.replace("_", " ")}
    </Badge>
  );
}

function ImpactBadge({ impact }: { impact: PriorityAction["impact"] }) {
  const variants: Record<PriorityAction["impact"], string> = {
    HIGH: "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border-[color:var(--gain)]/30",
    MEDIUM:
      "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    LOW: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px]", variants[impact])}>
      {impact} impact
    </Badge>
  );
}

function StructureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

function TaxStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "positive";
}) {
  const toneClass =
    tone === "warning"
      ? "text-[color:var(--warning)]"
      : tone === "positive"
        ? "text-[color:var(--gain)]"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-base", toneClass)}>{value}</p>
    </div>
  );
}

function formatGeneratedAt(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const date = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(parsed)
    .toLowerCase();

  return `${date}, ${time}`;
}
