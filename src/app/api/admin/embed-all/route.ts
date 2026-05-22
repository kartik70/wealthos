import { createSupabaseAdminClient } from "../../../../lib/db/supabase";
import { embedSnapshot } from "../../../../lib/ai/embeddings";
import { calcSnapshotDiff } from "../../../../lib/finance/diff";
import type { Holding, PortfolioSnapshot } from "../../../../types/portfolio";
import type { HoldingRow, PortfolioSnapshotRow } from "../../../../types/db";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const supabase = createSupabaseAdminClient();
  const userId = "local-dev-user";

  const { data: snapshots, error: snapshotsError } = await supabase
    .from("portfolio_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (snapshotsError !== null) {
    return Response.json(
      { error: `Failed to fetch snapshots: ${snapshotsError.message}` },
      { status: 500 },
    );
  }

  if (snapshots === null || snapshots.length === 0) {
    return Response.json({ message: "No snapshots found", embedded: 0 });
  }

  const results: Array<{ snapshotId: string; status: "ok" | "error"; error?: string }> = [];
  let previousSnapshot: PortfolioSnapshot | null = null;

  for (const snapshotRow of snapshots) {
    try {
      const { data: holdingRows, error: holdingsError } = await supabase
        .from("holdings")
        .select("*")
        .eq("snapshot_id", snapshotRow.id);

      if (holdingsError !== null || holdingRows === null) {
        results.push({
          snapshotId: snapshotRow.id,
          status: "error",
          error: holdingsError?.message ?? "No holdings found",
        });
        continue;
      }

      const snapshot = rowToSnapshot(snapshotRow, holdingRows);
      const holdings = holdingRows.map(rowToHolding);
      const diff =
        previousSnapshot === null ? undefined : calcSnapshotDiff(previousSnapshot, snapshot);

      await embedSnapshot(snapshot, holdings, diff);
      previousSnapshot = snapshot;

      results.push({ snapshotId: snapshotRow.id, status: "ok" });
    } catch (err) {
      results.push({
        snapshotId: snapshotRow.id,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.status === "ok").length;

  return Response.json({
    message: `Embedded ${successCount}/${snapshots.length} snapshots`,
    embedded: successCount,
    results,
  });
}

function rowToHolding(row: HoldingRow): Holding {
  return {
    symbol: row.symbol,
    name: row.name ?? row.symbol,
    quantity: row.quantity,
    avgCost: row.avg_cost,
    currentPrice: row.current_price,
    currentValue: row.current_value,
    unrealisedGain: row.unrealised_gain,
    unrealisedGainPct: row.unrealised_gain_pct,
    allocationPct: row.allocation_pct,
  };
}

function rowToSnapshot(row: PortfolioSnapshotRow, holdingRows: HoldingRow[]): PortfolioSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    totalValue: row.total_value,
    totalCost: row.total_cost,
    totalGain: row.total_gain,
    totalGainPct: row.total_gain_pct,
    holdings: holdingRows.map(rowToHolding),
    source: (row.source as PortfolioSnapshot["source"]) ?? "manual",
  };
}
