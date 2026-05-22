import { GoogleGenerativeAI } from "@google/generative-ai";

import { createSupabaseAdminClient } from "../db/supabase";
import type { Holding, PortfolioSnapshot } from "../../types/portfolio";
import type { SnapshotDiff } from "../finance/diff";
import type { Database } from "../../types/db";

type EmbeddingInsert = Database["public"]["Tables"]["snapshot_embeddings"]["Insert"];

let geminiEmbeddingClient: GoogleGenerativeAI | null = null;

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey === undefined || apiKey.trim() === "") {
    throw new Error("Missing GEMINI_API_KEY for embeddings");
  }

  if (geminiEmbeddingClient === null) {
    geminiEmbeddingClient = new GoogleGenerativeAI(apiKey);
  }

  const model = geminiEmbeddingClient.getGenerativeModel({ 
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

  const snapshotSummaryText = `On ${date}, portfolio value was ₹${snapshot.totalValue.toFixed(0)}, total gain/loss ₹${snapshot.totalGain.toFixed(0)} (${snapshot.totalGainPct >= 0 ? "+" : ""}${snapshot.totalGainPct.toFixed(2)}%). Holdings: ${holdingsSummary}`;

  const snapshotEmbedding = await generateEmbedding(snapshotSummaryText);
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

    const diffEmbedding = await generateEmbedding(diffText);
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
    const insightEmbedding = await generateEmbedding(insight.summary);
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
