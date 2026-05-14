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
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-muted bg-muted/30 px-3 py-2"
                >
                  <ActionBadge action={rec.action} />
                  <PriorityBadge priority={rec.priority} />
                  <span className="font-mono font-medium text-sm text-foreground">{rec.symbol}</span>
                  <span className="text-sm text-muted-foreground">{rec.reason}</span>
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
                "flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm",
                alert.urgency === "ACTION_NEEDED"
                  ? "border-l-2 border-l-red-500"
                  : alert.urgency === "WARNING"
                    ? "border-l-2 border-l-amber-500"
                    : "border-l-2 border-l-slate-300",
              )}
            >
              <AlertCircle
                className={cn(
                  "size-4 flex-shrink-0 mt-0.5",
                  alert.urgency === "ACTION_NEEDED"
                    ? "text-red-600"
                    : alert.urgency === "WARNING"
                      ? "text-amber-600"
                      : "text-blue-600",
                )}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase">{alert.type}</span>
                  <UrgencyBadge urgency={alert.urgency} />
                </div>
                <p className="text-sm text-foreground">{alert.message}</p>
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
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="text-sm text-muted-foreground">
            No insights generated yet. Click the button to analyze your portfolio.
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
  const variants: Record<string, { bg: string; text: string }> = {
    BUY: { bg: "bg-emerald-100", text: "text-emerald-700" },
    SELL: { bg: "bg-red-100", text: "text-red-700" },
    HOLD: { bg: "bg-gray-100", text: "text-gray-700" },
    REVIEW: { bg: "bg-blue-100", text: "text-blue-700" },
  };

  const variant = variants[action] || variants.HOLD;

  return (
    <div className={cn("rounded px-2 py-0.5 text-xs font-semibold", variant.bg, variant.text)}>
      {action}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, string> = {
    HIGH: "bg-red-100 text-red-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-gray-100 text-gray-700",
  };

  return (
    <Badge variant="outline" className={cn("text-xs", variants[priority] || variants.LOW)}>
      {priority}
    </Badge>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const variants: Record<string, string> = {
    ACTION_NEEDED: "bg-red-200 text-red-800",
    WARNING: "bg-amber-200 text-amber-800",
    INFO: "bg-blue-200 text-blue-800",
  };

  return (
    <Badge variant="outline" className={cn("text-xs", variants[urgency] || variants.INFO)}>
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
