import type {
  Holding,
  HoldingConcentration,
  PortfolioTotals,
} from "../../types/portfolio";

const HIGH_CONCENTRATION_THRESHOLD_PCT = 20;

export function calcPortfolioTotals(holdings: Holding[]): PortfolioTotals {
  const totalValue = holdings.reduce(
    (total, holding) => total + holding.currentValue,
    0,
  );
  const totalCost = holdings.reduce(
    (total, holding) => total + holding.quantity * holding.avgCost,
    0,
  );
  const totalGain = holdings.reduce(
    (total, holding) => total + holding.unrealisedGain,
    0,
  );

  return {
    totalValue,
    totalCost,
    totalGain,
    totalGainPct: totalCost === 0 ? 0 : (totalGain / totalCost) * 100,
  };
}

export function calcAllocationPct(holdings: Holding[]): Holding[] {
  const totalValue = calcPortfolioTotals(holdings).totalValue;

  return holdings.map((holding) => ({
    ...holding,
    allocationPct:
      totalValue === 0 ? 0 : (holding.currentValue / totalValue) * 100,
  }));
}

export function calcCAGR(
  investedAmount: number,
  currentValue: number,
  years: number,
): number {
  if (investedAmount <= 0 || currentValue < 0 || years <= 0) {
    return 0;
  }

  return (currentValue / investedAmount) ** (1 / years) - 1;
}

export function calcConcentration(
  holdings: Holding[],
): HoldingConcentration[] {
  return calcAllocationPct(holdings)
    .map((holding) => ({
      symbol: holding.symbol,
      allocationPct: holding.allocationPct,
      isHighConcentration:
        holding.allocationPct > HIGH_CONCENTRATION_THRESHOLD_PCT,
    }))
    .sort((left, right) => right.allocationPct - left.allocationPct);
}

export function calcDayChange(
  holdings: Holding[],
  dayChangePct: number[],
): number {
  const holdingsWithAllocation = calcAllocationPct(holdings);

  return holdingsWithAllocation.reduce((total, holding, index) => {
    const changePct = dayChangePct[index] ?? 0;
    return total + (holding.allocationPct / 100) * changePct;
  }, 0);
}
