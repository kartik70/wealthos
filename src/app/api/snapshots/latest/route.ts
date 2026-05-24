import { requireAuth } from "@/lib/db/require-auth";
import { calcCombinedPortfolio } from "@/lib/finance/combined";
import type { CombinedPortfolioResult } from "@/lib/finance/combined";
import type { MutualFundHoldingRow } from "@/types/db";
import type {
  Holding,
  InsightResponse,
  MutualFundHolding,
  MutualFundTotals,
  PortfolioTotals,
} from "@/types/portfolio";

export const runtime = "nodejs";

const DETAILED_SUMMARY_MARKER = "__DETAILED_INSIGHT__";

interface LatestEquitySnapshot {
  snapshotId: string;
  totals: PortfolioTotals;
  holdings: Holding[];
  source: "kite" | "groww";
  createdAt: string;
  insight?: InsightResponse;
}

interface LatestMutualFundSnapshot {
  snapshotId: string;
  snapshotDate: string;
  totals: MutualFundTotals;
  holdings: MutualFundHolding[];
  createdAt: string;
}

interface LatestSnapshotResponse {
  equity: LatestEquitySnapshot | null;
  mutualFund: LatestMutualFundSnapshot | null;
  combined: CombinedPortfolioResult | null;
}

export async function GET(): Promise<Response> {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase, userId } = auth.data;

    const [equityResult, mutualFundResult] = await Promise.all([
      supabase
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
        .maybeSingle(),
      supabase
        .from("mutual_fund_snapshots")
        .select(
          `
          id,
          snapshot_date,
          total_invested,
          total_current_value,
          total_returns,
          total_returns_pct,
          created_at,
          mutual_fund_holdings (
            scheme_name,
            amc,
            category,
            sub_category,
            folio_no,
            units,
            invested_value,
            current_value,
            returns,
            returns_pct,
            allocation_pct
          )
        `,
        )
        .eq("user_id", userId)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (equityResult.error !== null) {
      return Response.json(
        { error: `Failed to fetch equity snapshot: ${equityResult.error.message}` },
        { status: 500 },
      );
    }

    if (mutualFundResult.error !== null) {
      return Response.json(
        { error: `Failed to fetch mutual fund snapshot: ${mutualFundResult.error.message}` },
        { status: 500 },
      );
    }

    const equitySnapshot = equityResult.data;
    const mutualFundSnapshot = mutualFundResult.data;

    if (equitySnapshot === null && mutualFundSnapshot === null) {
      return Response.json(
        { error: "No portfolio snapshot found" },
        { status: 404 },
      );
    }

    let equity: LatestEquitySnapshot | null = null;

    if (equitySnapshot !== null) {
      const snapshotData = equitySnapshot as unknown as {
        id: string;
        total_value: number;
        total_cost: number;
        total_gain: number;
        total_gain_pct: number;
        source: string;
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
        }>;
      };

      const holdings: Holding[] = (snapshotData.holdings ?? []).map((holding) => ({
        symbol: holding.symbol,
        name: holding.name ?? holding.symbol,
        quantity: holding.quantity,
        avgCost: holding.avg_cost,
        currentPrice: holding.current_price,
        currentValue: holding.current_value,
        unrealisedGain: holding.unrealised_gain,
        unrealisedGainPct: holding.unrealised_gain_pct,
        allocationPct: holding.allocation_pct,
      }));

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
      }

      const insight =
        insightRow &&
        insightRow.summary &&
        insightRow.recommendations &&
        insightRow.alerts
          ? {
              summary: insightRow.summary as string,
              recommendations:
                insightRow.recommendations as unknown as InsightResponse["recommendations"],
              alerts: insightRow.alerts as unknown as InsightResponse["alerts"],
              generatedAt: insightRow.created_at || new Date().toISOString(),
            }
          : undefined;

      equity = {
        snapshotId: snapshotData.id,
        totals: {
          totalValue: snapshotData.total_value,
          totalCost: snapshotData.total_cost,
          totalGain: snapshotData.total_gain,
          totalGainPct: snapshotData.total_gain_pct,
        },
        holdings,
        source: snapshotData.source as "kite" | "groww",
        createdAt: snapshotData.created_at,
        insight,
      };
    }

    let mutualFund: LatestMutualFundSnapshot | null = null;

    if (mutualFundSnapshot !== null) {
      const snapshotData = mutualFundSnapshot as unknown as {
        id: string;
        snapshot_date: string;
        total_invested: number;
        total_current_value: number;
        total_returns: number;
        total_returns_pct: number;
        created_at: string;
        mutual_fund_holdings: MutualFundHoldingRow[];
      };

      mutualFund = {
        snapshotId: snapshotData.id,
        snapshotDate: snapshotData.snapshot_date,
        totals: {
          totalInvested: snapshotData.total_invested,
          totalCurrentValue: snapshotData.total_current_value,
          totalReturns: snapshotData.total_returns,
          totalReturnsPct: snapshotData.total_returns_pct,
        },
        holdings: (snapshotData.mutual_fund_holdings ?? []).map(mapMutualFundHoldingRow),
        createdAt: snapshotData.created_at,
      };
    }

    const combined =
      equity !== null || mutualFund !== null
        ? calcCombinedPortfolio(
            equity?.holdings ?? [],
            mutualFund?.holdings ?? [],
          )
        : null;

    const response: LatestSnapshotResponse = {
      equity,
      mutualFund,
      combined,
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch snapshot" },
      { status: 500 },
    );
  }
}

function mapMutualFundHoldingRow(row: MutualFundHoldingRow): MutualFundHolding {
  return {
    schemeName: row.scheme_name,
    amc: row.amc ?? "",
    category: row.category ?? "",
    subCategory: row.sub_category ?? "",
    folioNo: row.folio_no ?? "",
    units: row.units ?? 0,
    investedValue: row.invested_value ?? 0,
    currentValue: row.current_value ?? 0,
    returns: row.returns ?? 0,
    returnsPct: row.returns_pct ?? 0,
    allocationPct: row.allocation_pct ?? 0,
  };
}
