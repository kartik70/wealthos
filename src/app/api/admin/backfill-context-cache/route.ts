import { requireAuth } from "@/lib/db/require-auth";
import { buildSnapshotContextString } from "../../../../lib/ai/contextBuilder";
import type { Holding, PortfolioSnapshot } from "../../../../types/portfolio";
import type { HoldingRow, PortfolioSnapshotRow } from "../../../../types/db";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const expectedSecret = process.env.ADMIN_SECRET;
  if (expectedSecret === undefined || expectedSecret.length === 0) {
    return Response.json(
      { error: "Admin endpoint not configured" },
      { status: 503 },
    );
  }
  const providedSecret = request.headers.get("x-admin-secret");
  if (providedSecret !== expectedSecret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  const { data: snapshots, error: snapshotsError } = await supabase
    .from("portfolio_snapshots")
    .select("*")
    .eq("user_id", userId)
    .is("context_cache", null)
    .order("created_at", { ascending: true });

  if (snapshotsError !== null) {
    return Response.json(
      { error: `Failed to fetch snapshots: ${snapshotsError.message}` },
      { status: 500 },
    );
  }

  if (snapshots === null || snapshots.length === 0) {
    return Response.json({ message: "No snapshots need backfilling", updated: 0 });
  }

  const results: Array<{
    snapshotId: string;
    status: "ok" | "error";
    error?: string;
  }> = [];

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
      const contextCache = buildSnapshotContextString(snapshot, snapshot.holdings);

      const { error: updateError } = await supabase
        .from("portfolio_snapshots")
        .update({ context_cache: contextCache })
        .eq("id", snapshotRow.id);

      if (updateError !== null) {
        results.push({
          snapshotId: snapshotRow.id,
          status: "error",
          error: updateError.message,
        });
        continue;
      }

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
    message: `Backfilled ${successCount}/${snapshots.length} snapshots`,
    updated: successCount,
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

function rowToSnapshot(
  row: PortfolioSnapshotRow,
  holdingRows: HoldingRow[],
): PortfolioSnapshot {
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
