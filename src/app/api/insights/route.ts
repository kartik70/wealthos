import { generateInsight } from "../../../lib/ai/client";
import { createSupabaseServerClient } from "../../../lib/db/supabase";
import {
  calcAllocationPct,
  calcPortfolioTotals,
} from "../../../lib/finance/calculations";
import type { Database, Json } from "../../../types/db";
import type { Holding } from "../../../types/portfolio";

export const runtime = "nodejs";

type HoldingRow = Database["public"]["Tables"]["holdings"]["Row"];
type SnapshotRow = Database["public"]["Tables"]["portfolio_snapshots"]["Row"];

interface InsightRequestBody {
  snapshotId: string;
}

interface PortfolioMetrics {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  holdings: Holding[];
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequestBody(request);

    if (!isInsightRequestBody(body)) {
      return Response.json(
        { error: "Request body must include snapshotId" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: snapshot, error: snapshotError } = await supabase
      .from("portfolio_snapshots")
      .select("id,user_id,created_at,total_value,total_cost,total_gain,total_gain_pct,source,raw_data")
      .eq("id", body.snapshotId)
      .maybeSingle();

    if (snapshotError !== null) {
      return Response.json(
        { error: `Failed to fetch portfolio snapshot: ${snapshotError.message}` },
        { status: 500 },
      );
    }

    if (snapshot === null) {
      return Response.json({ error: "Portfolio snapshot not found" }, { status: 404 });
    }

    const { data: holdingRows, error: holdingsError } = await supabase
      .from("holdings")
      .select("id,snapshot_id,symbol,name,quantity,avg_cost,current_price,current_value,unrealised_gain,unrealised_gain_pct,allocation_pct")
      .eq("snapshot_id", body.snapshotId)
      .order("symbol", { ascending: true });

    if (holdingsError !== null) {
      return Response.json(
        { error: `Failed to fetch holdings: ${holdingsError.message}` },
        { status: 500 },
      );
    }

    const holdings = (holdingRows ?? []).map(mapHoldingRow);

    if (holdings.length === 0) {
      return Response.json(
        { error: "Portfolio snapshot has no holdings" },
        { status: 400 },
      );
    }

    const metrics = calculatePortfolioMetrics(holdings);
    const prompt = buildInsightPrompt(snapshot, metrics);
    const insight = await generateInsight(prompt);
    const { error: insertError } = await supabase.from("ai_insights").insert({
      snapshot_id: snapshot.id,
      user_id: "local-dev-user",
      summary: insight.summary,
      recommendations: insight.recommendations as unknown as Json,
      alerts: insight.alerts as unknown as Json,
      trigger: "manual",
    });

    if (insertError !== null) {
      return Response.json(
        { error: `Failed to save insight: ${insertError.message}` },
        { status: 500 },
      );
    }

    return Response.json(insight);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate insight" },
      { status: 500 },
    );
  }
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isInsightRequestBody(value: unknown): value is InsightRequestBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "snapshotId" in value &&
    typeof value.snapshotId === "string" &&
    value.snapshotId.trim() !== ""
  );
}

function mapHoldingRow(row: HoldingRow): Holding {
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

function calculatePortfolioMetrics(holdings: Holding[]): PortfolioMetrics {
  const holdingsWithAllocation = calcAllocationPct(holdings);
  const totals = calcPortfolioTotals(holdingsWithAllocation);

  return {
    ...totals,
    holdings: holdingsWithAllocation,
  };
}

function buildInsightPrompt(
  snapshot: SnapshotRow,
  metrics: PortfolioMetrics,
): string {
  const promptPayload = {
    snapshot: {
      id: snapshot.id,
      createdAt: snapshot.created_at,
      source: snapshot.source,
    },
    metrics,
  };

  return `You are the interpretation layer for WealthOS, a personal portfolio intelligence product.

Do not calculate returns, P&L, allocation percentages, tax liability, risk metrics, or concentration ratios. Use only the pre-calculated numbers provided below.

Return only valid JSON matching this TypeScript interface:
{
  "summary": string,
  "recommendations": Array<{
    "action": "BUY" | "SELL" | "HOLD" | "REVIEW",
    "symbol": string,
    "reason": string,
    "priority": "LOW" | "MEDIUM" | "HIGH"
  }>,
  "alerts": Array<{
    "type": "CONCENTRATION" | "TAX" | "LOSS" | "GOAL" | "REBALANCE",
    "message": string,
    "urgency": "INFO" | "WARNING" | "ACTION_NEEDED"
  }>,
  "generatedAt": string
}

Use generatedAt as the current ISO timestamp. Keep the output concise and factual. This is not financial advice and must not predict prices.

Pre-calculated portfolio data:
${JSON.stringify(promptPayload, null, 2)}`;
}
