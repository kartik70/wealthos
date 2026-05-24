import type {
  HealthScoreResult,
  Holding,
  HoldingConcentration,
  MutualFundHolding,
  MutualFundTotals,
  PortfolioSnapshot,
  SectorAllocation,
  TaxSummary,
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

export function buildPortfolioPrompt(
  snapshot: PortfolioSnapshot,
  concentration: HoldingConcentration[],
  holdings: Holding[],
  mfTotals?: MutualFundTotals,
  mfHoldings?: MutualFundHolding[],
): string {
  const concentrationText = concentration
    .map(
      (c) =>
        `- ${c.symbol}: ${c.allocationPct.toFixed(2)}% (High concentration: ${c.isHighConcentration ? "Yes" : "No"})`,
    )
    .join("\n");

  const holdingsText = holdings
    .map(
      (h) =>
        `- ${h.symbol} (${h.name}): Qty ${h.quantity}, Avg Cost ₹${h.avgCost.toFixed(2)}, Current ₹${h.currentPrice.toFixed(2)}, Value ₹${h.currentValue.toFixed(2)}, Gain ₹${h.unrealisedGain.toFixed(2)} (${h.unrealisedGainPct.toFixed(2)}%)`,
    )
    .join("\n");

  const prompt = `You are a portfolio analysis expert. Analyze this portfolio snapshot and provide actionable insights.

Portfolio Summary:
- Total Value: ₹${snapshot.totalValue.toFixed(2)}
- Total Cost: ₹${snapshot.totalCost.toFixed(2)}
- Total Gain/Loss: ₹${snapshot.totalGain.toFixed(2)} (${snapshot.totalGainPct.toFixed(2)}%)

Holdings:
${holdingsText}

Concentration Analysis:
${concentrationText}
${
  mfTotals !== undefined && mfHoldings !== undefined && mfHoldings.length > 0
    ? `\n${buildMutualFundPromptSection(mfTotals, mfHoldings)}\n`
    : ""
}

Based on this analysis, provide:

1. A concise summary (2-3 sentences) of the portfolio's current state and key takeaways.
2. Specific recommendations for each position or the portfolio overall. For each recommendation, specify:
   - The action: BUY, SELL, HOLD, or REVIEW
   - The symbol
   - The reason for this action
   - Priority level: LOW, MEDIUM, or HIGH

3. Alerts for important considerations like:
   - CONCENTRATION: If any position is over 20% allocation
   - TAX: Tax planning considerations if applicable
   - LOSS: Significant unrealized losses
   - GOAL: If portfolio seems misaligned with typical goals
   - REBALANCE: If portfolio needs rebalancing

Return a JSON object with this exact structure, with raw JSON only, no markdown:
{
  "summary": "string",
  "recommendations": [
    {
      "action": "BUY|SELL|HOLD|REVIEW",
      "symbol": "string",
      "reason": "string",
      "priority": "LOW|MEDIUM|HIGH"
    }
  ],
  "alerts": [
    {
      "type": "CONCENTRATION|TAX|LOSS|GOAL|REBALANCE",
      "message": "string",
      "urgency": "INFO|WARNING|ACTION_NEEDED"
    }
  ],
  "generatedAt": "ISO timestamp string"
}
Return raw JSON only. No markdown, no code fences, no explanation. Start your response with { and end with }.`;

  return prompt;
}

export function buildDetailedInsightPrompt(
  snapshot: PortfolioSnapshot,
  holdings: Holding[],
  healthScore: HealthScoreResult,
  sectors: SectorAllocation[],
  taxSummary: TaxSummary,
): string {
  const payload = {
    snapshot: {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      source: snapshot.source,
      totalValue: snapshot.totalValue,
      totalCost: snapshot.totalCost,
      totalGain: snapshot.totalGain,
      totalGainPct: snapshot.totalGainPct,
    },
    holdings,
    healthScore,
    sectors,
    taxSummary,
  };

  return `You are the interpretation layer for WealthOS.

Use only the deterministic numbers provided below. Do not calculate new finance metrics. Do not predict prices.

Return ONLY raw JSON in this exact shape:
{
  "portfolioStory": "3-4 sentence narrative about this portfolio",
  "healthcommentary": "what is dragging the score down and how to improve",
  "sectorCommentary": { "sector": "commentary" },
  "stockAnalysis": [
    {
      "symbol": "string",
      "verdict": "AVERAGE_DOWN|EXIT|HOLD|BOOK_PROFIT",
      "reasoning": "string",
      "taxNote": "string"
    }
  ],
  "riskProfile": "what kind of investor this portfolio reflects",
  "actionPlan": [
    {
      "priority": 1,
      "action": "string",
      "impact": "HIGH|MEDIUM|LOW",
      "urgency": "NOW|THIS_MONTH|THIS_QUARTER"
    }
  ]
}

Rules:
- portfolioStory must be 3-4 sentences.
- actionPlan priorities must be numeric 1-5.
- sectorCommentary keys should map to sector names from the provided sector allocation list.
- Return valid JSON only. No markdown, no code fences, no extra text.

Deterministic data:
${JSON.stringify(payload, null, 2)}`;
}
