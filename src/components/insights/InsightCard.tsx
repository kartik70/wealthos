"use client";

import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InsightResponse } from "@/types/portfolio";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  insight: InsightResponse | null;
  onGenerateInsights: () => void;
  isGenerating: boolean;
  hasHoldings: boolean;
}

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

  return (
    <>
      {/* Summary */}
      {insight && (
        <div className="space-y-3">
          <SectionLabel label="Summary" />
          <p className="text-sm leading-relaxed text-foreground">{insight.summary}</p>

          {/* Recommendations */}
          {insight.recommendations.length > 0 && (
            <div className="space-y-2 pt-2">
              <SectionLabel label="Recommendations" />
              {insight.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[#1e2d40] bg-[#0a0f1e] px-3 py-2"
                >
                  <ActionBadge action={rec.action} />
                  <PriorityBadge priority={rec.priority} />
                  <span className="font-mono font-medium text-sm text-white">{rec.symbol}</span>
                  <span className="text-sm text-[#8899aa]">{rec.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {insight && insight.alerts.length > 0 && (
        <div className="space-y-2 pt-2">
          <SectionLabel label="Alerts" />

          {insight.alerts.map((alert, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-[#1e2d40] bg-[#0a0f1e] p-3 text-sm",
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
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#4a5568]">{alert.type}</span>
                  <UrgencyBadge urgency={alert.urgency} />
                </div>
                <p className="text-sm text-[#d1d9e0]">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {insight && generatedLabel !== null && (
        <div className="pt-2 text-xs text-muted-foreground">Generated {generatedLabel}</div>
      )}

      {/* Empty state */}
      {!insight && hasHoldings && (
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
      )}
    </>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{label}</p>
      <div className="h-px w-full bg-border" />
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const variants: Record<string, string> = {
    BUY: "bg-[color:var(--gain)]/15 text-[color:var(--gain)] border border-[color:var(--gain)]/30",
    SELL: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border border-[color:var(--loss)]/30",
    HOLD: "bg-[#1a2235] text-[#8899aa] border border-[#1e2d40]",
    REVIEW: "bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30",
  };

  const className = variants[action] ?? variants.HOLD;

  return (
    <div className={cn("rounded px-2 py-0.5 text-[10px] font-mono font-medium tracking-wide", className)}>
      {action}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, string> = {
    HIGH: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    MEDIUM: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    LOW: "bg-[#1a2235] text-[#8899aa] border-[#1e2d40]",
  };

  return (
    <Badge variant="outline" className={cn("text-[10px] font-mono", variants[priority] || variants.LOW)}>
      {priority}
    </Badge>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const variants: Record<string, string> = {
    ACTION_NEEDED: "bg-[color:var(--loss)]/15 text-[color:var(--loss)] border-[color:var(--loss)]/30",
    WARNING: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    INFO: "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30",
  };

  return (
    <Badge variant="outline" className={cn("text-[10px] font-mono", variants[urgency] || variants.INFO)}>
      {urgency.replace("_", " ")}
    </Badge>
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
