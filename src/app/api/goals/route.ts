import { requireAuth } from "@/lib/db/require-auth";
import { embedGoals } from "@/lib/ai/embeddings";
import type { GoalRow } from "@/types/db";

export const runtime = "nodejs";

interface GoalsResponse {
  goals: GoalRow[];
  currentPortfolioValue: number;
  equityValue: number;
  mutualFundValue: number;
}

interface CreateGoalRequest {
  name?: string;
  targetCorpus?: number;
  targetDate?: string;
  expectedReturn?: number;
}

export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  const [
    { data: goals, error: goalsError },
    { data: snapshot, error: snapshotError },
    { data: mfSnapshot, error: mfSnapshotError },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("target_date", { ascending: true }),
    supabase
      .from("portfolio_snapshots")
      .select("total_value")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("mutual_fund_snapshots")
      .select("total_current_value")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (goalsError !== null) {
    return Response.json(
      { error: `Failed to fetch goals: ${goalsError.message}` },
      { status: 500 },
    );
  }

  if (snapshotError !== null) {
    return Response.json(
      { error: `Failed to fetch current portfolio value: ${snapshotError.message}` },
      { status: 500 },
    );
  }

  if (mfSnapshotError !== null) {
    return Response.json(
      { error: `Failed to fetch mutual fund value: ${mfSnapshotError.message}` },
      { status: 500 },
    );
  }

  const equityValue = snapshot?.total_value ?? 0;
  const mutualFundValue = mfSnapshot?.total_current_value ?? 0;

  const response: GoalsResponse = {
    goals: goals ?? [],
    currentPortfolioValue: equityValue + mutualFundValue,
    equityValue,
    mutualFundValue,
  };

  return Response.json(response);
}

export async function POST(request: Request): Promise<Response> {
  let body: CreateGoalRequest;

  try {
    body = (await request.json()) as CreateGoalRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const targetCorpus = Number(body.targetCorpus);
  const targetDate = body.targetDate;
  const expectedReturn = body.expectedReturn === undefined
    ? 12
    : Number(body.expectedReturn);

  if (!name) {
    return Response.json({ error: "Goal name is required" }, { status: 400 });
  }

  if (!Number.isFinite(targetCorpus) || targetCorpus <= 0) {
    return Response.json(
      { error: "targetCorpus must be a positive number" },
      { status: 400 },
    );
  }

  if (!targetDate || Number.isNaN(new Date(targetDate).getTime())) {
    return Response.json(
      { error: "targetDate must be a valid date" },
      { status: 400 },
    );
  }

  if (!Number.isFinite(expectedReturn)) {
    return Response.json(
      { error: "expectedReturn must be a valid number" },
      { status: 400 },
    );
  }

  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      name,
      target_corpus: targetCorpus,
      target_date: targetDate,
      expected_return: expectedReturn,
    })
    .select("*")
    .single();

  if (error !== null) {
    return Response.json(
      { error: `Failed to create goal: ${error.message}` },
      { status: 500 },
    );
  }

  try {
    await embedGoals(userId);
  } catch (embedErr) {
    console.error("Failed to refresh goal embeddings after create", embedErr);
  }

  return Response.json({ goal: data }, { status: 201 });
}
