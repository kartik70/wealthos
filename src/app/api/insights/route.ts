import { generateInsight } from "../../../lib/ai/client";
import { requireAuth } from "@/lib/db/require-auth";
import {
  calcAllocationPct,
  calcPortfolioTotals,
} from "../../../lib/finance/calculations";
import { buildMutualFundPromptSection } from "../../../features/ai/promptBuilder";
import { getAIProviderFromRequest, isAIProvider } from "../../../lib/ai/provider";
import {
  getEffectiveApiKey,
  NO_API_KEY_CONFIGURED_MESSAGE,
} from "@/lib/ai/user-api-keys";
import type { Database, Json, MutualFundHoldingRow } from "../../../types/db";
import type { Holding, MutualFundHolding, MutualFundTotals } from "../../../types/portfolio";
import type { AIProvider } from "../../../lib/ai/provider";

export const runtime = "nodejs";

type HoldingRow = Database["public"]["Tables"]["holdings"]["Row"];
type SnapshotRow = Database["public"]["Tables"]["portfolio_snapshots"]["Row"];

interface InsightRequestBody {
  snapshotId: string;
  provider?: AIProvider;
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

    const auth = await requireAuth();
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase, userId } = auth.data;

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

    if (snapshot.user_id !== userId) {
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
    const mutualFundContext = await fetchMutualFundContextForDate(
      supabase,
      userId,
      snapshot.created_at,
    );
    const prompt = buildInsightPrompt(snapshot, metrics, mutualFundContext);
    const provider = getAIProviderFromRequest(request);
    const apiKey = await getEffectiveApiKey(userId, provider);

    if (apiKey === undefined) {
      return Response.json({ error: NO_API_KEY_CONFIGURED_MESSAGE }, { status: 400 });
    }

    const insight = await generateInsight(prompt, provider, apiKey);
    const { error: insertError } = await supabase.from("ai_insights").insert({
      snapshot_id: snapshot.id,
      user_id: userId,
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
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<InsightRequestBody>;

  return (
    typeof candidate.snapshotId === "string" &&
    candidate.snapshotId.trim() !== "" &&
    (candidate.provider === undefined || isAIProvider(candidate.provider))
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

async function fetchMutualFundContextForDate(
  supabase: Awaited<ReturnType<typeof import("@/lib/db/supabase").createSupabaseServerClient>>,
  userId: string,
  equityCreatedAt: string,
): Promise<{ totals: MutualFundTotals; holdings: MutualFundHolding[] } | null> {
  const snapshotDate = equityCreatedAt.split("T")[0];
  if (snapshotDate === undefined || snapshotDate === "") {
    return null;
  }

  const { data: mfSnapshot, error } = await supabase
    .from("mutual_fund_snapshots")
    .select(
      `
      total_invested,
      total_current_value,
      total_returns,
      total_returns_pct,
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
    .eq("snapshot_date", snapshotDate)
    .maybeSingle();

  if (error !== null || mfSnapshot === null) {
    return null;
  }

  const snapshotData = mfSnapshot as unknown as {
    total_invested: number;
    total_current_value: number;
    total_returns: number;
    total_returns_pct: number;
    mutual_fund_holdings: MutualFundHoldingRow[];
  };

  const holdings = (snapshotData.mutual_fund_holdings ?? []).map((row) => ({
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
  }));

  if (holdings.length === 0) {
    return null;
  }

  return {
    totals: {
      totalInvested: snapshotData.total_invested,
      totalCurrentValue: snapshotData.total_current_value,
      totalReturns: snapshotData.total_returns,
      totalReturnsPct: snapshotData.total_returns_pct,
    },
    holdings,
  };
}

function buildInsightPrompt(
  snapshot: SnapshotRow,
  metrics: PortfolioMetrics,
  mutualFundContext: { totals: MutualFundTotals; holdings: MutualFundHolding[] } | null,
): string {
  const promptPayload = {
    snapshot: {
      id: snapshot.id,
      createdAt: snapshot.created_at,
      source: snapshot.source,
    },
    metrics,
    mutualFunds: mutualFundContext,
  };

  const mutualFundSection =
    mutualFundContext !== null
      ? `\n\n${buildMutualFundPromptSection(
          mutualFundContext.totals,
          mutualFundContext.holdings,
        )}`
      : "";

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
${JSON.stringify(promptPayload, null, 2)}${mutualFundSection}`;
}
