import { GoogleGenerativeAI } from "@google/generative-ai";

import { createSupabaseAdminClient } from "../db/supabase";
import { calcLumpSumProjection, calcGoalProgress } from "../finance/goals";
import type { Holding, PortfolioSnapshot } from "../../types/portfolio";
import type { GoalRow, MutualFundHoldingRow } from "../../types/db";
import type { SnapshotDiff } from "../finance/diff";
import type { Database } from "../../types/db";

type EmbeddingInsert = Database["public"]["Tables"]["snapshot_embeddings"]["Insert"];

let geminiEmbeddingClient: GoogleGenerativeAI | null = null;

export async function generateEmbedding(text: string, apiKey?: string): Promise<number[]> {
  const resolvedApiKey = apiKey ?? process.env.GEMINI_API_KEY;

  if (resolvedApiKey === undefined || resolvedApiKey.trim() === "") {
    throw new Error("Missing GEMINI_API_KEY for embeddings");
  }

  const client =
    apiKey === undefined
      ? (geminiEmbeddingClient ??= new GoogleGenerativeAI(resolvedApiKey))
      : new GoogleGenerativeAI(resolvedApiKey);

  const model = client.getGenerativeModel({ 
  model: "gemini-embedding-001",
});

const result = await model.embedContent(text);
const fullEmbedding = result.embedding.values;

// Truncate to 768 dimensions
return fullEmbedding.slice(0, 768);
}

export async function embedSnapshot(
  snapshot: PortfolioSnapshot,
  holdings: Holding[],
  diff?: SnapshotDiff,
  apiKey?: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const rows: EmbeddingInsert[] = [];

  // Chunk 1: Snapshot summary
  const top5 = [...holdings]
    .sort((a, b) => b.allocationPct - a.allocationPct)
    .slice(0, 5);

  const holdingsSummary = top5
    .map(
      (h) =>
        `${h.symbol} ${h.allocationPct.toFixed(1)}% (${h.unrealisedGainPct >= 0 ? "+" : ""}${h.unrealisedGainPct.toFixed(1)}%)`,
    )
    .join(", ");

  const date = new Date(snapshot.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const mfSentence = await buildMutualFundEmbeddingSentence(
    supabase,
    snapshot.userId,
    snapshot.createdAt,
  );

  const snapshotSummaryText = `On ${date}, portfolio value was ₹${snapshot.totalValue.toFixed(0)}, total gain/loss ₹${snapshot.totalGain.toFixed(0)} (${snapshot.totalGainPct >= 0 ? "+" : ""}${snapshot.totalGainPct.toFixed(2)}%). Holdings: ${holdingsSummary}${mfSentence}`;

  const snapshotEmbedding = await generateEmbedding(snapshotSummaryText, apiKey);
  rows.push({
    snapshot_id: snapshot.id,
    user_id: snapshot.userId,
    chunk_type: "snapshot_summary",
    content: snapshotSummaryText,
    embedding: snapshotEmbedding as unknown as number[],
  });

  // Chunk 2: Diff summary (if diff exists)
  if (diff !== undefined) {
    const prevDate = new Date(
      new Date(snapshot.createdAt).getTime() - 30 * 24 * 60 * 60 * 1000,
    ).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

    const parts: string[] = [];
    if (diff.partialExits.length > 0) {
      const profitBooked = diff.partialExits.filter((p) => p.pnlType === "BOOKED_PROFIT");
      const lossBooked = diff.partialExits.filter((p) => p.pnlType === "BOOKED_LOSS");
      if (profitBooked.length > 0) {
        parts.push(`booked profit in ${profitBooked.map((p) => p.symbol).join(", ")}`);
      }
      if (lossBooked.length > 0) {
        parts.push(`booked loss in ${lossBooked.map((p) => p.symbol).join(", ")}`);
      }
    }
    if (diff.exitedPositions.length > 0) {
      parts.push(`exited ${diff.exitedPositions.map((p) => p.symbol).join(", ")}`);
    }
    if (diff.newPositions.length > 0) {
      parts.push(`added ${diff.newPositions.map((p) => p.symbol).join(", ")}`);
    }
    if (diff.increasedPositions.length > 0) {
      parts.push(`increased ${diff.increasedPositions.map((p) => p.symbol).join(", ")}`);
    }

    const diffText =
      parts.length > 0
        ? `Between ${prevDate} and ${date}: ${parts.join("; ")}`
        : `Between ${prevDate} and ${date}: no significant position changes`;

    const diffEmbedding = await generateEmbedding(diffText, apiKey);
    rows.push({
      snapshot_id: snapshot.id,
      user_id: snapshot.userId,
      chunk_type: "diff_summary",
      content: diffText,
      embedding: diffEmbedding as unknown as number[],
    });
  }

  // Chunk 3: Insight summary (fetched from ai_insights if exists)
  const { data: insight } = await supabase
    .from("ai_insights")
    .select("summary")
    .eq("snapshot_id", snapshot.id)
    .neq("summary", "__DETAILED_INSIGHT__")
    .maybeSingle();

  if (insight?.summary !== null && insight?.summary !== undefined && insight.summary !== "") {
    const insightEmbedding = await generateEmbedding(insight.summary, apiKey);
    rows.push({
      snapshot_id: snapshot.id,
      user_id: snapshot.userId,
      chunk_type: "insight_summary",
      content: insight.summary,
      embedding: insightEmbedding as unknown as number[],
    });
  }

  // Delete existing embeddings for this snapshot before re-inserting
  await supabase.from("snapshot_embeddings").delete().eq("snapshot_id", snapshot.id);

  const { error } = await supabase.from("snapshot_embeddings").insert(rows);

  if (error !== null) {
    throw new Error(`Failed to save snapshot embeddings: ${error.message}`);
  }
}

async function buildMutualFundEmbeddingSentence(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  equityCreatedAt: string,
): Promise<string> {
  const snapshotDate = equityCreatedAt.split("T")[0];
  if (snapshotDate === undefined || snapshotDate === "") {
    return "";
  }

  const { data: mfSnapshot, error } = await supabase
    .from("mutual_fund_snapshots")
    .select(
      `
      snapshot_date,
      total_current_value,
      total_returns,
      total_returns_pct,
      mutual_fund_holdings (
        scheme_name,
        allocation_pct
      )
    `,
    )
    .eq("user_id", userId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle();

  if (error !== null || mfSnapshot === null) {
    return "";
  }

  const snapshotData = mfSnapshot as unknown as {
    snapshot_date: string;
    total_current_value: number;
    total_returns: number;
    total_returns_pct: number;
    mutual_fund_holdings: Array<Pick<MutualFundHoldingRow, "scheme_name" | "allocation_pct">>;
  };

  const topFunds = [...(snapshotData.mutual_fund_holdings ?? [])]
    .sort((left, right) => (right.allocation_pct ?? 0) - (left.allocation_pct ?? 0))
    .slice(0, 3)
    .map(
      (holding) =>
        `${holding.scheme_name} (${(holding.allocation_pct ?? 0).toFixed(1)}%)`,
    )
    .join(", ");

  const formattedDate = new Date(snapshotData.snapshot_date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return ` Mutual funds on ${formattedDate}: total value ₹${snapshotData.total_current_value.toFixed(0)}, returns ₹${snapshotData.total_returns.toFixed(0)} (${snapshotData.total_returns_pct >= 0 ? "+" : ""}${snapshotData.total_returns_pct.toFixed(2)}%). Top funds: ${topFunds || "none"}.`;
}

function getGoalStatus(projectedValue: number, targetCorpus: number): string {
  if (projectedValue >= targetCorpus) {
    return "ON TRACK";
  }
  if (projectedValue >= targetCorpus * 0.75) {
    return "NEEDS ATTENTION";
  }
  return "OFF TRACK";
}

export async function embedGoals(userId: string, apiKey?: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Always clear previous goal_summary rows for this user, so deletions are reflected.
  await supabase
    .from("snapshot_embeddings")
    .delete()
    .eq("user_id", userId)
    .eq("chunk_type", "goal_summary");

  const [{ data: goals, error: goalsError }, { data: latestSnapshot, error: snapshotError }] =
    await Promise.all([
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase
        .from("portfolio_snapshots")
        .select("id, total_value")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (goalsError !== null) {
    throw new Error(`Failed to fetch goals for embedding: ${goalsError.message}`);
  }

  if (snapshotError !== null) {
    throw new Error(`Failed to fetch latest snapshot for goal embeddings: ${snapshotError.message}`);
  }

  if (goals === null || goals.length === 0 || latestSnapshot === null) {
    return;
  }

  const currentValue = latestSnapshot.total_value;
  const snapshotId = latestSnapshot.id;
  const now = Date.now();

  const rows: EmbeddingInsert[] = [];

  for (const goal of goals as GoalRow[]) {
    const targetDateMs = new Date(goal.target_date).getTime();
    const yearsRemaining = Number.isFinite(targetDateMs)
      ? Math.max(0, (targetDateMs - now) / (365.25 * 24 * 60 * 60 * 1000))
      : 0;

    const projectedValue = calcLumpSumProjection(
      currentValue,
      goal.expected_return,
      yearsRemaining,
    );
    const progress = calcGoalProgress(currentValue, goal.target_corpus);
    const status = getGoalStatus(projectedValue, goal.target_corpus);

    const targetDateFormatted = new Date(goal.target_date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const content = `Goal: ${goal.name}. Target corpus ₹${goal.target_corpus.toFixed(0)} by ${targetDateFormatted}. Expected return ${goal.expected_return.toFixed(1)}%. Current portfolio value ₹${currentValue.toFixed(0)}. Progress ${progress.toFixed(1)}%. Status: ${status}. Years remaining: ${yearsRemaining.toFixed(1)}.`;

    const embedding = await generateEmbedding(content, apiKey);
    rows.push({
      snapshot_id: snapshotId,
      user_id: userId,
      chunk_type: "goal_summary",
      content,
      embedding: embedding as unknown as number[],
    });
  }

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("snapshot_embeddings").insert(rows);

  if (error !== null) {
    throw new Error(`Failed to save goal embeddings: ${error.message}`);
  }
}
