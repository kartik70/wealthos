import { requireAuth } from "@/lib/db/require-auth";

export const runtime = "nodejs";

const CSV_HEADERS = [
  "symbol",
  "name",
  "quantity",
  "avg_cost",
  "current_price",
  "current_value",
  "unrealised_gain",
  "unrealised_gain_pct",
  "allocation_pct",
] as const;

type HoldingExportRow = {
  symbol: string;
  name: string | null;
  quantity: number;
  avg_cost: number;
  current_price: number;
  current_value: number;
  unrealised_gain: number;
  unrealised_gain_pct: number;
  allocation_pct: number;
};

export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  const { data: snapshot, error: snapshotError } = await supabase
    .from("portfolio_snapshots")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError !== null) {
    return Response.json(
      { error: `Failed to fetch latest snapshot: ${snapshotError.message}` },
      { status: 500 },
    );
  }

  if (snapshot === null) {
    return Response.json({ error: "No portfolio snapshot found" }, { status: 404 });
  }

  const { data: holdings, error: holdingsError } = await supabase
    .from("holdings")
    .select(
      "symbol, name, quantity, avg_cost, current_price, current_value, unrealised_gain, unrealised_gain_pct, allocation_pct",
    )
    .eq("snapshot_id", snapshot.id)
    .order("symbol", { ascending: true });

  if (holdingsError !== null) {
    return Response.json(
      { error: `Failed to fetch holdings: ${holdingsError.message}` },
      { status: 500 },
    );
  }

  const rows = (holdings ?? []) as HoldingExportRow[];
  const csv = buildHoldingsCsv(rows);
  const snapshotDate = snapshot.created_at.split("T")[0] ?? "export";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wealthos-holdings-${snapshotDate}.csv"`,
    },
  });
}

function buildHoldingsCsv(rows: HoldingExportRow[]): string {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      [
        row.symbol,
        row.name ?? row.symbol,
        row.quantity,
        row.avg_cost,
        row.current_price,
        row.current_value,
        row.unrealised_gain,
        row.unrealised_gain_pct,
        row.allocation_pct,
      ]
        .map(formatCsvCell)
        .join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

function formatCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
