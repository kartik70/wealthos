import Papa from "papaparse";

import type { Holding } from "../../types/portfolio";

interface KiteCsvRow {
  Instrument?: string;
  "Qty."?: string;
  "Avg. cost"?: string;
  LTP?: string;
  Invested?: string;
  "Cur. val"?: string;
  "P&L"?: string;
  "Net chg."?: string;
  "Day chg."?: string;
}

interface ParsedHolding {
  holding: Omit<Holding, "allocationPct">;
  currentValue: number;
}

export function parseKiteCSV(csvString: string): Holding[] {
  const result = Papa.parse<KiteCsvRow>(csvString, {
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

  const parsedHoldings = result.data.flatMap((row, index) =>
    parseKiteRow(row, index + 2),
  );
  const totalCurrentValue = parsedHoldings.reduce(
    (total, parsedHolding) => total + parsedHolding.currentValue,
    0,
  );

  return parsedHoldings.map(({ holding, currentValue }) => ({
    ...holding,
    allocationPct:
      totalCurrentValue === 0 ? 0 : (currentValue / totalCurrentValue) * 100,
  }));
}

export const parseKiteCsv = parseKiteCSV;
export default parseKiteCSV;

function parseKiteRow(
  row: KiteCsvRow,
  rowNumber: number,
): ParsedHolding[] {
  const symbol = getRequiredText(row, "Instrument", rowNumber);
  const quantity = getRequiredNumber(row, "Qty.", rowNumber);

  if (quantity === 0) {
    return [];
  }

  const avgCost = getRequiredNumber(row, "Avg. cost", rowNumber);
  const currentPrice = getRequiredNumber(row, "LTP", rowNumber);
  const invested = getRequiredNumber(row, "Invested", rowNumber);
  const currentValue = getRequiredNumber(row, "Cur. val", rowNumber);
  const unrealisedGain = getRequiredNumber(row, "P&L", rowNumber);

  return [
    {
      holding: {
        symbol,
        name: symbol,
        quantity,
        avgCost,
        currentPrice,
        currentValue,
        unrealisedGain,
        unrealisedGainPct:
          invested === 0 ? 0 : (unrealisedGain / invested) * 100,
      },
      currentValue,
    },
  ];
}

function getRequiredText(
  row: KiteCsvRow,
  column: keyof KiteCsvRow,
  rowNumber: number,
): string {
  const value = row[column]?.trim();

  if (value === undefined || value === "") {
    throw new Error(`Missing ${column} in Kite CSV row ${rowNumber}`);
  }

  return value;
}

function getRequiredNumber(
  row: KiteCsvRow,
  column: keyof KiteCsvRow,
  rowNumber: number,
): number {
  const rawValue = getRequiredText(row, column, rowNumber);
  const value = parseCsvNumber(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(
      `Invalid numeric value for ${column} in Kite CSV row ${rowNumber}: ${rawValue}`,
    );
  }

  return value;
}

function parseCsvNumber(value: string): number {
  const trimmed = value.trim();
  const isParenthesizedNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const isNegative = trimmed.includes("-") || trimmed.includes("\u2212");
  const numeric = trimmed.replace(/[^0-9.]/g, "");

  if (numeric === "") {
    return Number.NaN;
  }

  const parsed = Number(numeric);
  return isParenthesizedNegative || isNegative ? -parsed : parsed;
}
