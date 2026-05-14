import {  createSupabaseServerClient } from "../../../lib/db/supabase";
import {
  calcAllocationPct,
  calcPortfolioTotals,
} from "../../../lib/finance/calculations";
import { parseKiteCSV } from "../../../lib/parsers/kite";
import type { Database } from "../../../types/db";

export const runtime = "nodejs";

type SnapshotSource = "kite" | "groww";
type HoldingInsert = Database["public"]["Tables"]["holdings"]["Insert"];
type SnapshotInsert = Database["public"]["Tables"]["portfolio_snapshots"]["Insert"];

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
    const file = readCsvFile(formData);
    const reportDate = readReportDate(formData);
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
    const supabase = await createSupabaseServerClient();
    const userId = "local-dev-user";

    // Check if a snapshot already exists for the same date
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: existingSnapshots, error: checkError } = await supabase
      .from("portfolio_snapshots")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", startOfDay.toISOString())
      .lt("created_at", endOfDay.toISOString());

    if (checkError !== null) {
      return Response.json(
        { error: `Failed to check existing snapshots: ${checkError.message}` },
        { status: 500 },
      );
    }

    if (existingSnapshots && existingSnapshots.length > 0) {
      const formatter = new Intl.DateTimeFormat("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const existingDate = formatter.format(new Date(reportDate));
      return Response.json(
        {
          error: `A snapshot for ${existingDate} already exists. Please choose a different date.`,
        },
        { status: 400 },
      );
    }

    const snapshotInsert: SnapshotInsert = {
      user_id: userId,
      total_value: totals.totalValue,
      total_cost: totals.totalCost,
      total_gain: totals.totalGain,
      total_gain_pct: totals.totalGainPct,
      source,
      created_at: new Date(reportDate).toISOString(),
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
    const { error: holdingsError } = await supabase
      .from("holdings")
      .insert(holdingRows);

    if (holdingsError !== null) {
      return Response.json(
        { error: `Failed to save holdings: ${holdingsError.message}` },
        { status: 500 },
      );
    }

    return Response.json(
      {
        snapshotId: snapshot.id,
        totals,
        holdings,
        persisted: true,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}

function readSource(formData: FormData): SnapshotSource {
  const source = formData.get("source");

  if (source !== "kite" && source !== "groww") {
    throw new Error("source must be either kite or groww");
  }

  return source;
}

function readCsvFile(formData: FormData): File {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("CSV file is required in the file field");
  }

  if (file.size === 0) {
    throw new Error("CSV file is empty");
  }

  return file;
}

function readReportDate(formData: FormData): string {
  const reportDate = formData.get("reportDate");

  if (typeof reportDate !== "string" || reportDate.trim() === "") {
    throw new Error("reportDate is required");
  }

  // Validate it's a valid date string (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new Error("reportDate must be in YYYY-MM-DD format");
  }

  return reportDate;
}
