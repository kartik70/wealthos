export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  unrealisedGain: number;
  unrealisedGainPct: number;
  allocationPct: number;
}

export interface PortfolioSnapshot {
  id: string;
  userId: string;
  createdAt: string;
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  holdings: Holding[];
  source: "kite" | "groww" | "manual";
}

export interface PortfolioTotals {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
}

export interface HoldingConcentration {
  symbol: string;
  allocationPct: number;
  isHighConcentration: boolean;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  allocationPct: number;
  symbols: string[];
}

export interface HealthScoreBreakdown {
  concentration: number;
  diversification: number;
  lossRatio: number;
  sectorBalance: number;
}

export interface HealthScoreResult {
  score: number;
  breakdown: HealthScoreBreakdown;
}

export interface HarvestingOpportunity {
  symbol: string;
  loss: number;
  saving: number;
}

export interface TaxSummary {
  estimatedSTCG: number;
  estimatedLTCG: number;
  harvestingOpportunities: HarvestingOpportunity[];
}

export interface InsightResponse {
  summary: string;
  recommendations: Recommendation[];
  alerts: Alert[];
  generatedAt: string;
}

export interface Recommendation {
  action: "BUY" | "SELL" | "HOLD" | "REVIEW";
  symbol: string;
  reason: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export interface Alert {
  type: "CONCENTRATION" | "TAX" | "LOSS" | "GOAL" | "REBALANCE";
  message: string;
  urgency: "INFO" | "WARNING" | "ACTION_NEEDED";
}

export interface DetailedStockAnalysis {
  symbol: string;
  verdict: "AVERAGE_DOWN" | "EXIT" | "HOLD" | "BOOK_PROFIT";
  reasoning: string;
  taxNote: string;
}

export interface DetailedActionPlan {
  priority: number;
  action: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  urgency: "NOW" | "THIS_MONTH" | "THIS_QUARTER";
}

export interface DetailedInsightResponse {
  portfolioStory: string;
  healthcommentary: string;
  sectorCommentary: Record<string, string>;
  stockAnalysis: DetailedStockAnalysis[];
  riskProfile: string;
  actionPlan: DetailedActionPlan[];
}
