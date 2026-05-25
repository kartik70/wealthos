import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { MissingApiKeyError } from "./keyResolver";
import type {
  Alert,
  AssetAllocationEntry,
  DetailedCombinedAnalysis,
  DetailedEquityStructure,
  DetailedInsightResponse,
  DetailedMFStructure,
  DetailedTaxOptimisation,
  HarvestingDetail,
  InsightResponse,
  InsightTaxSummary,
  InvestorRiskProfile,
  MFVerdict,
  PortfolioStructureCommentary,
  PriorityAction,
  SectorBreakdownEntry,
  StockVerdict,
} from "../../types/portfolio";
import { type AIProvider, isAIProvider } from "./provider";

const SECTOR_CLASSIFICATION_PROMPT_PREFIX =
  "Classify this Indian stock symbol into one sector:";
const SECTOR_CLASSIFICATION_PROMPT_SUFFIX =
  "Reply with just the sector name from: Power, Financials, Metals, Infrastructure, Consumer, Auto, ETFs, Technology, Other.";

let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

export async function generateInsight(
  prompt: string,
  provider: AIProvider = getDefaultAIProvider(),
  apiKey?: string,
): Promise<InsightResponse> {
  const text = await generateText(prompt, provider, 4000, apiKey);
  return parseInsightResponse(stripCodeFences(text));
}

export async function generateDetailedInsight(
  prompt: string,
  provider: AIProvider = getDefaultAIProvider(),
  apiKey?: string,
): Promise<DetailedInsightResponse> {
  // Deep analysis output is materially larger than the dashboard insight
  // (9 sections incl. per-stock + per-fund verdicts), so it needs more room.
  const text = await generateText(prompt, provider, 8000, apiKey);
  return parseDetailedInsightResponse(stripCodeFences(text));
}

export async function classifyIndianStockSector(
  symbol: string,
  apiKey?: string,
): Promise<string> {
  const text = await generateWithAnthropic(
    `${SECTOR_CLASSIFICATION_PROMPT_PREFIX} ${symbol}. ${SECTOR_CLASSIFICATION_PROMPT_SUFFIX}`,
    20,
    apiKey,
  );

  return text.replace(/[."']/g, "").trim();
}

function getDefaultAIProvider(): AIProvider {
  const configured = process.env.AI_PROVIDER;

  if (configured === undefined || configured.trim() === "") {
    return "anthropic";
  }

  if (!isAIProvider(configured)) {
    throw new Error('Invalid AI_PROVIDER. Expected "anthropic" or "gemini"');
  }

  return configured;
}

async function generateText(
  prompt: string,
  provider: AIProvider,
  maxTokens: number,
  apiKey?: string,
): Promise<string> {
  if (provider === "gemini") {
    return generateWithGemini(prompt, maxTokens, apiKey);
  }

  return generateWithAnthropic(prompt, maxTokens, apiKey);
}

async function generateWithAnthropic(
  prompt: string,
  maxTokens: number,
  apiKey?: string,
): Promise<string> {
  const resolvedApiKey = apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (resolvedApiKey === undefined || resolvedApiKey.trim() === "") {
    throw new MissingApiKeyError("anthropic");
  }

  const client =
    apiKey === undefined
      ? (anthropicClient ??= new Anthropic({ apiKey: resolvedApiKey }))
      : new Anthropic({ apiKey: resolvedApiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (text === "") {
    throw new Error("Anthropic returned an empty response");
  }

  return text;
}

async function generateWithGemini(
  prompt: string,
  maxTokens: number,
  apiKey?: string,
): Promise<string> {
  const resolvedApiKey = apiKey ?? process.env.GEMINI_API_KEY;

  if (resolvedApiKey === undefined || resolvedApiKey.trim() === "") {
    throw new MissingApiKeyError("gemini");
  }

  const client =
    apiKey === undefined
      ? (geminiClient ??= new GoogleGenerativeAI(resolvedApiKey))
      : new GoogleGenerativeAI(resolvedApiKey);

  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  });

  const text = response.response.text().trim();

  if (text === "") {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}

export interface AdvisorChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function streamAdvisorResponse({
  provider,
  apiKey,
  systemPrompt,
  conversationHistory,
  userMessage,
  onDelta,
}: {
  provider: AIProvider;
  apiKey?: string;
  systemPrompt: string;
  conversationHistory: AdvisorChatMessage[];
  userMessage: string;
  onDelta: (text: string) => void;
}): Promise<string> {
  if (provider === "gemini") {
    return streamAdvisorGemini({
      apiKey,
      systemPrompt,
      conversationHistory,
      userMessage,
      onDelta,
    });
  }

  return streamAdvisorAnthropic({
    apiKey,
    systemPrompt,
    conversationHistory,
    userMessage,
    onDelta,
  });
}

async function streamAdvisorAnthropic({
  apiKey,
  systemPrompt,
  conversationHistory,
  userMessage,
  onDelta,
}: {
  apiKey?: string;
  systemPrompt: string;
  conversationHistory: AdvisorChatMessage[];
  userMessage: string;
  onDelta: (text: string) => void;
}): Promise<string> {
  const resolvedApiKey = apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (resolvedApiKey === undefined || resolvedApiKey.trim() === "") {
    throw new MissingApiKeyError("anthropic");
  }

  const historyWindow = conversationHistory.slice(-10);
  const client = new Anthropic({ apiKey: resolvedApiKey });
  const messages: Anthropic.MessageParam[] = [
    ...historyWindow.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user", content: userMessage },
  ];

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    system: systemPrompt,
    messages,
  });

  let fullText = "";

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      fullText += chunk.delta.text;
      onDelta(chunk.delta.text);
    }
  }

  return fullText;
}

async function streamAdvisorGemini({
  apiKey,
  systemPrompt,
  conversationHistory,
  userMessage,
  onDelta,
}: {
  apiKey?: string;
  systemPrompt: string;
  conversationHistory: AdvisorChatMessage[];
  userMessage: string;
  onDelta: (text: string) => void;
}): Promise<string> {
  const resolvedApiKey = apiKey ?? process.env.GEMINI_API_KEY;

  if (resolvedApiKey === undefined || resolvedApiKey.trim() === "") {
    throw new MissingApiKeyError("gemini");
  }

  const gemini = new GoogleGenerativeAI(resolvedApiKey);
  const model = gemini.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const history = conversationHistory.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(userMessage);
  let fullText = "";

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      fullText += text;
      onDelta(text);
    }
  }

  return fullText;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function parseInsightResponse(responseText: string): InsightResponse {
  const parsed: unknown = JSON.parse(responseText);

  if (!isInsightResponse(parsed)) {
    throw new Error("Claude returned an invalid insight response");
  }

  return parsed;
}

function isInsightResponse(value: unknown): value is InsightResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.summary === "string" &&
    isInvestorRiskProfile(value.investorRiskProfile) &&
    Array.isArray(value.stockVerdicts) &&
    value.stockVerdicts.every(isStockVerdictEntry) &&
    Array.isArray(value.mfVerdicts) &&
    value.mfVerdicts.every(isMFVerdictEntry) &&
    isPortfolioStructure(value.portfolioStructure) &&
    isInsightTaxSummary(value.taxSummary) &&
    Array.isArray(value.priorityActions) &&
    value.priorityActions.every(isPriorityActionEntry) &&
    Array.isArray(value.alerts) &&
    value.alerts.every(isAlert) &&
    typeof value.generatedAt === "string"
  );
}

function isInvestorRiskProfile(value: unknown): value is InvestorRiskProfile {
  return value === "AGGRESSIVE" || value === "MODERATE" || value === "CONSERVATIVE";
}

function isStockVerdictEntry(value: unknown): value is StockVerdict {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.symbol === "string" &&
    (value.classification === "SHORT_TERM_PUNT" ||
      value.classification === "LONG_TERM_HOLD") &&
    isStockVerdictValue(value.verdict) &&
    typeof value.reasoning === "string" &&
    (value.ltcgNote === null || typeof value.ltcgNote === "string") &&
    (value.taxImplication === null || typeof value.taxImplication === "string") &&
    isPriority(value.priority)
  );
}

function isStockVerdictValue(value: unknown): value is StockVerdict["verdict"] {
  return (
    value === "BOOK_PROFIT_FULL" ||
    value === "BOOK_PROFIT_PARTIAL" ||
    value === "HOLD" ||
    value === "EXIT" ||
    value === "HOLD_TRIM"
  );
}

function isMFVerdictEntry(value: unknown): value is MFVerdict {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.schemeName === "string" &&
    (value.planType === "DIRECT" ||
      value.planType === "REGULAR" ||
      value.planType === "UNKNOWN") &&
    typeof value.category === "string" &&
    isMFVerdictValue(value.verdict) &&
    typeof value.reasoning === "string" &&
    (value.switchTo === null || typeof value.switchTo === "string") &&
    isPriority(value.priority)
  );
}

function isMFVerdictValue(value: unknown): value is MFVerdict["verdict"] {
  return (
    value === "CONTINUE" ||
    value === "INCREASE_SIP" ||
    value === "REDUCE_SIP" ||
    value === "SWITCH" ||
    value === "EXIT"
  );
}

function isPortfolioStructure(
  value: unknown,
): value is PortfolioStructureCommentary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.sectorConcentration === "string" &&
    typeof value.psuVsPrivate === "string" &&
    typeof value.equityVsMFSplit === "string" &&
    typeof value.sectorOverlap === "string"
  );
}

function isInsightTaxSummary(value: unknown): value is InsightTaxSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.estimatedSTCG === "number" &&
    typeof value.estimatedLTCG === "number" &&
    typeof value.ltcgThresholdWarning === "boolean" &&
    Array.isArray(value.harvestingOpportunities) &&
    value.harvestingOpportunities.every((entry) => typeof entry === "string")
  );
}

function isPriorityActionEntry(value: unknown): value is PriorityAction {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.rank === "number" &&
    Number.isInteger(value.rank) &&
    (value.urgency === "URGENT" ||
      value.urgency === "THIS_WEEK" ||
      value.urgency === "THIS_MONTH") &&
    typeof value.action === "string" &&
    isImpact(value.impact) &&
    (value.rupeesImpacted === null || typeof value.rupeesImpacted === "number")
  );
}

export function parseDetailedInsightResponse(
  responseText: string,
): DetailedInsightResponse {
  const parsed: unknown = JSON.parse(responseText);

  if (!isDetailedInsightResponse(parsed)) {
    throw new Error("Claude returned an invalid detailed insight response");
  }

  return parsed;
}

function isDetailedInsightResponse(
  value: unknown,
): value is DetailedInsightResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.portfolioStory === "string" &&
    isInvestorRiskProfile(value.investorProfile) &&
    typeof value.investorProfileReasoning === "string" &&
    Array.isArray(value.stockVerdicts) &&
    value.stockVerdicts.every(isStockVerdictEntry) &&
    isDetailedEquityStructure(value.equityStructure) &&
    Array.isArray(value.mfVerdicts) &&
    value.mfVerdicts.every(isMFVerdictEntry) &&
    isDetailedMFStructure(value.mfStructure) &&
    isDetailedCombinedAnalysis(value.combinedAnalysis) &&
    isDetailedTaxOptimisation(value.taxOptimisation) &&
    Array.isArray(value.priorityActions) &&
    value.priorityActions.every(isPriorityActionEntry) &&
    typeof value.generatedAt === "string"
  );
}

function isDetailedEquityStructure(
  value: unknown,
): value is DetailedEquityStructure {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.sectorBreakdown) &&
    value.sectorBreakdown.every(isSectorBreakdownEntry) &&
    typeof value.psuVsPrivate === "string" &&
    typeof value.capSplit === "string" &&
    Array.isArray(value.topRisks) &&
    value.topRisks.every((entry) => typeof entry === "string") &&
    typeof value.reinvestmentSuggestion === "string"
  );
}

function isSectorBreakdownEntry(value: unknown): value is SectorBreakdownEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.sector === "string" &&
    typeof value.allocationPct === "number" &&
    typeof value.commentary === "string"
  );
}

function isDetailedMFStructure(value: unknown): value is DetailedMFStructure {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.assetAllocation) &&
    value.assetAllocation.every(isAssetAllocationEntry) &&
    typeof value.allocationHealthComment === "string" &&
    typeof value.amcConcentration === "string" &&
    typeof value.goalAlignment === "string"
  );
}

function isAssetAllocationEntry(value: unknown): value is AssetAllocationEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    typeof value.allocationPct === "number"
  );
}

function isDetailedCombinedAnalysis(
  value: unknown,
): value is DetailedCombinedAnalysis {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.equityVsMFSplit === "string" &&
    typeof value.sectorOverlap === "string" &&
    typeof value.healthScoreReasoning === "string" &&
    typeof value.complementOrDuplicate === "string"
  );
}

function isDetailedTaxOptimisation(
  value: unknown,
): value is DetailedTaxOptimisation {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.estimatedSTCG === "number" &&
    typeof value.estimatedLTCG === "number" &&
    typeof value.ltcgThresholdWarning === "boolean" &&
    Array.isArray(value.harvestingOpportunities) &&
    value.harvestingOpportunities.every(isHarvestingDetail) &&
    Array.isArray(value.ltcgHoldSuggestions) &&
    value.ltcgHoldSuggestions.every((entry) => typeof entry === "string")
  );
}

function isHarvestingDetail(value: unknown): value is HarvestingDetail {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.loss === "number" &&
    typeof value.taxSaving === "number"
  );
}

function isImpact(value: unknown): value is PriorityAction["impact"] {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW";
}

function isAlert(value: unknown): value is Alert {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isAlertType(value.type) &&
    typeof value.message === "string" &&
    isUrgency(value.urgency)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPriority(value: unknown): value is "LOW" | "MEDIUM" | "HIGH" {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}

function isAlertType(value: unknown): value is Alert["type"] {
  return (
    value === "CONCENTRATION" ||
    value === "TAX" ||
    value === "LOSS" ||
    value === "GOAL" ||
    value === "REBALANCE"
  );
}

function isUrgency(value: unknown): value is Alert["urgency"] {
  return value === "INFO" || value === "WARNING" || value === "ACTION_NEEDED";
}

export type { AIProvider };
