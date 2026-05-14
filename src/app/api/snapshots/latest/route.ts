import { createSupabaseServerClient } from "@/lib/db/supabase";
import type { Database } from "@/types/db";
import type { Holding, PortfolioTotals, InsightResponse } from "@/types/portfolio";

export const runtime = "nodejs";

const DETAILED_SUMMARY_MARKER = "__DETAILED_INSIGHT__";

interface LatestSnapshotResponse {
  snapshotId: string;
  totals: PortfolioTotals;
  holdings: Holding[];
  source: "kite" | "groww";
  createdAt: string;
  insight?: InsightResponse;
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
    const snapshotData = snapshot as unknown as {
      id: string;
      total_value: number;
      total_cost: number;
      total_gain: number;
      total_gain_pct: number;
      source: string;
      created_at: string;
      holdings: Array<{
        symbol: string;
        name: string;
        quantity: number;
        avg_cost: number;
        current_price: number;
        current_value: number;
        unrealised_gain: number;
        unrealised_gain_pct: number;
        allocation_pct: number;
      }>;
    };

    const holdings = snapshotData.holdings || [];

    const totals: PortfolioTotals = {
      totalValue: snapshotData.total_value,
      totalCost: snapshotData.total_cost,
      totalGain: snapshotData.total_gain,
      totalGainPct: snapshotData.total_gain_pct,
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

    // Fetch the most recent insight for this snapshot
    const { data: insightRow, error: insightError } = await supabase
      .from("ai_insights")
      .select("summary,recommendations,alerts,created_at")
      .eq("snapshot_id", snapshotData.id)
      .neq("summary", DETAILED_SUMMARY_MARKER)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (insightError !== null) {
      console.error("Failed to fetch insight:", insightError.message);
      // Don't fail the entire request if insight fetch fails
    }

    const insight =
      insightRow && insightRow.summary && insightRow.recommendations && insightRow.alerts
        ? {
            summary: insightRow.summary as string,
            recommendations: insightRow.recommendations as unknown as InsightResponse["recommendations"],
            alerts: insightRow.alerts as unknown as InsightResponse["alerts"],
            generatedAt: insightRow.created_at || new Date().toISOString(),
          }
        : undefined;

    const response: LatestSnapshotResponse = {
      snapshotId: snapshotData.id,
      totals,
      holdings: mappedHoldings,
      source: snapshotData.source as "kite" | "groww",
      createdAt: snapshotData.created_at,
      insight,
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch snapshot" },
      { status: 500 },
    );
  }
}
