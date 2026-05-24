import * as XLSX from "xlsx";

import type { MutualFundHolding } from "../../types/portfolio";

const SUMMARY_ROW_START = 11; // Excel row 12 (0-indexed)
const SUMMARY_ROW_END = 12; // Excel row 13

const SNAPSHOT_DATE_PATTERN = /HOLDINGS AS ON\s+(\d{4}-\d{2}-\d{2})/i;

export interface GrowwParseResult {
  holdings: MutualFundHolding[];
  snapshotDate: string;
  totalInvested: number;
  totalCurrentValue: number;
  totalReturns: number;
}

interface ColumnMap {
  schemeName: number;
  amc: number;
  category: number;
  subCategory: number;
  folioNo: number;
  units: number;
  investedValue: number;
  currentValue: number;
  returns: number;
}

export function parseGrowwXLSX(buffer: ArrayBuffer): GrowwParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];

  if (sheetName === undefined) {
    throw new Error("Groww XLSX file does not contain any sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  const snapshotDate = parseSnapshotDate(rows);
  const summary = parseSummaryRows(rows.slice(SUMMARY_ROW_START, SUMMARY_ROW_END + 1));
  const headerRowIndex = findHeaderRowIndex(rows);
  const dataRowStart = headerRowIndex + 1;
  const columns = mapColumns(rows[headerRowIndex]);

  const parsedHoldings: Omit<MutualFundHolding, "allocationPct">[] = [];

  for (let rowIndex = dataRowStart; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const schemeName = getCellText(row, columns.schemeName);

    if (schemeName === "" || schemeName.toLowerCase() === "nan") {
      if (parsedHoldings.length > 0) {
        break;
      }
      continue;
    }

    const investedValue = getCellNumber(row, columns.investedValue, "Invested Value", rowIndex + 1);
    const currentValue = getCellNumber(row, columns.currentValue, "Current Value", rowIndex + 1);
    const returnsPct = getCellNumber(row, columns.returns, "Returns", rowIndex + 1);

    parsedHoldings.push({
      schemeName,
      amc: getCellText(row, columns.amc),
      category: getCellText(row, columns.category),
      subCategory: getCellText(row, columns.subCategory),
      folioNo: getCellText(row, columns.folioNo),
      units: getCellNumber(row, columns.units, "Units", rowIndex + 1),
      investedValue,
      currentValue,
      returns: currentValue - investedValue,
      returnsPct,
    });
  }

  if (parsedHoldings.length === 0) {
    throw new Error("Groww XLSX file did not contain any mutual fund holdings");
  }

  const totalCurrentValue =
    summary.totalCurrentValue > 0
      ? summary.totalCurrentValue
      : parsedHoldings.reduce((total, holding) => total + holding.currentValue, 0);
  const totalInvested =
    summary.totalInvested > 0
      ? summary.totalInvested
      : parsedHoldings.reduce((total, holding) => total + holding.investedValue, 0);
  const totalReturns =
    summary.totalReturns !== 0
      ? summary.totalReturns
      : totalCurrentValue - totalInvested;

  const holdings: MutualFundHolding[] = parsedHoldings.map((holding) => ({
    ...holding,
    allocationPct:
      totalCurrentValue === 0 ? 0 : (holding.currentValue / totalCurrentValue) * 100,
  }));

  return {
    holdings,
    snapshotDate,
    totalInvested,
    totalCurrentValue,
    totalReturns,
  };
}

function parseSnapshotDate(rows: unknown[][]): string {
  for (const row of rows) {
    for (const cell of row) {
      const match = String(cell ?? "")
        .trim()
        .match(SNAPSHOT_DATE_PATTERN);

      if (match?.[1] !== undefined) {
        return match[1];
      }
    }
  }

  throw new Error(
    "Could not find snapshot date in Groww XLSX (expected 'HOLDINGS AS ON YYYY-MM-DD')",
  );
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const hasSchemeNameHeader = row.some(
      (cell) => String(cell ?? "").trim().toLowerCase() === "scheme name",
    );

    if (hasSchemeNameHeader) {
      return rowIndex;
    }
  }

  throw new Error("Could not find Groww XLSX holdings header row");
}

function parseSummaryRows(summaryRows: unknown[][]): {
  totalInvested: number;
  totalCurrentValue: number;
  totalReturns: number;
} {
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalReturns = 0;

  for (const row of summaryRows) {
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const label = String(row[columnIndex] ?? "")
        .trim()
        .toLowerCase();
      const value = parseNumericCell(row[columnIndex + 1]);

      if (label.includes("total investment")) {
        totalInvested = value;
      } else if (label.includes("current portfolio value")) {
        totalCurrentValue = value;
      } else if (label.includes("profit/loss") || label.includes("profit / loss")) {
        totalReturns = value;
      }
    }
  }

  return { totalInvested, totalCurrentValue, totalReturns };
}

function mapColumns(headerRow: unknown[] | undefined): ColumnMap {
  const headers = (headerRow ?? []).map((cell) => String(cell).trim().toLowerCase());

  const schemeName = findHeaderIndex(headers, ["scheme name"]);
  const amc = findHeaderIndex(headers, ["amc"]);
  const category = findHeaderIndex(headers, ["category"]);
  const subCategory = findHeaderIndex(headers, ["sub-category", "sub category"]);
  const folioNo = findHeaderIndex(headers, ["folio no.", "folio no", "folio number"]);
  const units = findHeaderIndex(headers, ["units"]);
  const investedValue = findHeaderIndex(headers, ["invested value"]);
  const currentValue = findHeaderIndex(headers, ["current value"]);
  const returns = findHeaderIndex(headers, ["returns"]);

  const missing: string[] = [];
  if (schemeName < 0) missing.push("Scheme Name");
  if (amc < 0) missing.push("AMC");
  if (category < 0) missing.push("Category");
  if (subCategory < 0) missing.push("Sub-category");
  if (folioNo < 0) missing.push("Folio No.");
  if (units < 0) missing.push("Units");
  if (investedValue < 0) missing.push("Invested Value");
  if (currentValue < 0) missing.push("Current Value");
  if (returns < 0) missing.push("Returns");

  if (missing.length > 0) {
    throw new Error(
      `Groww XLSX header row is missing required columns: ${missing.join(", ")}`,
    );
  }

  return {
    schemeName,
    amc,
    category,
    subCategory,
    folioNo,
    units,
    investedValue,
    currentValue,
    returns,
  };
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const index = headers.findIndex((header) => header === candidate || header.includes(candidate));
    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function getCellText(row: unknown[], columnIndex: number): string {
  if (columnIndex < 0) {
    return "";
  }

  const value = String(row[columnIndex] ?? "").trim();
  if (value.toLowerCase() === "nan") {
    return "";
  }

  return value;
}

function getCellNumber(
  row: unknown[],
  columnIndex: number,
  columnName: string,
  rowNumber: number,
): number {
  const value = parseNumericCell(row[columnIndex]);

  if (!Number.isFinite(value)) {
    throw new Error(
      `Invalid numeric value for ${columnName} in Groww XLSX row ${rowNumber}`,
    );
  }

  return value;
}

function parseNumericCell(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const text = String(value ?? "").trim();
  if (text === "" || text.toLowerCase() === "nan" || text === "-") {
    return Number.NaN;
  }

  const isParenthesizedNegative = text.startsWith("(") && text.endsWith(")");
  const isNegative = text.includes("-") || text.includes("\u2212");
  const hasPercent = text.includes("%");
  const numeric = text.replace(/[^0-9.]/g, "");

  if (numeric === "") {
    return Number.NaN;
  }

  const parsed = Number(numeric);
  const signed = isParenthesizedNegative || isNegative ? -parsed : parsed;

  return hasPercent ? signed : signed;
}
