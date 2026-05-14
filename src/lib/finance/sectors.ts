import type { Holding, SectorAllocation } from "@/types/portfolio";

const SECTOR_SYMBOL_MAP: Record<string, string[]> = {
  Power: ["ADANIPOWER", "NTPC", "TATAPOWER", "POWERGRID", "NHPC", "RPOWER", "RTNPOWER"],
  Financials: ["JIOFIN", "SBIN", "SBICARD", "IDBI", "CDSL"],
  Metals: ["TATASTEEL", "BHARATFORG"],
  Infrastructure: ["RVNL", "JSWINFRA", "PNCINFRA", "BEL", "COCHINSHIP"],
  Consumer: ["ASIANPAINT", "COLPAL", "HINDUNILVR", "IRCTC"],
  Auto: ["TMCV", "TMPV"],
  ETFs: ["HDFCGOLD", "NIFTYBEES", "SILVERBEES"],
  Technology: ["WIPRO", "ACCELYA"],
};

const DEFAULT_SECTOR = "Other";

const SYMBOL_TO_SECTOR = new Map<string, string>(
  Object.entries(SECTOR_SYMBOL_MAP).flatMap(([sector, symbols]) =>
    symbols.map((symbol) => [symbol, sector] as const),
  ),
);

function getSectorForSymbol(symbol: string): string {
  return SYMBOL_TO_SECTOR.get(symbol.toUpperCase()) ?? DEFAULT_SECTOR;
}

export function classifySectors(holdings: Holding[]): SectorAllocation[] {
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
