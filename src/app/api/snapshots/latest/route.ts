import { createSupabaseServerClient } from "@/lib/db/supabase";
import type { Database } from "@/types/db";
import type { Holding, PortfolioTotals } from "@/types/portfolio";

export const runtime = "nodejs";

interface LatestSnapshotResponse {
  snapshotId: string;
  totals: PortfolioTotals;
  holdings: Holding[];
  source: "kite" | "groww";
  createdAt: string;
}

export async function GET(): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient();
    const userId = "local-dev-user";

    // Fetch the most recent portfolio snapshot with its holdings
    const { data: snapshot, error: snapshotError } = await supabase
      .from("portfolio_snapshots")
      .select(
        `
        id,
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
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError !== null) {
      return Response.json(
        { error: `Failed to fetch snapshot: ${snapshotError.message}` },
        { status: 500 },
      );
    }

    if (snapshot === null) {
      return Response.json(
        { error: "No portfolio snapshot found" },
        { status: 404 },
      );
    }

    // Transform the response to match the expected format
    const holdings = (snapshot.holdings as Array<{
      symbol: string;
      name: string;
      quantity: number;
      avg_cost: number;
      current_price: number;
      current_value: number;
      unrealised_gain: number;
      unrealised_gain_pct: number;
      allocation_pct: number;
    }>) || [];

    const totals: PortfolioTotals = {
      totalValue: snapshot.total_value,
      totalCost: snapshot.total_cost,
      totalGain: snapshot.total_gain,
      totalGainPct: snapshot.total_gain_pct,
    };

    const mappedHoldings: Holding[] = holdings.map((h) => ({
      symbol: h.symbol,
      name: h.name,
      quantity: h.quantity,
      avgCost: h.avg_cost,
      currentPrice: h.current_price,
      currentValue: h.current_value,
      unrealisedGain: h.unrealised_gain,
      unrealisedGainPct: h.unrealised_gain_pct,
      allocationPct: h.allocation_pct,
    }));

    const response: LatestSnapshotResponse = {
      snapshotId: snapshot.id,
      totals,
      holdings: mappedHoldings,
      source: snapshot.source as "kite" | "groww",
      createdAt: snapshot.created_at,
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch snapshot" },
      { status: 500 },
    );
  }
}
