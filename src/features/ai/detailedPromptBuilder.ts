import type {
  AssetAllocationEntry,
  HealthScoreResult,
  Holding,
  MutualFundHolding,
  MutualFundTotals,
  PortfolioSnapshot,
  SectorAllocation,
  TaxSummary,
} from "@/types/portfolio";

export interface DetailedAdvisoryInput {
  snapshot: Pick<
    PortfolioSnapshot,
    "id" | "createdAt" | "source" | "totalValue" | "totalCost" | "totalGain" | "totalGainPct"
  >;
  holdings: Holding[];
  healthScore: HealthScoreResult;
  sectors: SectorAllocation[];
  taxSummary: TaxSummary;
  mutualFunds: {
    totals: MutualFundTotals;
    holdings: MutualFundHolding[];
    assetAllocation: AssetAllocationEntry[];
  } | null;
}

/**
 * Builds the deep-analysis advisory prompt. Returns strictly typed JSON
 * matching `DetailedInsightResponse`. All numbers are pre-calculated; the
 * model must only interpret, classify, prioritise, and narrate.
 */
export function buildDetailedInsightPrompt(input: DetailedAdvisoryInput): string {
  const { snapshot, holdings, healthScore, sectors, taxSummary, mutualFunds } = input;

  const equityRows = holdings.map((h) => ({
    symbol: h.symbol,
    name: h.name,
    quantity: h.quantity,
    avgCost: round(h.avgCost, 2),
    currentPrice: round(h.currentPrice, 2),
    currentValue: round(h.currentValue),
    unrealisedGain: round(h.unrealisedGain),
    unrealisedGainPct: round(h.unrealisedGainPct, 2),
    allocationPct: round(h.allocationPct, 2),
  }));

  const sectorRows = sectors.map((s) => ({
    sector: s.sector,
    value: round(s.value),
    allocationPct: round(s.allocationPct, 2),
    symbols: s.symbols,
  }));

  const mfRows = (mutualFunds?.holdings ?? []).map((m) => ({
    schemeName: m.schemeName,
    amc: m.amc,
    category: m.category,
    subCategory: m.subCategory,
    units: m.units,
    investedValue: round(m.investedValue),
    currentValue: round(m.currentValue),
    returns: round(m.returns),
    returnsPct: round(m.returnsPct, 2),
    allocationPct: round(m.allocationPct, 2),
  }));

  const equityTotal = round(snapshot.totalValue);
  const mfTotal = round(mutualFunds?.totals.totalCurrentValue ?? 0);
  const combinedTotal = equityTotal + mfTotal;
  const equityShare =
    combinedTotal > 0 ? round((equityTotal / combinedTotal) * 100, 2) : 0;
  const mfShare = combinedTotal > 0 ? round((mfTotal / combinedTotal) * 100, 2) : 0;

  const deterministic = {
    snapshotDate: snapshot.createdAt.split("T")[0] ?? snapshot.createdAt,
    source: snapshot.source,
    equity: {
      totalValue: equityTotal,
      totalCost: round(snapshot.totalCost),
      totalGain: round(snapshot.totalGain),
      totalGainPct: round(snapshot.totalGainPct, 2),
      holdings: equityRows,
      sectors: sectorRows,
      healthScore: {
        score: healthScore.score,
        breakdown: healthScore.breakdown,
      },
      taxSummary: {
        estimatedSTCG: round(taxSummary.estimatedSTCG),
        estimatedLTCG: round(taxSummary.estimatedLTCG),
        harvestingOpportunities: taxSummary.harvestingOpportunities.map((h) => ({
          symbol: h.symbol,
          loss: round(h.loss),
          saving: round(h.saving),
        })),
      },
    },
    mutualFunds:
      mutualFunds !== null
        ? {
            totalInvested: round(mutualFunds.totals.totalInvested),
            totalCurrentValue: mfTotal,
            totalReturns: round(mutualFunds.totals.totalReturns),
            totalReturnsPct: round(mutualFunds.totals.totalReturnsPct, 2),
            holdings: mfRows,
            assetAllocation: mutualFunds.assetAllocation.map((entry) => ({
              type: entry.type,
              allocationPct: round(entry.allocationPct, 2),
            })),
          }
        : null,
    combined: {
      totalValue: combinedTotal,
      equitySharePct: equityShare,
      mfSharePct: mfShare,
    },
  };

  return `You are the deep portfolio advisory layer for WealthOS — a paid-grade, institutional analyst writing the most thorough briefing possible for a single retail investor (Indian market). This is the full deep-analysis report shown on the Insights page; it must be more thorough than any other prompt in the product.

# Hard rules
- Do NOT recompute any number. Use only the deterministic figures provided in the JSON block at the end. Mirror provided allocationPct / value numbers exactly when echoing them in the output.
- Do NOT predict future prices. Frame everything as observations, classifications, and structured verdicts.
- Indian tax context: equity STCG (held < 1 year) is taxed at 20%; equity LTCG (held >= 1 year) is taxed at 12.5% above ₹1,00,000 per FY. You do NOT have purchase dates — only flag "near 1-year LTCG window" when there is a credible textual cue (e.g. small quantity + thematic name + large gain suggests recent entry); otherwise leave ltcgHoldSuggestions empty or do not list that symbol.
- Output MUST be raw JSON. No markdown, no code fences, no prose. Start with { and end with }.

# Analysis you must perform

## 1. PORTFOLIO NARRATIVE (portfolioStory)
3-4 sentence narrative: what kind of investor built this, what is working, what is not, and the overall trajectory. Reference real numbers (gain %, total value, dominant sectors).

## 2. INVESTOR PROFILE (investorProfile + investorProfileReasoning)
Detect AGGRESSIVE / MODERATE / CONSERVATIVE from the combined equity + MF mix.
- AGGRESSIVE: >70% in equity (direct stocks + equity MF), heavy small/mid cap or thematic exposure, low debt/gold.
- MODERATE: balanced equity (50-70%) with debt/hybrid/gold present, blue-chip tilt.
- CONSERVATIVE: <50% equity, dominant debt/hybrid, gold exposure, large cap focus only.
Explain reasoning in 2-3 sentences referencing actual allocation and category mix.

## 3. EQUITY: STOCK-BY-STOCK DEEP DIVE (stockVerdicts)
For EVERY holding in equity.holdings, return one entry:
- classification: SHORT_TERM_PUNT vs LONG_TERM_HOLD
  - LONG_TERM_HOLD: PSU (NTPC, SBIN, POWERGRID, BEL, RVNL, COCHINSHIP, IDBI, NHPC, etc.), defence (BEL, HAL, COCHINSHIP), FMCG/consumer staples (HINDUNILVR, COLPAL, ASIANPAINT, CIPLA), index ETFs (NIFTYBEES, HDFCGOLD, SILVERBEES), large-cap blue chips with steady allocation.
  - SHORT_TERM_PUNT: momentum / sectoral / thematic picks, small quantities + high gain %, anything with allocation <2% and volatile gain.
- verdict: BOOK_PROFIT_FULL | BOOK_PROFIT_PARTIAL | HOLD | EXIT | HOLD_TRIM
  - BOOK_PROFIT_FULL: punt that has run hard (>40% gain) with no further catalyst
  - BOOK_PROFIT_PARTIAL: long-term hold with >30% gain that has run ahead of fundamentals — trim excess
  - HOLD_TRIM: position over-allocated (>15%) — reduce to free capital
  - EXIT: dead money, broken thesis, or persistent underperformance with no catalyst
  - HOLD: core position, continue
- reasoning: 1-2 sentences specific to this stock referencing its gain %, sector, position size, and any catalyst.
- ltcgNote: ONLY if you have a credible signal it's near the 1-year mark (otherwise null). Phrase as "Holding near 1-year mark — waiting ~X days saves STCG of ~₹Y at 20%".
- taxImplication: describe the tax regime that would apply if sold now using the provided unrealisedGain. Do NOT invent rupee figures beyond the provided gain. Null if not actionable.
- priority: LOW | MEDIUM | HIGH

## 4. EQUITY: PORTFOLIO STRUCTURE (equityStructure)
- sectorBreakdown: For every sector in equity.sectors, return { sector, allocationPct (MIRROR the provided number exactly), commentary (1-2 sentences on whether this sector concentration is healthy, the stocks driving it, and risk/opportunity) }.
- psuVsPrivate: rough split commentary (e.g. "PSU heavy ~60% via NTPC + BEL + RVNL; private exposure limited to HINDUNILVR / ASIANPAINT").
- capSplit: large / mid / small cap split commentary based on the symbols. Be specific.
- topRisks: array of EXACTLY 3 short risk strings (e.g. "Power sector concentration >25%", "No private financials exposure", "Two punt names >5% allocation each").
- reinvestmentSuggestion: if capital is freed from EXIT / BOOK_PROFIT verdicts, where should it go given the current gaps (e.g. "Redeploy into Nifty 50 index ETF or private banking exposure to balance PSU heavy book").

## 5. MUTUAL FUNDS: FUND-BY-FUND DEEP DIVE (mfVerdicts)
If mutualFunds is null, return an empty array. Otherwise for EVERY fund in mutualFunds.holdings return one entry:
- planType: DIRECT if scheme name contains "Direct", REGULAR if it contains "Regular", else UNKNOWN. When REGULAR, the reasoning MUST flag the high expense drag and suggest switching to the Direct variant of the same scheme.
- category: normalise to one of Large Cap / Mid Cap / Small Cap / Flexi Cap / ELSS / Debt / Hybrid / Gold / Index / International (use provided category + subCategory as the source).
- verdict: CONTINUE | INCREASE_SIP | REDUCE_SIP | SWITCH | EXIT
- reasoning: 1-2 sentences referencing returnsPct vs typical category benchmark expectation, plan type drag, and overlap.
- switchTo: if verdict is SWITCH, name a concrete cheaper alternative (e.g. "UTI Nifty 50 Index Fund Direct Plan" or "Parag Parikh Flexi Cap Direct Plan"). Otherwise null.
- priority: LOW | MEDIUM | HIGH
Detect overlap: when multiple funds occupy the same category with similar mandate, push SWITCH/EXIT on the weaker performer and call out consolidation in the reasoning.

## 6. MUTUAL FUNDS: PORTFOLIO STRUCTURE (mfStructure)
If mutualFunds is null, still return the object with empty / "No mutual fund data" fields.
- assetAllocation: array of { type, allocationPct } — MIRROR mutualFunds.assetAllocation entries exactly.
- allocationHealthComment: is this allocation appropriate for the detected investorProfile? 1-2 sentences referencing the actual %s.
- amcConcentration: too many funds from same AMC? Name the AMC and the share.
- goalAlignment: structured for long-term wealth or short-term parking? Reference categories.

## 7. COMBINED PORTFOLIO ANALYSIS (combinedAnalysis)
- equityVsMFSplit: use combined.equitySharePct and combined.mfSharePct; call out if one side dominates >75%.
- sectorOverlap: do equity stocks and MF holdings double up on the same sectors (e.g. banking via both direct stocks and large cap MF)? Name the overlaps.
- healthScoreReasoning: explain what is dragging equity.healthScore.score down using the breakdown numbers. Mention which sub-score is weakest.
- complementOrDuplicate: do the two sleeves complement (different exposures) or duplicate (same exposures)?

## 8. TAX OPTIMISATION (taxOptimisation)
- estimatedSTCG: MIRROR equity.taxSummary.estimatedSTCG exactly.
- estimatedLTCG: MIRROR equity.taxSummary.estimatedLTCG exactly.
- ltcgThresholdWarning: true if estimatedLTCG > 100000.
- harvestingOpportunities: for every entry in equity.taxSummary.harvestingOpportunities, return { name: symbol, loss: same loss value, taxSaving: same saving value }. MIRROR the numbers; do not recompute.
- ltcgHoldSuggestions: array of short strings — symbols where the user should hold until the 1-year mark for LTCG benefit. Only include symbols you can credibly flag (large gain + small recent position + thematic name). Empty array if uncertain.

## 9. PRIORITY ACTION PLAN (priorityActions)
EXACTLY 5 to 7 actions ranked by urgency and rupee impact, across equity AND MF.
- rank: 1..N
- urgency: URGENT | THIS_WEEK | THIS_MONTH (URGENT = this week, THIS_WEEK = within 7 days, THIS_MONTH = within the month — pick at most 2 URGENT)
- action: specific, e.g. "Trim NTPC by 30% to bring allocation under 12% — frees ~₹X for redeployment into a Nifty 50 index fund"
- impact: HIGH | MEDIUM | LOW
- rupeesImpacted: concrete number derived from currentValue or unrealisedGain. Null only if truly unquantifiable.

# Output JSON schema (return EXACTLY this shape — every key required, arrays may be empty but must be present)

{
  "portfolioStory": string,
  "investorProfile": "AGGRESSIVE" | "MODERATE" | "CONSERVATIVE",
  "investorProfileReasoning": string,
  "stockVerdicts": Array<{
    "symbol": string,
    "classification": "SHORT_TERM_PUNT" | "LONG_TERM_HOLD",
    "verdict": "BOOK_PROFIT_FULL" | "BOOK_PROFIT_PARTIAL" | "HOLD" | "EXIT" | "HOLD_TRIM",
    "reasoning": string,
    "ltcgNote": string | null,
    "taxImplication": string | null,
    "priority": "LOW" | "MEDIUM" | "HIGH"
  }>,
  "equityStructure": {
    "sectorBreakdown": Array<{ "sector": string, "allocationPct": number, "commentary": string }>,
    "psuVsPrivate": string,
    "capSplit": string,
    "topRisks": string[],
    "reinvestmentSuggestion": string
  },
  "mfVerdicts": Array<{
    "schemeName": string,
    "planType": "DIRECT" | "REGULAR" | "UNKNOWN",
    "category": string,
    "verdict": "CONTINUE" | "INCREASE_SIP" | "REDUCE_SIP" | "SWITCH" | "EXIT",
    "reasoning": string,
    "switchTo": string | null,
    "priority": "LOW" | "MEDIUM" | "HIGH"
  }>,
  "mfStructure": {
    "assetAllocation": Array<{ "type": string, "allocationPct": number }>,
    "allocationHealthComment": string,
    "amcConcentration": string,
    "goalAlignment": string
  },
  "combinedAnalysis": {
    "equityVsMFSplit": string,
    "sectorOverlap": string,
    "healthScoreReasoning": string,
    "complementOrDuplicate": string
  },
  "taxOptimisation": {
    "estimatedSTCG": number,
    "estimatedLTCG": number,
    "ltcgThresholdWarning": boolean,
    "harvestingOpportunities": Array<{ "name": string, "loss": number, "taxSaving": number }>,
    "ltcgHoldSuggestions": string[]
  },
  "priorityActions": Array<{
    "rank": number,
    "urgency": "URGENT" | "THIS_WEEK" | "THIS_MONTH",
    "action": string,
    "impact": "HIGH" | "MEDIUM" | "LOW",
    "rupeesImpacted": number | null
  }>,
  "generatedAt": string
}

# Deterministic portfolio data
${JSON.stringify(deterministic, null, 2)}

Return raw JSON only. No markdown, no code fences, no explanation. Start with { and end with }.`;
}

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
