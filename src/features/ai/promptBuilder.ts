import type {
  Holding,
  HoldingConcentration,
  MutualFundHolding,
  MutualFundTotals,
  PortfolioSnapshot,
} from "@/types/portfolio";

export function buildMutualFundPromptSection(
  mfTotals: MutualFundTotals,
  mfHoldings: MutualFundHolding[],
): string {
  const topFunds = [...mfHoldings]
    .sort((left, right) => right.allocationPct - left.allocationPct)
    .slice(0, 3)
    .map(
      (holding) =>
        `${holding.schemeName} (${holding.allocationPct.toFixed(1)}%)`,
    )
    .join(", ");

  return `Mutual funds summary:
- Total MF value: ₹${mfTotals.totalCurrentValue.toFixed(2)}
- Total MF returns: ₹${mfTotals.totalReturns.toFixed(2)} (${mfTotals.totalReturnsPct >= 0 ? "+" : ""}${mfTotals.totalReturnsPct.toFixed(2)}%)
- Top 3 funds by allocation: ${topFunds || "none"}`;
}

interface AdvisoryPromptInput {
  snapshot: Pick<
    PortfolioSnapshot,
    "id" | "createdAt" | "totalValue" | "totalCost" | "totalGain" | "totalGainPct" | "source"
  >;
  holdings: Holding[];
  concentration?: HoldingConcentration[];
  mfTotals?: MutualFundTotals;
  mfHoldings?: MutualFundHolding[];
}

/**
 * Builds the advisory-grade insight prompt. Claude is instructed to act as a
 * professional portfolio advisor and return strictly typed JSON matching the
 * `InsightResponse` shape in `src/types/portfolio.ts`. All numbers are
 * pre-calculated; the model must only interpret, classify, and prioritise.
 */
export function buildPortfolioPrompt(input: AdvisoryPromptInput): string {
  const { snapshot, holdings, concentration, mfTotals, mfHoldings } = input;

  const snapshotDate = snapshot.createdAt.split("T")[0] ?? snapshot.createdAt;
  const ageDays = Math.floor(
    (Date.now() - new Date(snapshot.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  const equityRows = holdings.map((h) => ({
    symbol: h.symbol,
    name: h.name,
    quantity: h.quantity,
    avgCost: round(h.avgCost),
    currentPrice: round(h.currentPrice),
    currentValue: round(h.currentValue),
    unrealisedGain: round(h.unrealisedGain),
    unrealisedGainPct: round(h.unrealisedGainPct, 2),
    allocationPct: round(h.allocationPct, 2),
  }));

  const concentrationRows = (concentration ?? []).map((c) => ({
    symbol: c.symbol,
    allocationPct: round(c.allocationPct, 2),
    isHighConcentration: c.isHighConcentration,
  }));

  const mfRows = (mfHoldings ?? []).map((m) => ({
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
  const mfTotal = round(mfTotals?.totalCurrentValue ?? 0);
  const combinedTotal = equityTotal + mfTotal;
  const equityShare =
    combinedTotal > 0 ? round((equityTotal / combinedTotal) * 100, 2) : 0;
  const mfShare = combinedTotal > 0 ? round((mfTotal / combinedTotal) * 100, 2) : 0;

  const deterministic = {
    snapshotDate,
    ageInDays: ageDays,
    source: snapshot.source,
    equity: {
      totalValue: equityTotal,
      totalCost: round(snapshot.totalCost),
      totalGain: round(snapshot.totalGain),
      totalGainPct: round(snapshot.totalGainPct, 2),
      holdings: equityRows,
      concentration: concentrationRows,
    },
    mutualFunds:
      mfTotals !== undefined
        ? {
            totalInvested: round(mfTotals.totalInvested),
            totalCurrentValue: mfTotal,
            totalReturns: round(mfTotals.totalReturns),
            totalReturnsPct: round(mfTotals.totalReturnsPct, 2),
            holdings: mfRows,
          }
        : null,
    combined: {
      totalValue: combinedTotal,
      equitySharePct: equityShare,
      mfSharePct: mfShare,
    },
  };

  return `You are the portfolio advisory layer for WealthOS — a professional, paid-grade portfolio analyst writing a private briefing for a single retail investor (Indian market).

# Hard rules
- Do NOT recompute any number. Use only the deterministic figures provided in the JSON block below.
- Do NOT predict future prices. Frame everything as observations and structured verdicts.
- Indian tax context: equity STCG (held < 1 year) is taxed at 20%; equity LTCG (held >= 1 year) is taxed at 12.5% above ₹1.25 lakh per FY. Flag holdings nearing the 1-year mark when relevant (you do NOT have buy dates — infer "close to 1-year" only when explicitly justified by allocation/quantity behaviour, otherwise leave ltcgNote null).
- Output MUST be raw JSON. No markdown, no code fences, no prose. Start with { and end with }.

# Analysis you must perform

## 1. EQUITY ANALYSIS (Kite data)
For every holding in equity.holdings, decide:

a) Classification — SHORT_TERM_PUNT vs LONG_TERM_HOLD. Use these heuristics:
   - LONG_TERM_HOLD: PSU names (NTPC, SBIN, POWERGRID, BEL, RVNL, COCHINSHIP, IDBI, NHPC, etc.), defence (BEL, HAL, COCHINSHIP), FMCG/consumer staples (HINDUNILVR, COLPAL, ASIANPAINT, CIPLA), index ETFs (NIFTYBEES, HDFCGOLD, SILVERBEES), large-cap blue chips with steady allocation.
   - SHORT_TERM_PUNT: momentum/sectoral picks, small quantities + high gain %, recent thematic plays, anything where the allocation is small (<2%) AND gain is volatile.

b) Verdict — exactly one of: BOOK_PROFIT_FULL, BOOK_PROFIT_PARTIAL, HOLD, EXIT, HOLD_TRIM
   - BOOK_PROFIT_FULL: punt that has run hard (>40% gain) with no further catalyst
   - BOOK_PROFIT_PARTIAL: long-term hold with strong gain (>30%) that has run ahead of fundamentals — trim the excess
   - HOLD_TRIM: position is over-allocated (concentration > 15%) — reduce to free capital
   - EXIT: dead money, persistent underperformance, or thesis broken
   - HOLD: core position, continue

c) For each holding return: reasoning (1-2 sentences, specific to this stock and its gain/loss), ltcgNote (only if you can credibly say it is near the 1-year mark — otherwise null), taxImplication (e.g. "Selling now triggers ~₹X STCG at 20%" — use the pre-computed unrealisedGain; do not invent a tax number, just describe the regime that applies), priority.

## 2. MUTUAL FUND ANALYSIS (Groww data)
- Detect investorRiskProfile from the fund mix: AGGRESSIVE (>70% equity funds incl. small/mid cap), MODERATE (balanced equity + debt/hybrid + gold), CONSERVATIVE (debt/hybrid dominant).
- For each fund in mutualFunds.holdings, fill an MF verdict:
  - planType: DIRECT if scheme name contains "Direct", REGULAR if it contains "Regular", else UNKNOWN. Flag REGULAR plans as a high-expense drag in the reasoning.
  - category: normalised category (Large Cap / Mid Cap / Small Cap / Flexi Cap / ELSS / Debt / Hybrid / Gold / Index / International). Use the provided category/subCategory as the source.
  - verdict: CONTINUE | INCREASE_SIP | REDUCE_SIP | SWITCH | EXIT
  - reasoning: 1-2 sentences referencing the fund's returnsPct vs typical category benchmark expectations and any overlap.
  - switchTo: if verdict is SWITCH, name a concrete cheaper alternative category (e.g. "Nifty 50 index fund", "UTI Nifty Next 50 Index Fund Direct Plan"). Otherwise null.
  - priority.
- Detect overlap: if multiple funds occupy the same category with similar mandates, push SWITCH/EXIT on the weaker performer with reasoning that calls out consolidation.

## 3. COMBINED ANALYSIS
- portfolioStructure.sectorConcentration: name top 2-3 sectors and any over-concentration (>25% in one sector).
- portfolioStructure.psuVsPrivate: rough split commentary for equity book.
- portfolioStructure.equityVsMFSplit: use combined.equitySharePct / mfSharePct numbers — call out if one side dominates >75%.
- portfolioStructure.sectorOverlap: if equity stocks and MF holdings double up on the same sectors (e.g. banking/financials in both), say so.
- taxSummary.estimatedSTCG and estimatedLTCG: leave as 0 unless you can derive them strictly from provided unrealisedGain values you would advise booking. ltcgThresholdWarning: true if total potential LTCG bookings exceed ₹1,00,000. harvestingOpportunities: short list of symbols carrying losses worth booking before FY end.
- priorityActions: top 5 ranked actions across equity AND MF, ranked by rupee impact and urgency. Each entry MUST include rank (1-5), urgency (URGENT / THIS_WEEK / THIS_MONTH), action (specific, e.g. "Trim NTPC by 30% to bring allocation under 12%"), impact (HIGH/MEDIUM/LOW), and rupeesImpacted (a concrete number derived from currentValue or unrealisedGain; null only if not quantifiable).
- alerts: short list of structural alerts.
- summary: 2-3 sentence executive briefing.

# Output JSON schema (return EXACTLY this shape — every key is required, arrays may be empty but must be present)

{
  "summary": string,
  "investorRiskProfile": "AGGRESSIVE" | "MODERATE" | "CONSERVATIVE",
  "stockVerdicts": Array<{
    "symbol": string,
    "classification": "SHORT_TERM_PUNT" | "LONG_TERM_HOLD",
    "verdict": "BOOK_PROFIT_FULL" | "BOOK_PROFIT_PARTIAL" | "HOLD" | "EXIT" | "HOLD_TRIM",
    "reasoning": string,
    "ltcgNote": string | null,
    "taxImplication": string | null,
    "priority": "LOW" | "MEDIUM" | "HIGH"
  }>,
  "mfVerdicts": Array<{
    "schemeName": string,
    "planType": "DIRECT" | "REGULAR" | "UNKNOWN",
    "category": string,
    "verdict": "CONTINUE" | "INCREASE_SIP" | "REDUCE_SIP" | "SWITCH" | "EXIT",
    "reasoning": string,
    "switchTo": string | null,
    "priority": "LOW" | "MEDIUM" | "HIGH"
  }>,
  "portfolioStructure": {
    "sectorConcentration": string,
    "psuVsPrivate": string,
    "equityVsMFSplit": string,
    "sectorOverlap": string
  },
  "taxSummary": {
    "estimatedSTCG": number,
    "estimatedLTCG": number,
    "ltcgThresholdWarning": boolean,
    "harvestingOpportunities": string[]
  },
  "priorityActions": Array<{
    "rank": number,
    "urgency": "URGENT" | "THIS_WEEK" | "THIS_MONTH",
    "action": string,
    "impact": "HIGH" | "MEDIUM" | "LOW",
    "rupeesImpacted": number | null
  }>,
  "alerts": Array<{
    "type": "CONCENTRATION" | "TAX" | "LOSS" | "GOAL" | "REBALANCE",
    "message": string,
    "urgency": "INFO" | "WARNING" | "ACTION_NEEDED"
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
