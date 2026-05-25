import { requireAuth } from "@/lib/db/require-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase";
import {
  calcAllocationPct,
  calcPortfolioTotals,
} from "../../../lib/finance/calculations";
import { parseGrowwXLSX } from "../../../lib/parsers/groww";
import { parseKiteCSV } from "../../../lib/parsers/kite";
import { embedSnapshot } from "../../../lib/ai/embeddings";
import { buildSnapshotContextString } from "../../../lib/ai/contextBuilder";
import type { Database } from "../../../types/db";

export const runtime = "nodejs";

type SnapshotSource = "kite" | "groww";
type HoldingInsert = Database["public"]["Tables"]["holdings"]["Insert"];
type SnapshotInsert = Database["public"]["Tables"]["portfolio_snapshots"]["Insert"];
type MutualFundSnapshotInsert =
  Database["public"]["Tables"]["mutual_fund_snapshots"]["Insert"];
type MutualFundHoldingInsert =
  Database["public"]["Tables"]["mutual_fund_holdings"]["Insert"];

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type");

    if (contentType === null || !contentType.includes("multipart/form-data")) {
      return Response.json(
        { error: "Request must be multipart/form-data" },
        { status: 415 },
      );
    }

    const formData = await request.formData();
    const source = readSource(formData);

    if (source === "groww") {
      return handleGrowwUpload(formData);
    }

    return handleKiteUpload(formData);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}

async function handleKiteUpload(formData: FormData): Promise<Response> {
  const file = readKiteCsvFile(formData);
  const reportDateInput = readReportDate(formData);
  const csvString = await file.text();
  const parsedHoldings = parseKiteCSV(csvString);

  if (parsedHoldings.length === 0) {
    return Response.json(
      { error: "CSV did not contain any active holdings" },
      { status: 400 },
    );
  }

  const holdings = calcAllocationPct(parsedHoldings);
  const totals = calcPortfolioTotals(holdings);
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  const reportDate = new Date(formData.get("reportDate") as string);
  const dateStr = reportDate.toISOString().split("T")[0];

  const { data: existing, error: checkError } = await supabase
    .from("portfolio_snapshots")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", `${dateStr}T00:00:00+05:30`)
    .lt("created_at", `${dateStr}T23:59:59+05:30`)
    .maybeSingle();

  if (checkError !== null) {
    return Response.json(
      { error: `Failed to check existing snapshots: ${checkError.message}` },
      { status: 500 },
    );
  }

  if (existing !== null) {
    const replaced = await replaceExistingEquitySnapshot(
      supabase,
      existing.id,
      formData,
      reportDate,
    );
    if (replaced instanceof Response) {
      return replaced;
    }
  }

  const snapshotInsert: SnapshotInsert = {
    user_id: userId,
    total_value: totals.totalValue,
    total_cost: totals.totalCost,
    total_gain: totals.totalGain,
    total_gain_pct: totals.totalGainPct,
    source: "kite",
    created_at: new Date(reportDateInput).toISOString(),
    raw_data: null,
  };
  const { data: snapshot, error: snapshotError } = await supabase
    .from("portfolio_snapshots")
    .insert(snapshotInsert)
    .select("id")
    .single();

  if (snapshotError !== null) {
    return Response.json(
      { error: `Failed to create portfolio snapshot: ${snapshotError.message}` },
      { status: 500 },
    );
  }

  if (snapshot === null) {
    return Response.json(
      { error: "Portfolio snapshot was not created" },
      { status: 500 },
    );
  }

  const holdingRows: HoldingInsert[] = holdings.map((holding) => ({
    snapshot_id: snapshot.id,
    symbol: holding.symbol,
    name: holding.name,
    quantity: holding.quantity,
    avg_cost: holding.avgCost,
    current_price: holding.currentPrice,
    current_value: holding.currentValue,
    unrealised_gain: holding.unrealisedGain,
    unrealised_gain_pct: holding.unrealisedGainPct,
    allocation_pct: holding.allocationPct,
  }));
  const { error: holdingsError } = await supabase.from("holdings").insert(holdingRows);

  if (holdingsError !== null) {
    return Response.json(
      { error: `Failed to save holdings: ${holdingsError.message}` },
      { status: 500 },
    );
  }

  const snapshotForEmbed = {
    id: snapshot.id,
    userId,
    createdAt: snapshotInsert.created_at ?? new Date().toISOString(),
    totalValue: totals.totalValue,
    totalCost: totals.totalCost,
    totalGain: totals.totalGain,
    totalGainPct: totals.totalGainPct,
    holdings,
    source: "kite" as const,
  };

  const contextCache = buildSnapshotContextString(snapshotForEmbed, holdings);
  const { error: contextCacheError } = await supabase
    .from("portfolio_snapshots")
    .update({ context_cache: contextCache })
    .eq("id", snapshot.id);
  if (contextCacheError !== null) {
    console.error(
      "Failed to persist snapshot context cache:",
      contextCacheError.message,
    );
  }

  embedSnapshot(snapshotForEmbed, holdings, undefined, userId).catch(
    (err: unknown) => {
      console.error("embedSnapshot failed silently:", err);
    },
  );

  return Response.json(
    {
      snapshotId: snapshot.id,
      totals,
      holdings,
      persisted: true,
      assetType: "equity",
    },
    { status: 201 },
  );
}

async function handleGrowwUpload(formData: FormData): Promise<Response> {
  const file = readGrowwXlsxFile(formData);
  const buffer = await file.arrayBuffer();
  const parsed = parseGrowwXLSX(buffer);

  if (parsed.holdings.length === 0) {
    return Response.json(
      { error: "XLSX did not contain any mutual fund holdings" },
      { status: 400 },
    );
  }

  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  const snapshotDate = parsed.snapshotDate;
  const totalReturnsPct =
    parsed.totalInvested === 0
      ? 0
      : (parsed.totalReturns / parsed.totalInvested) * 100;

  const { data: existing, error: checkError } = await supabase
    .from("mutual_fund_snapshots")
    .select("id")
    .eq("user_id", userId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle();

  if (checkError !== null) {
    return Response.json(
      { error: `Failed to check existing mutual fund snapshots: ${checkError.message}` },
      { status: 500 },
    );
  }

  if (existing !== null) {
    const replaced = await replaceExistingMutualFundSnapshot(
      supabase,
      existing.id,
      formData,
      snapshotDate,
    );
    if (replaced instanceof Response) {
      return replaced;
    }
  }

  const snapshotInsert: MutualFundSnapshotInsert = {
    user_id: userId,
    snapshot_date: snapshotDate,
    total_invested: parsed.totalInvested,
    total_current_value: parsed.totalCurrentValue,
    total_returns: parsed.totalReturns,
    total_returns_pct: totalReturnsPct,
  };

  const { data: snapshot, error: snapshotError } = await supabase
    .from("mutual_fund_snapshots")
    .insert(snapshotInsert)
    .select("id")
    .single();

  if (snapshotError !== null) {
    return Response.json(
      { error: `Failed to create mutual fund snapshot: ${snapshotError.message}` },
      { status: 500 },
    );
  }

  if (snapshot === null) {
    return Response.json(
      { error: "Mutual fund snapshot was not created" },
      { status: 500 },
    );
  }

  const holdingRows: MutualFundHoldingInsert[] = parsed.holdings.map((holding) => ({
    snapshot_id: snapshot.id,
    scheme_name: holding.schemeName,
    amc: holding.amc,
    category: holding.category,
    sub_category: holding.subCategory,
    folio_no: holding.folioNo,
    units: holding.units,
    invested_value: holding.investedValue,
    current_value: holding.currentValue,
    returns: holding.returns,
    returns_pct: holding.returnsPct,
    allocation_pct: holding.allocationPct,
  }));

  const { error: holdingsError } = await supabase
    .from("mutual_fund_holdings")
    .insert(holdingRows);

  if (holdingsError !== null) {
    return Response.json(
      { error: `Failed to save mutual fund holdings: ${holdingsError.message}` },
      { status: 500 },
    );
  }

  return Response.json(
    {
      mutualFundSnapshotId: snapshot.id,
      snapshotDate,
      totals: {
        totalInvested: parsed.totalInvested,
        totalCurrentValue: parsed.totalCurrentValue,
        totalReturns: parsed.totalReturns,
        totalReturnsPct,
      },
      holdingsCount: parsed.holdings.length,
      persisted: true,
      assetType: "mutual_fund",
    },
    { status: 201 },
  );
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function replaceExistingEquitySnapshot(
  supabase: ServerSupabaseClient,
  snapshotId: string,
  formData: FormData,
  reportDate: Date,
): Promise<true | Response> {
  const shouldReplace = formData.get("replace") === "true";

  if (!shouldReplace) {
    const formatter = new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const existingDate = formatter.format(reportDate);
    return Response.json(
      {
        error: `A snapshot for ${existingDate} already exists. Please choose a different date.`,
      },
      { status: 400 },
    );
  }

  const { error: holdingsDeleteError } = await supabase
    .from("holdings")
    .delete()
    .eq("snapshot_id", snapshotId);

  if (holdingsDeleteError !== null) {
    return Response.json(
      { error: `Failed to delete existing holdings: ${holdingsDeleteError.message}` },
      { status: 500 },
    );
  }

  const { error: insightsDeleteError } = await supabase
    .from("ai_insights")
    .delete()
    .eq("snapshot_id", snapshotId);

  if (insightsDeleteError !== null) {
    return Response.json(
      { error: `Failed to delete existing insights: ${insightsDeleteError.message}` },
      { status: 500 },
    );
  }

  const { error: snapshotDeleteError } = await supabase
    .from("portfolio_snapshots")
    .delete()
    .eq("id", snapshotId);

  if (snapshotDeleteError !== null) {
    return Response.json(
      { error: `Failed to delete existing snapshot: ${snapshotDeleteError.message}` },
      { status: 500 },
    );
  }

  return true;
}

async function replaceExistingMutualFundSnapshot(
  supabase: ServerSupabaseClient,
  snapshotId: string,
  formData: FormData,
  snapshotDate: string,
): Promise<true | Response> {
  const shouldReplace = formData.get("replace") === "true";

  if (!shouldReplace) {
    const formatter = new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const existingDate = formatter.format(new Date(snapshotDate));
    return Response.json(
      {
        error: `A mutual fund snapshot for ${existingDate} already exists. Please choose a different date.`,
      },
      { status: 400 },
    );
  }

  const { error: holdingsDeleteError } = await supabase
    .from("mutual_fund_holdings")
    .delete()
    .eq("snapshot_id", snapshotId);

  if (holdingsDeleteError !== null) {
    return Response.json(
      {
        error: `Failed to delete existing mutual fund holdings: ${holdingsDeleteError.message}`,
      },
      { status: 500 },
    );
  }

  const { error: snapshotDeleteError } = await supabase
    .from("mutual_fund_snapshots")
    .delete()
    .eq("id", snapshotId);

  if (snapshotDeleteError !== null) {
    return Response.json(
      { error: `Failed to delete existing mutual fund snapshot: ${snapshotDeleteError.message}` },
      { status: 500 },
    );
  }

  return true;
}

function readSource(formData: FormData): SnapshotSource {
  const source = formData.get("source");

  if (source !== "kite" && source !== "groww") {
    throw new Error("source must be either kite or groww");
  }

  return source;
}

function readKiteCsvFile(formData: FormData): File {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("CSV file is required in the file field");
  }

  if (file.size === 0) {
    throw new Error("CSV file is empty");
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".csv")) {
    throw new Error("Kite upload requires a .csv file");
  }

  return file;
}

function readGrowwXlsxFile(formData: FormData): File {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("XLSX file is required in the file field");
  }

  if (file.size === 0) {
    throw new Error("XLSX file is empty");
  }

  const fileName = file.name.toLowerCase();
  const isXlsx =
    fileName.endsWith(".xlsx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (!isXlsx) {
    throw new Error("Groww upload requires an .xlsx file");
  }

  return file;
}

function readReportDate(formData: FormData): string {
  const reportDate = formData.get("reportDate");

  if (typeof reportDate !== "string" || reportDate.trim() === "") {
    throw new Error("reportDate is required");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new Error("reportDate must be in YYYY-MM-DD format");
  }

  return reportDate;
}
