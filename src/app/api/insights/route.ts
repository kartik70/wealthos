import { generateInsight } from "../../../lib/ai/client";
import { requireAuth } from "@/lib/db/require-auth";
import {
  calcAllocationPct,
  calcPortfolioTotals,
} from "../../../lib/finance/calculations";
import { buildPortfolioPrompt } from "../../../features/ai/promptBuilder";
import { getAIProviderFromRequest, isAIProvider } from "../../../lib/ai/provider";
import {
  missingApiKeyResponse,
  resolveProviderKey,
} from "@/lib/ai/keyResolver";
import type { Database, Json, MutualFundHoldingRow } from "../../../types/db";
import type {
  Holding,
  MutualFundHolding,
  MutualFundTotals,
} from "../../../types/portfolio";
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
      .select("id,user_id,created_at,total_value,total_cost,total_gain,total_gain_pct,source,raw_data,context_cache")
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
    const apiKey = await resolveProviderKey(userId, provider);

    const insight = await generateInsight(prompt, provider, apiKey);
    // Never trust the model's generatedAt — overwrite with server time.
    insight.generatedAt = new Date().toISOString();
    const persistedPayload = {
      investorRiskProfile: insight.investorRiskProfile,
      stockVerdicts: insight.stockVerdicts,
      mfVerdicts: insight.mfVerdicts,
      portfolioStructure: insight.portfolioStructure,
      taxSummary: insight.taxSummary,
      priorityActions: insight.priorityActions,
    };
    const { error: insertError } = await supabase.from("ai_insights").insert({
      snapshot_id: snapshot.id,
      user_id: userId,
      summary: insight.summary,
      recommendations: persistedPayload as unknown as Json,
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
    const keyResponse = missingApiKeyResponse(error);
    if (keyResponse !== null) {
      return keyResponse;
    }
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
  return buildPortfolioPrompt({
    snapshot: {
      id: snapshot.id,
      createdAt: snapshot.created_at,
      totalValue: metrics.totalValue,
      totalCost: metrics.totalCost,
      totalGain: metrics.totalGain,
      totalGainPct: metrics.totalGainPct,
      source: (snapshot.source ?? "manual") as "kite" | "groww" | "manual",
    },
    holdings: metrics.holdings,
    mfTotals: mutualFundContext?.totals,
    mfHoldings: mutualFundContext?.holdings,
  });
}
