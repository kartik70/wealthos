"use client";

import { AlertCircle, TrendingDown, TrendingUp, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <>
      {/* Summary */}
      {insight && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Summary
          </div>
          <p className="text-sm leading-relaxed text-foreground">{insight.summary}</p>

          {/* Recommendations */}
          {insight.recommendations.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Recommendations
              </div>
              {insight.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-3 py-2 text-sm"
                >
                  <ActionBadge action={rec.action} />
                  <PriorityBadge priority={rec.priority} />
                  <span className="font-mono font-medium text-foreground">{rec.symbol}</span>
                  <span className="text-muted-foreground">{rec.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {insight && insight.alerts.length > 0 && (
        <div className="space-y-1 pt-2">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Alerts
          </div>

          {insight.alerts.map((alert, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-sm",
                alert.urgency === "ACTION_NEEDED"
                  ? "border-red-300 bg-red-50"
                  : alert.urgency === "WARNING"
                    ? "border-amber-300 bg-amber-50"
                    : "border-blue-300 bg-blue-50",
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
                <p
                  className={cn(
                    "text-sm",
                    alert.urgency === "ACTION_NEEDED"
                      ? "text-red-700"
                      : alert.urgency === "WARNING"
                        ? "text-amber-700"
                        : "text-blue-700",
                  )}
                >
                  {alert.message}
                </p>
              </div>
            </div>
          ))}
        </div>
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

function ActionBadge({ action }: { action: string }) {
  const variants: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
    BUY: { bg: "bg-emerald-100", text: "text-emerald-700", icon: TrendingUp },
    SELL: { bg: "bg-red-100", text: "text-red-700", icon: TrendingDown },
    HOLD: { bg: "bg-gray-100", text: "text-gray-700", icon: AlertCircle },
    REVIEW: { bg: "bg-blue-100", text: "text-blue-700", icon: AlertCircle },
  };

  const variant = variants[action] || variants.HOLD;
  const Icon = variant.icon;

  return (
    <div className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold", variant.bg, variant.text)}>
      <Icon className="size-3" />
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
