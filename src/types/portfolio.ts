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
