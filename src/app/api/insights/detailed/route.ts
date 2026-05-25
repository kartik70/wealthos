import { generateDetailedInsight } from "@/lib/ai/client";
import { requireAuth } from "@/lib/db/require-auth";
import { calcAllocationPct } from "@/lib/finance/calculations";
import { calcHealthScoreWithSectors } from "@/lib/finance/health";
import { classifySectors } from "@/lib/finance/sectors";
import { calcTaxSummary } from "@/lib/finance/tax";
import { buildDetailedInsightPrompt } from "@/features/ai/detailedPromptBuilder";
import { getAIProviderFromRequest, isAIProvider } from "@/lib/ai/provider";
import {
  getEffectiveApiKey,
  NO_API_KEY_CONFIGURED_MESSAGE,
} from "@/lib/ai/user-api-keys";
import type { Database, Json, MutualFundHoldingRow } from "@/types/db";
import type { AIProvider } from "@/lib/ai/provider";
import type {
  AssetAllocationEntry,
  DetailedInsightResponse,
  Holding,
  MutualFundHolding,
  MutualFundTotals,
  PortfolioSnapshot,
} from "@/types/portfolio";

export const runtime = "nodejs";

const DETAILED_SUMMARY_MARKER = "__DETAILED_INSIGHT__";

type SnapshotRow = Database["public"]["Tables"]["portfolio_snapshots"]["Row"];
type HoldingRow = Database["public"]["Tables"]["holdings"]["Row"];
type AiInsightRow = Database["public"]["Tables"]["ai_insights"]["Row"];

interface DetailedInsightRequestBody {
  snapshotId: string;
  provider?: AIProvider;
}

interface DetailedInsightResponseBody {
  snapshotId: string;
  insight: DetailedInsightResponse;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const snapshotId = url.searchParams.get("snapshotId");

    if (!snapshotId) {
      return Response.json(
        { error: "snapshotId query parameter is required" },
        { status: 400 },
      );
    }

    const auth = await requireAuth();
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase } = auth.data;

    const { data: row, error } = await supabase
      .from("ai_insights")
      .select("id,snapshot_id,user_id,created_at,summary,recommendations,alerts,trigger")
      .eq("snapshot_id", snapshotId)
      .eq("summary", DETAILED_SUMMARY_MARKER)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error !== null) {
      return Response.json(
        { error: `Failed to fetch detailed insight: ${error.message}` },
        { status: 500 },
      );
    }

    if (row === null) {
      return Response.json({ error: "Detailed insight not found" }, { status: 404 });
    }

    const parsed = parseDetailedInsightFromRow(row);
    if (parsed === null) {
      return Response.json(
        { error: "Stored detailed insight format is invalid" },
        { status: 500 },
      );
    }

    return Response.json({ snapshotId, insight: parsed } satisfies DetailedInsightResponseBody);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load detailed insights",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequestBody(request);

    if (!isDetailedInsightRequestBody(body)) {
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

    const holdings = calcAllocationPct((holdingRows ?? []).map(mapHoldingRow));

    if (holdings.length === 0) {
      return Response.json(
        { error: "Portfolio snapshot has no holdings" },
        { status: 400 },
      );
    }

    const provider = getAIProviderFromRequest(request);
    const apiKey = await getEffectiveApiKey(userId, provider);

    if (apiKey === undefined) {
      return Response.json({ error: NO_API_KEY_CONFIGURED_MESSAGE }, { status: 400 });
    }

    const anthropicApiKey = await getEffectiveApiKey(userId, "anthropic");
    const typedSnapshot = mapSnapshot(snapshot, holdings);
    const sectors = await classifySectors(holdings, anthropicApiKey);
    const healthScore = calcHealthScoreWithSectors(holdings, sectors);
    const taxSummary = calcTaxSummary(holdings);
    const mutualFundContext = await fetchMutualFundContextForDate(
      supabase,
      userId,
      snapshot.created_at,
    );
    const prompt = buildDetailedInsightPrompt({
      snapshot: typedSnapshot,
      holdings,
      healthScore,
      sectors,
      taxSummary,
      mutualFunds: mutualFundContext,
    });

    const insight = await generateDetailedInsight(prompt, provider, apiKey);
    // Never trust the model's generatedAt — overwrite with server time.
    insight.generatedAt = new Date().toISOString();

    const { error: insertError } = await supabase.from("ai_insights").insert({
      snapshot_id: snapshot.id,
      user_id: snapshot.user_id,
      summary: DETAILED_SUMMARY_MARKER,
      recommendations: {
        kind: "detailed_insight_v2",
        payload: insight,
      } as unknown as Json,
      alerts: [] as unknown as Json,
      trigger: "manual",
    });

    if (insertError !== null) {
      return Response.json(
        { error: `Failed to save detailed insight: ${insertError.message}` },
        { status: 500 },
      );
    }

    return Response.json({
      snapshotId: snapshot.id,
      insight,
    } satisfies DetailedInsightResponseBody);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate detailed insight",
      },
      { status: 500 },
    );
  }
}

function parseDetailedInsightFromRow(row: AiInsightRow): DetailedInsightResponse | null {
  if (typeof row.recommendations !== "object" || row.recommendations === null) {
    return null;
  }

  const rec = row.recommendations as Record<string, unknown>;
  if (rec.kind !== "detailed_insight_v2") {
    return null;
  }

  if (typeof rec.payload !== "object" || rec.payload === null) {
    return null;
  }

  const payload = rec.payload as Partial<DetailedInsightResponse>;
  if (
    typeof payload.portfolioStory !== "string" ||
    typeof payload.investorProfile !== "string" ||
    typeof payload.investorProfileReasoning !== "string" ||
    !Array.isArray(payload.stockVerdicts) ||
    !Array.isArray(payload.mfVerdicts) ||
    !Array.isArray(payload.priorityActions) ||
    typeof payload.equityStructure !== "object" ||
    payload.equityStructure === null ||
    typeof payload.mfStructure !== "object" ||
    payload.mfStructure === null ||
    typeof payload.combinedAnalysis !== "object" ||
    payload.combinedAnalysis === null ||
    typeof payload.taxOptimisation !== "object" ||
    payload.taxOptimisation === null
  ) {
    return null;
  }

  return payload as DetailedInsightResponse;
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isDetailedInsightRequestBody(value: unknown): value is DetailedInsightRequestBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<DetailedInsightRequestBody>;

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

function mapSnapshot(snapshot: SnapshotRow, holdings: Holding[]): PortfolioSnapshot {
  return {
    id: snapshot.id,
    userId: snapshot.user_id,
    createdAt: snapshot.created_at,
    totalValue: snapshot.total_value,
    totalCost: snapshot.total_cost,
    totalGain: snapshot.total_gain,
    totalGainPct: snapshot.total_gain_pct,
    source: (snapshot.source ?? "manual") as PortfolioSnapshot["source"],
    holdings,
  };
}

async function fetchMutualFundContextForDate(
  supabase: Awaited<ReturnType<typeof import("@/lib/db/supabase").createSupabaseServerClient>>,
  userId: string,
  equityCreatedAt: string,
): Promise<{
  totals: MutualFundTotals;
  holdings: MutualFundHolding[];
  assetAllocation: AssetAllocationEntry[];
} | null> {
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

  const holdings: MutualFundHolding[] = (snapshotData.mutual_fund_holdings ?? []).map(
    (row) => ({
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
    }),
  );

  if (holdings.length === 0) {
    return null;
  }

  const totals: MutualFundTotals = {
    totalInvested: snapshotData.total_invested,
    totalCurrentValue: snapshotData.total_current_value,
    totalReturns: snapshotData.total_returns,
    totalReturnsPct: snapshotData.total_returns_pct,
  };

  return {
    totals,
    holdings,
    assetAllocation: bucketAssetAllocation(holdings, totals.totalCurrentValue),
  };
}

function bucketAssetAllocation(
  holdings: MutualFundHolding[],
  totalValue: number,
): AssetAllocationEntry[] {
  const buckets = new Map<string, number>();

  for (const holding of holdings) {
    const type = classifyAssetType(holding);
    buckets.set(type, (buckets.get(type) ?? 0) + holding.currentValue);
  }

  return Array.from(buckets.entries()).map(([type, value]) => ({
    type,
    allocationPct:
      totalValue > 0 ? Math.round((value / totalValue) * 10000) / 100 : 0,
  }));
}

function classifyAssetType(holding: MutualFundHolding): string {
  const haystack = `${holding.category} ${holding.subCategory} ${holding.schemeName}`.toLowerCase();

  if (/(gold|silver)/.test(haystack)) {
    return "Gold";
  }
  if (/(debt|liquid|money market|gilt|bond|overnight|corporate)/.test(haystack)) {
    return "Debt";
  }
  if (/hybrid|balanced|aggressive|conservative|multi[- ]?asset/.test(haystack)) {
    return "Hybrid";
  }
  if (
    /(equity|elss|large|mid|small|flexi|multi[- ]?cap|index|nifty|sensex|international|focus|value|contra|dividend|thematic|sector)/.test(
      haystack,
    )
  ) {
    return "Equity";
  }
  return "Other";
}
