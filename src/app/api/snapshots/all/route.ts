import { requireAuth } from "@/lib/db/require-auth";
import type { Holding, PortfolioSnapshot } from "@/types/portfolio";

export const runtime = "nodejs";

interface AllSnapshotsResponse {
  snapshots: PortfolioSnapshot[];
}

type SnapshotWithHoldingsRow = {
  id: string;
  user_id: string;
  total_value: number;
  total_cost: number;
  total_gain: number;
  total_gain_pct: number;
  source: string | null;
  created_at: string;
  holdings: Array<{
    symbol: string;
    name: string | null;
    quantity: number;
    avg_cost: number;
    current_price: number;
    current_value: number;
    unrealised_gain: number;
    unrealised_gain_pct: number;
    allocation_pct: number;
  }> | null;
};

export async function GET(): Promise<Response> {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase, userId } = auth.data;

    // Fetch all portfolio snapshots with their holdings ordered by created_at descending
    const { data: snapshots, error: snapshotsError } = await supabase
      .from("portfolio_snapshots")
      .select(
        `
        id,
        user_id,
        total_value,
        total_cost,
        total_gain,
        total_gain_pct,
        source,
        created_at,
        holdings (
          symbol,
          name,
          quantity,
          avg_cost,
          current_price,
          current_value,
          unrealised_gain,
          unrealised_gain_pct,
          allocation_pct
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (snapshotsError !== null) {
      return Response.json(
        { error: `Failed to fetch snapshots: ${snapshotsError.message}` },
        { status: 500 },
      );
    }

    const rows = (snapshots ?? []) as unknown as SnapshotWithHoldingsRow[];
    const snapshotList: PortfolioSnapshot[] = rows.map((row) => {
      const holdings = row.holdings ?? [];

      return {
        id: row.id,
        userId: row.user_id,
        createdAt: row.created_at,
        totalValue: row.total_value,
        totalCost: row.total_cost,
        totalGain: row.total_gain,
        totalGainPct: row.total_gain_pct,
        source: row.source as "kite" | "groww" | "manual",
        holdings: holdings.map((h) => ({
          symbol: h.symbol,
          name: h.name ?? h.symbol,
          quantity: h.quantity,
          avgCost: h.avg_cost,
          currentPrice: h.current_price,
          currentValue: h.current_value,
          unrealisedGain: h.unrealised_gain,
          unrealisedGainPct: h.unrealised_gain_pct,
          allocationPct: h.allocation_pct,
        })),
      };
    });

    const response: AllSnapshotsResponse = {
      snapshots: snapshotList,
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch snapshots" },
      { status: 500 },
    );
  }
}
