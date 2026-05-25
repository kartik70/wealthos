export interface MutualFundHolding {
  schemeName: string;
  amc: string;
  category: string;
  subCategory: string;
  folioNo: string;
  units: number;
  investedValue: number;
  currentValue: number;
  returns: number;
  returnsPct: number;
  allocationPct: number;
}

export interface MutualFundTotals {
  totalInvested: number;
  totalCurrentValue: number;
  totalReturns: number;
  totalReturnsPct: number;
}

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

export type InvestorRiskProfile = "AGGRESSIVE" | "MODERATE" | "CONSERVATIVE";

export interface StockVerdict {
  symbol: string;
  classification: "SHORT_TERM_PUNT" | "LONG_TERM_HOLD";
  verdict:
    | "BOOK_PROFIT_FULL"
    | "BOOK_PROFIT_PARTIAL"
    | "HOLD"
    | "EXIT"
    | "HOLD_TRIM";
  reasoning: string;
  ltcgNote: string | null;
  taxImplication: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export interface MFVerdict {
  schemeName: string;
  planType: "DIRECT" | "REGULAR" | "UNKNOWN";
  category: string;
  verdict: "CONTINUE" | "INCREASE_SIP" | "REDUCE_SIP" | "SWITCH" | "EXIT";
  reasoning: string;
  switchTo: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export interface PriorityAction {
  rank: number;
  urgency: "URGENT" | "THIS_WEEK" | "THIS_MONTH";
  action: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  rupeesImpacted: number | null;
}

export interface PortfolioStructureCommentary {
  sectorConcentration: string;
  psuVsPrivate: string;
  equityVsMFSplit: string;
  sectorOverlap: string;
}

export interface InsightTaxSummary {
  estimatedSTCG: number;
  estimatedLTCG: number;
  ltcgThresholdWarning: boolean;
  harvestingOpportunities: string[];
}

export interface InsightResponse {
  summary: string;
  investorRiskProfile: InvestorRiskProfile;
  stockVerdicts: StockVerdict[];
  mfVerdicts: MFVerdict[];
  portfolioStructure: PortfolioStructureCommentary;
  taxSummary: InsightTaxSummary;
  priorityActions: PriorityAction[];
  alerts: Alert[];
  generatedAt: string;
}

export interface Alert {
  type: "CONCENTRATION" | "TAX" | "LOSS" | "GOAL" | "REBALANCE";
  message: string;
  urgency: "INFO" | "WARNING" | "ACTION_NEEDED";
}

export interface SectorBreakdownEntry {
  sector: string;
  allocationPct: number;
  commentary: string;
}

export interface AssetAllocationEntry {
  type: string;
  allocationPct: number;
}

export interface HarvestingDetail {
  name: string;
  loss: number;
  taxSaving: number;
}

export interface DetailedEquityStructure {
  sectorBreakdown: SectorBreakdownEntry[];
  psuVsPrivate: string;
  capSplit: string;
  topRisks: string[];
  reinvestmentSuggestion: string;
}

export interface DetailedMFStructure {
  assetAllocation: AssetAllocationEntry[];
  allocationHealthComment: string;
  amcConcentration: string;
  goalAlignment: string;
}

export interface DetailedCombinedAnalysis {
  equityVsMFSplit: string;
  sectorOverlap: string;
  healthScoreReasoning: string;
  complementOrDuplicate: string;
}

export interface DetailedTaxOptimisation {
  estimatedSTCG: number;
  estimatedLTCG: number;
  ltcgThresholdWarning: boolean;
  harvestingOpportunities: HarvestingDetail[];
  ltcgHoldSuggestions: string[];
}

export interface DetailedInsightResponse {
  portfolioStory: string;
  investorProfile: InvestorRiskProfile;
  investorProfileReasoning: string;
  stockVerdicts: StockVerdict[];
  equityStructure: DetailedEquityStructure;
  mfVerdicts: MFVerdict[];
  mfStructure: DetailedMFStructure;
  combinedAnalysis: DetailedCombinedAnalysis;
  taxOptimisation: DetailedTaxOptimisation;
  priorityActions: PriorityAction[];
  generatedAt: string;
}
