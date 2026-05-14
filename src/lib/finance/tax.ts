import type { Holding, TaxSummary } from "@/types/portfolio";

const STCG_RATE = 0.15;
const LTCG_RATE = 0.1;

export function calcTaxSummary(holdings: Holding[]): TaxSummary {
  const taxableGain = holdings.reduce((sum, holding) => {
    return holding.unrealisedGain > 0 ? sum + holding.unrealisedGain : sum;
  }, 0);

  const harvestingOpportunities = holdings
    .filter((holding) => holding.unrealisedGain < 0)
    .map((holding) => {
      const loss = Math.abs(holding.unrealisedGain);
      return {
        symbol: holding.symbol,
        loss,
        saving: loss * STCG_RATE,
      };
    })
    .sort((left, right) => right.saving - left.saving);

  return {
    estimatedSTCG: taxableGain * STCG_RATE,
    estimatedLTCG: taxableGain * LTCG_RATE,
    harvestingOpportunities,
  };
}
