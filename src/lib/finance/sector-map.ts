import type { Holding, SectorAllocation } from "@/types/portfolio";

export const SECTOR_SYMBOL_MAP: Record<string, string[]> = {
  Power: ["ADANIPOWER", "NTPC", "TATAPOWER", "POWERGRID", "NHPC", "RPOWER", "RTNPOWER"],
  Financials: ["JIOFIN", "SBIN", "SBICARD", "IDBI", "CDSL"],
  Metals: ["TATASTEEL", "BHARATFORG"],
  Infrastructure: ["RVNL", "JSWINFRA", "PNCINFRA", "BEL", "COCHINSHIP"],
  Consumer: ["ASIANPAINT", "COLPAL", "HINDUNILVR", "IRCTC"],
  Auto: ["TMCV", "TMPV"],
  ETFs: ["HDFCGOLD", "NIFTYBEES", "SILVERBEES"],
  Technology: ["WIPRO", "ACCELYA"],
};

export const DEFAULT_SECTOR = "Other";
export const ALLOWED_SECTORS = new Set([...Object.keys(SECTOR_SYMBOL_MAP), DEFAULT_SECTOR]);

export const SYMBOL_TO_SECTOR = new Map<string, string>(
  Object.entries(SECTOR_SYMBOL_MAP).flatMap(([sector, symbols]) =>
    symbols.map((symbol) => [symbol, sector] as const),
  ),
);

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function normalizeSector(sector: string): string {
  const trimmed = sector.trim();

  for (const allowedSector of ALLOWED_SECTORS) {
    if (allowedSector.toLowerCase() === trimmed.toLowerCase()) {
      return allowedSector;
    }
  }

  return DEFAULT_SECTOR;
}

export function getHardcodedSectorForSymbol(symbol: string): string | null {
  return SYMBOL_TO_SECTOR.get(normalizeSymbol(symbol)) ?? null;
}

export function getSectorForSymbolSync(symbol: string): string {
  return getHardcodedSectorForSymbol(symbol) ?? DEFAULT_SECTOR;
}

export function buildSectorAllocations(
  holdings: Holding[],
  getSectorForSymbol: (symbol: string) => string,
): SectorAllocation[] {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const sectorMap = new Map<string, { value: number; symbols: string[] }>();

  for (const holding of holdings) {
    const sector = getSectorForSymbol(holding.symbol);
    const existing = sectorMap.get(sector);

    if (existing) {
      existing.value += holding.currentValue;
      existing.symbols.push(holding.symbol);
    } else {
      sectorMap.set(sector, {
        value: holding.currentValue,
        symbols: [holding.symbol],
      });
    }
  }

  return Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      value: data.value,
      allocationPct: totalValue === 0 ? 0 : (data.value / totalValue) * 100,
      symbols: data.symbols.sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => right.allocationPct - left.allocationPct);
}

export function classifySectorsSync(holdings: Holding[]): SectorAllocation[] {
  return buildSectorAllocations(holdings, (symbol) => getSectorForSymbolSync(symbol));
}
