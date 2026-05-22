"use client";

import { Trash2, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
  const [draft, setDraft] = useState<GoalDraft>(DEFAULT_DRAFT);
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
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Goals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Corpus-only goal tracking. SIP projections will be added with Groww CSV support.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Goal</CardTitle>
          <CardDescription>Create a target corpus goal to track from your current portfolio value.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleCreateGoal}>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="goal-name">Goal name</Label>
              <Input
                id="goal-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
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
                onChange={(event) =>
                  setDraft((current) => ({ ...current, targetCorpus: event.target.value }))}
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
                onChange={(event) => setDraft((current) => ({ ...current, targetDate: event.target.value }))}
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
                onChange={(event) =>
                  setDraft((current) => ({ ...current, expectedReturn: event.target.value }))}
                placeholder="12"
              />
            </div>

            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">
                Progress is measured against your latest portfolio snapshot value.
              </p>
            </div>

            <div className="flex items-end justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Create goal"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error !== null && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
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
        <Card className="border border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted">
              <Target className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No goals yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first corpus goal to start tracking progress.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
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
            const yearsFromCurrentValue = calcYearsToGoal(
              currentPortfolioValue,
              targetCorpus,
              expectedReturn,
            );

            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{goal.name}</CardTitle>
                      <CardDescription>
                        Target date: {dateFormatter.format(targetDate)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={status} />
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
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{percentFormatter.format(progress)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          status === "ON TRACK" && "bg-emerald-500",
                          status === "NEEDS ATTENTION" && "bg-amber-500",
                          status === "OFF TRACK" && "bg-red-500",
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {currencyFormatter.format(currentPortfolioValue)} of {currencyFormatter.format(targetCorpus)}
                    </p>
                  </div>

                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Projected at {percentFormatter.format(expectedReturn)}% by target date
                      </dt>
                      <dd className="font-medium">{currencyFormatter.format(projectedValue)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Gap</dt>
                      <dd className={cn("font-medium", gap <= 0 ? "text-emerald-700" : "text-red-700")}>
                        {gap <= 0 ? "Surplus " : "Shortfall "}
                        {currencyFormatter.format(Math.abs(gap))}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Years to goal (from current value)</dt>
                      <dd className="font-medium">
                        {Number.isFinite(yearsFromCurrentValue)
                          ? `${percentFormatter.format(yearsFromCurrentValue)} years`
                          : "Not reachable with current assumptions"}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
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
      variant="secondary"
      className={cn(
        status === "ON TRACK" && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
        status === "NEEDS ATTENTION" && "bg-amber-100 text-amber-800 hover:bg-amber-100",
        status === "OFF TRACK" && "bg-red-100 text-red-800 hover:bg-red-100",
      )}
    >
      {status}
    </Badge>
  );
}
