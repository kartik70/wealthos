import type { Holding, TaxSummary } from "@/types/portfolio";

// Budget 2024 equity tax rates
const STCG_RATE = 0.2;
const LTCG_RATE = 0.125;
// Annual LTCG exemption threshold (₹1,25,000 per FY)
const LTCG_EXEMPTION = 125000;

export function calcTaxSummary(holdings: Holding[]): TaxSummary {
  const taxableGain = holdings.reduce((sum, holding) => {
    return holding.unrealisedGain > 0 ? sum + holding.unrealisedGain : sum;
  }, 0);

  // Without purchase dates we cannot split gains into short-term vs long-term.
  // Report worst-case (all STCG) and best-case (all LTCG with exemption) separately.
  // The caller should surface both and label them as approximations.
  const estimatedSTCG = taxableGain * STCG_RATE;
  const ltcgTaxableAmount = Math.max(0, taxableGain - LTCG_EXEMPTION);
  const estimatedLTCG = ltcgTaxableAmount * LTCG_RATE;

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
    estimatedSTCG,
    estimatedLTCG,
    harvestingOpportunities,
  };
}
