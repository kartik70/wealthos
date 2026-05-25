"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calcGoalProgress,
  calcLumpSumProjection,
  calcYearsToGoal,
} from "@/lib/finance/goals";
import { cn } from "@/lib/utils";
import type { GoalRow } from "@/types/db";

interface GoalsResponse {
  goals: GoalRow[];
  currentPortfolioValue: number;
  equityValue: number;
  mutualFundValue: number;
}

interface GoalDraft {
  name: string;
  targetCorpus: string;
  targetDate: string;
  expectedReturn: string;
}

type GoalStatus = "ON TRACK" | "NEEDS ATTENTION" | "OFF TRACK";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DEFAULT_DRAFT: GoalDraft = {
  name: "",
  targetCorpus: "",
  targetDate: "",
  expectedReturn: "12",
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [currentPortfolioValue, setCurrentPortfolioValue] = useState(0);
  const [equityValue, setEquityValue] = useState(0);
  const [mutualFundValue, setMutualFundValue] = useState(0);
  const [draft, setDraft] = useState<GoalDraft>(DEFAULT_DRAFT);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/goals", { cache: "no-store" });
      const payload = (await response.json()) as GoalsResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to fetch goals");
      }

      setGoals(payload.goals ?? []);
      setCurrentPortfolioValue(payload.currentPortfolioValue ?? 0);
      setEquityValue(payload.equityValue ?? 0);
      setMutualFundValue(payload.mutualFundValue ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch goals");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => a.target_date.localeCompare(b.target_date)),
    [goals],
  );

  async function handleCreateGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          targetCorpus: Number(draft.targetCorpus),
          targetDate: draft.targetDate,
          expectedReturn: Number(draft.expectedReturn || 12),
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create goal");
      }

      setDraft(DEFAULT_DRAFT);
      setIsDrawerOpen(false);
      await fetchGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteGoal(goalId: string) {
    setDeletingGoalId(goalId);

    try {
      const response = await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete goal");
      }

      setGoals((current) => current.filter((goal) => goal.id !== goalId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete goal");
    } finally {
      setDeletingGoalId(null);
    }
  }

  return (
    <div className="animate-in fade-in-0 duration-300 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Corpus-only goal tracking. SIP projections will be added with Groww CSV support.
          </p>
        </div>
        <Button onClick={() => setIsDrawerOpen(true)}>Add Goal</Button>
      </div>

      {error !== null && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 py-4">
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-2 w-full animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedGoals.length === 0 ? (
        <div
          className="relative flex flex-col items-center gap-3 overflow-hidden rounded-xl py-20 text-center"
          style={{
            background: "#111827",
            border: "1px solid #1e2d40",
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex select-none items-center justify-center leading-none"
            style={{ color: "#1e2d40", fontSize: "200px" }}
          >
            ◎
          </span>
          <div className="relative z-10 flex flex-col items-center gap-4">
            <h2 className="text-xl text-white" style={{ fontWeight: 500 }}>
              No goals set
            </h2>
            <p className="max-w-sm text-sm" style={{ color: "#8899aa" }}>
              Define a target corpus to start tracking your progress.
            </p>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "#3b82f6" }}
            >
              Add Goal
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {sortedGoals.map((goal) => {
            const targetCorpus = Number(goal.target_corpus);
            const expectedReturn = Number(goal.expected_return ?? 12);
            const targetDate = new Date(goal.target_date);
            const yearsToTarget = Math.max(
              0,
              (targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365.25),
            );
            const projectedValue = calcLumpSumProjection(
              currentPortfolioValue,
              expectedReturn,
              yearsToTarget,
            );
            const gap = targetCorpus - projectedValue;
            const progress = calcGoalProgress(currentPortfolioValue, targetCorpus);
            const status = getGoalStatus(projectedValue, targetCorpus);
            const statusAccent =
              status === "ON TRACK"
                ? "#10b981"
                : status === "NEEDS ATTENTION"
                  ? "#f59e0b"
                  : "#f43f5e";
            const yearsFromCurrentValue = calcYearsToGoal(
              currentPortfolioValue,
              targetCorpus,
              expectedReturn,
            );

            return (
              <Card
                key={goal.id}
                style={{ borderLeft: `3px solid ${statusAccent}` }}
              >
                <CardContent className="space-y-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid flex-1 gap-5 lg:grid-cols-[1.4fr_auto_1fr] lg:items-center">
                      <div className="space-y-2">
                        <p className="text-lg font-medium">{goal.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Target date: {dateFormatter.format(targetDate)}
                        </p>
                        <p className="font-mono text-2xl font-light">
                          {currencyFormatter.format(targetCorpus)}
                        </p>
                      </div>

                      <ProgressRing progress={progress} status={status} />

                      <dl className="grid gap-2 font-mono text-sm">
                        <StatRow
                          label="Projected value"
                          value={currencyFormatter.format(projectedValue)}
                        />
                        <StatRow
                          label="Gap"
                          value={`${gap <= 0 ? "Surplus" : "Shortfall"} ${currencyFormatter.format(Math.abs(gap))}`}
                          valueClassName={gap <= 0 ? "text-emerald-500" : "text-rose-500"}
                        />
                        <StatRow
                          label="Years to goal"
                          value={
                            Number.isFinite(yearsFromCurrentValue)
                              ? `${percentFormatter.format(yearsFromCurrentValue)} years`
                              : "Not reachable"
                          }
                        />
                      </dl>
                    </div>

                    <div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => void handleDeleteGoal(goal.id)}
                        disabled={deletingGoalId === goal.id}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          status === "ON TRACK" && "bg-emerald-500",
                          status === "NEEDS ATTENTION" && "bg-amber-500",
                          status === "OFF TRACK" && "bg-rose-500",
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {currencyFormatter.format(currentPortfolioValue)} of {currencyFormatter.format(targetCorpus)}
                      </span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">
                      Equity {currencyFormatter.format(equityValue)} + MF {currencyFormatter.format(mutualFundValue)} = {currencyFormatter.format(currentPortfolioValue)} total
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <GoalDrawer
        open={isDrawerOpen}
        draft={draft}
        isSaving={isSaving}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleCreateGoal}
        onDraftChange={setDraft}
      />
    </div>
  );
}

function getGoalStatus(projectedValue: number, targetCorpus: number): GoalStatus {
  if (projectedValue >= targetCorpus) {
    return "ON TRACK";
  }

  if (projectedValue >= targetCorpus * 0.75) {
    return "NEEDS ATTENTION";
  }

  return "OFF TRACK";
}

function StatusBadge({ status }: { status: GoalStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        status === "ON TRACK" && "border-emerald-500 text-emerald-500",
        status === "NEEDS ATTENTION" && "border-amber-500 text-amber-500",
        status === "OFF TRACK" && "border-rose-500 text-rose-500",
      )}
    >
      {status}
    </Badge>
  );
}

function ProgressRing({ progress, status }: { progress: number; status: GoalStatus }) {
  const clamped = Math.max(0, Math.min(100, progress));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative grid place-items-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            status === "ON TRACK" && "text-emerald-500",
            status === "NEEDS ATTENTION" && "text-amber-500",
            status === "OFF TRACK" && "text-rose-500",
          )}
        />
      </svg>
      <div className="pointer-events-none absolute text-center">
        <p className="font-mono text-lg font-medium">{percentFormatter.format(clamped)}%</p>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm", valueClassName)}>{value}</dd>
    </div>
  );
}

function GoalDrawer({
  open,
  draft,
  isSaving,
  onClose,
  onSubmit,
  onDraftChange,
}: {
  open: boolean;
  draft: GoalDraft;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onDraftChange: React.Dispatch<React.SetStateAction<GoalDraft>>;
}) {
  return (
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")}>
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-background/60 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
        aria-label="Close add goal drawer"
        onClick={onClose}
      />

      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-md border-l bg-background p-5 shadow-xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Add Goal</h2>
            <p className="text-sm text-muted-foreground">Create a corpus target with expected return assumptions.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>

        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Goal name</Label>
            <Input
              id="goal-name"
              value={draft.name}
              onChange={(event) => onDraftChange((current) => ({ ...current, name: event.target.value }))}
              placeholder="Retirement corpus"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-target">Target corpus (₹)</Label>
            <Input
              id="goal-target"
              type="number"
              min="1"
              value={draft.targetCorpus}
              onChange={(event) => onDraftChange((current) => ({ ...current, targetCorpus: event.target.value }))}
              placeholder="10000000"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-date">Target date</Label>
            <Input
              id="goal-date"
              type="date"
              value={draft.targetDate}
              onChange={(event) => onDraftChange((current) => ({ ...current, targetDate: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-return">Expected return (%)</Label>
            <Input
              id="goal-return"
              type="number"
              step="0.1"
              value={draft.expectedReturn}
              onChange={(event) => onDraftChange((current) => ({ ...current, expectedReturn: event.target.value }))}
              placeholder="12"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Progress is measured against your latest portfolio snapshot value.
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Create goal"}</Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
