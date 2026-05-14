import Papa from "papaparse";

import type { Holding } from "../../types/portfolio";

type KiteCsvRow = Record<string, string | undefined>;

const HEADER_ALIASES = {
  symbol: [
    "instrument",
    "tradingsymbol",
    "trading symbol",
    "symbol",
    "ticker",
  ],
  name: ["name", "company", "company name", "instrument name", "stock name"],
  quantity: ["qty", "qty.", "quantity", "shares", "holding qty", "holdings"],
  avgCost: [
    "avg cost",
    "avg. cost",
    "average cost",
    "avg price",
    "avg. price",
    "average price",
    "buy avg",
  ],
  currentPrice: [
    "ltp",
    "last traded price",
    "last price",
    "current price",
    "market price",
  ],
  currentValue: [
    "cur val",
    "cur. val",
    "current value",
    "market value",
    "value",
  ],
  unrealisedGain: [
    "p&l",
    "pnl",
    "profit and loss",
    "unrealised gain",
    "unrealized gain",
    "unrealised pnl",
    "unrealized pnl",
  ],
  unrealisedGainPct: [
    "net chg",
    "net chg.",
    "net change",
    "p&l %",
    "pnl %",
    "unrealised gain %",
    "unrealized gain %",
    "unrealised pnl %",
    "unrealized pnl %",
  ],
} as const satisfies Record<string, readonly string[]>;

type FieldName = keyof typeof HEADER_ALIASES;

interface ParsedHoldingBase {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  unrealisedGain: number;
  unrealisedGainPct: number;
}

export function parseKiteCsv(csv: string): Holding[] {
  const result = Papa.parse<KiteCsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(
      `Failed to parse Kite CSV: ${result.errors
        .map((error) => error.message)
        .join("; ")}`,
    );
  }

  const rows = result.data.filter((row) =>
    Object.values(row).some((value) => value !== undefined && value.trim() !== ""),
  );

  const holdings = rows.map(parseRow);
  const totalValue = holdings.reduce(
    (total, holding) => total + holding.currentValue,
    0,
  );

  return holdings.map((holding) => ({
    ...holding,
    allocationPct:
      totalValue === 0 ? 0 : roundToTwo((holding.currentValue / totalValue) * 100),
  }));
}

export default parseKiteCsv;
export const parseKiteCSV = parseKiteCsv;
export const parseKiteHoldingsCsv = parseKiteCsv;

function parseRow(row: KiteCsvRow, index: number): ParsedHoldingBase {
  const rowNumber = index + 2;
  const symbol = getRequiredText(row, "symbol", rowNumber);
  const name = getOptionalText(row, "name") ?? symbol;
  const quantity = getRequiredNumber(row, "quantity", rowNumber);
  const avgCost = getRequiredNumber(row, "avgCost", rowNumber);
  const currentPrice = getRequiredNumber(row, "currentPrice", rowNumber);
  const currentValue =
    getOptionalNumber(row, "currentValue") ?? roundToTwo(quantity * currentPrice);
  const unrealisedGain =
    getOptionalNumber(row, "unrealisedGain") ??
    roundToTwo(currentValue - quantity * avgCost);
  const totalCost = quantity * avgCost;
  const unrealisedGainPct =
    getOptionalNumber(row, "unrealisedGainPct") ??
    (totalCost === 0 ? 0 : roundToTwo((unrealisedGain / totalCost) * 100));

  return {
    symbol,
    name,
    quantity,
    avgCost,
    currentPrice,
    currentValue,
    unrealisedGain,
    unrealisedGainPct,
  };
}

function getRequiredText(
  row: KiteCsvRow,
  field: FieldName,
  rowNumber: number,
): string {
  const value = getOptionalText(row, field);

  if (value === undefined) {
    throw new Error(`Missing ${field} in Kite CSV row ${rowNumber}`);
  }

  return value;
}

function getOptionalText(row: KiteCsvRow, field: FieldName): string | undefined {
  const value = findValue(row, field)?.trim();
  return value === "" ? undefined : value;
}

function getRequiredNumber(
  row: KiteCsvRow,
  field: FieldName,
  rowNumber: number,
): number {
  const value = getOptionalNumber(row, field);

  if (value === undefined) {
    throw new Error(`Missing ${field} in Kite CSV row ${rowNumber}`);
  }

  return value;
}

function getOptionalNumber(
  row: KiteCsvRow,
  field: FieldName,
): number | undefined {
  const rawValue = findValue(row, field);

  if (rawValue === undefined || rawValue.trim() === "") {
    return undefined;
  }

  const value = parseCsvNumber(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${field} value in Kite CSV: ${rawValue}`);
  }

  return value;
}

function findValue(row: KiteCsvRow, field: FieldName): string | undefined {
  const aliases: readonly string[] = HEADER_ALIASES[field];
  const match = Object.entries(row).find(([header]) =>
    aliases.includes(normalizeHeader(header)),
  );

  return match?.[1];
}

function normalizeHeader(header: string): string {
  return header
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseCsvNumber(value: string): number {
  const trimmed = value.trim();
  const isParenthesizedNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const isExplicitNegative = trimmed.includes("-");
  const numeric = trimmed.replace(/[^0-9.]/g, "");

  if (numeric === "") {
    return Number.NaN;
  }

  const parsed = Number(numeric);
  return isParenthesizedNegative || isExplicitNegative ? -parsed : parsed;
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
