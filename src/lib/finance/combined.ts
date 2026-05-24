import { calcPortfolioTotals } from "./calculations";
import type { Holding, MutualFundHolding } from "../../types/portfolio";

export interface AssetClassAllocation {
  value: number;
  invested: number;
  returns: number;
  allocationPct: number;
}

export interface CombinedPortfolioResult {
  totalValue: number;
  totalInvested: number;
  totalReturns: number;
  totalReturnsPct: number;
  equity: AssetClassAllocation;
  mutualFunds: AssetClassAllocation;
}

export function calcCombinedPortfolio(
  kiteHoldings: Holding[],
  mfHoldings: MutualFundHolding[],
): CombinedPortfolioResult {
  const equityTotals = calcPortfolioTotals(kiteHoldings);

  const mutualFundValue = mfHoldings.reduce(
    (total, holding) => total + holding.currentValue,
    0,
  );
  const mutualFundInvested = mfHoldings.reduce(
    (total, holding) => total + holding.investedValue,
    0,
  );
  const mutualFundReturns = mfHoldings.reduce(
    (total, holding) => total + holding.returns,
    0,
  );

  const totalValue = equityTotals.totalValue + mutualFundValue;
  const totalInvested = equityTotals.totalCost + mutualFundInvested;
  const totalReturns = equityTotals.totalGain + mutualFundReturns;
  const totalReturnsPct =
    totalInvested === 0 ? 0 : (totalReturns / totalInvested) * 100;

  const equityAllocationPct =
    totalValue === 0 ? 0 : (equityTotals.totalValue / totalValue) * 100;
  const mutualFundAllocationPct =
    totalValue === 0 ? 0 : (mutualFundValue / totalValue) * 100;

  return {
    totalValue,
    totalInvested,
    totalReturns,
    totalReturnsPct,
    equity: {
      value: equityTotals.totalValue,
      invested: equityTotals.totalCost,
      returns: equityTotals.totalGain,
      allocationPct: equityAllocationPct,
    },
    mutualFunds: {
      value: mutualFundValue,
      invested: mutualFundInvested,
      returns: mutualFundReturns,
      allocationPct: mutualFundAllocationPct,
    },
  };
}
