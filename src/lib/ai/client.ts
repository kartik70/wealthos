import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import { GoogleGenerativeAI } from "@google/generative-ai";

import type {
  Alert,
  DetailedActionPlan,
  DetailedInsightResponse,
  DetailedStockAnalysis,
  InsightResponse,
  Recommendation,
} from "../../types/portfolio";
import { type AIProvider, isAIProvider } from "./provider";

const SECTOR_CLASSIFICATION_PROMPT_PREFIX =
  "Classify this Indian stock symbol into one sector:";
const SECTOR_CLASSIFICATION_PROMPT_SUFFIX =
  "Reply with just the sector name from: Power, Financials, Metals, Infrastructure, Consumer, Auto, ETFs, Technology, Other.";

const INSIGHT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "recommendations", "alerts", "generatedAt"],
  properties: {
    summary: { type: "string" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "symbol", "reason", "priority"],
        properties: {
          action: { enum: ["BUY", "SELL", "HOLD", "REVIEW"] },
          symbol: { type: "string" },
          reason: { type: "string" },
          priority: { enum: ["LOW", "MEDIUM", "HIGH"] },
        },
      },
    },
    alerts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "message", "urgency"],
        properties: {
          type: { enum: ["CONCENTRATION", "TAX", "LOSS", "GOAL", "REBALANCE"] },
          message: { type: "string" },
          urgency: { enum: ["INFO", "WARNING", "ACTION_NEEDED"] },
        },
      },
    },
    generatedAt: { type: "string" },
  },
} as const;

let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

export async function generateInsight(
  prompt: string,
  provider: AIProvider = getDefaultAIProvider(),
  apiKey?: string,
): Promise<InsightResponse> {
  const text = await generateText(prompt, provider, 1000, apiKey);
  return parseInsightResponse(stripCodeFences(text));
}

export async function generateDetailedInsight(
  prompt: string,
  provider: AIProvider = getDefaultAIProvider(),
  apiKey?: string,
): Promise<DetailedInsightResponse> {
  const text = await generateText(prompt, provider, 4000, apiKey);
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
    throw new Error("Missing ANTHROPIC_API_KEY");
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
    throw new Error("Missing GEMINI_API_KEY");
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
    throw new Error("Missing ANTHROPIC_API_KEY");
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
    throw new Error("Missing GEMINI_API_KEY");
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
    Array.isArray(value.recommendations) &&
    value.recommendations.every(isRecommendation) &&
    Array.isArray(value.alerts) &&
    value.alerts.every(isAlert) &&
    typeof value.generatedAt === "string"
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
    typeof value.healthcommentary === "string" &&
    isRecord(value.sectorCommentary) &&
    Object.values(value.sectorCommentary).every((entry) => typeof entry === "string") &&
    Array.isArray(value.stockAnalysis) &&
    value.stockAnalysis.every(isDetailedStockAnalysis) &&
    typeof value.riskProfile === "string" &&
    Array.isArray(value.actionPlan) &&
    value.actionPlan.every(isDetailedActionPlan)
  );
}

function isDetailedStockAnalysis(value: unknown): value is DetailedStockAnalysis {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.symbol === "string" &&
    isStockVerdict(value.verdict) &&
    typeof value.reasoning === "string" &&
    typeof value.taxNote === "string"
  );
}

function isStockVerdict(value: unknown): value is DetailedStockAnalysis["verdict"] {
  return (
    value === "AVERAGE_DOWN" ||
    value === "EXIT" ||
    value === "HOLD" ||
    value === "BOOK_PROFIT"
  );
}

function isDetailedActionPlan(value: unknown): value is DetailedActionPlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.priority === "number" &&
    Number.isInteger(value.priority) &&
    value.priority >= 1 &&
    value.priority <= 5 &&
    typeof value.action === "string" &&
    isImpact(value.impact) &&
    isPlanUrgency(value.urgency)
  );
}

function isImpact(value: unknown): value is DetailedActionPlan["impact"] {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW";
}

function isPlanUrgency(value: unknown): value is DetailedActionPlan["urgency"] {
  return value === "NOW" || value === "THIS_MONTH" || value === "THIS_QUARTER";
}

function isRecommendation(value: unknown): value is Recommendation {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecommendationAction(value.action) &&
    typeof value.symbol === "string" &&
    typeof value.reason === "string" &&
    isPriority(value.priority)
  );
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

function isRecommendationAction(
  value: unknown,
): value is Recommendation["action"] {
  return value === "BUY" || value === "SELL" || value === "HOLD" || value === "REVIEW";
}

function isPriority(value: unknown): value is Recommendation["priority"] {
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
