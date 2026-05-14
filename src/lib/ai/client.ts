import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";

import type {
  Alert,
  DetailedActionPlan,
  DetailedInsightResponse,
  DetailedStockAnalysis,
  InsightResponse,
  Recommendation,
} from "../../types/portfolio";

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

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateInsight(prompt: string): Promise<InsightResponse> {
  const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  messages: [{ role: "user", content: prompt }],
});

  const text = response.content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (text === "") {
    throw new Error("Claude returned an empty insight response");
  }
  const clean = text
  .replace(/^```json\s*/i, "")
  .replace(/^```\s*/i, "")
  .replace(/```\s*$/i, "")
  .trim();

return parseInsightResponse(clean);
}

export async function generateDetailedInsight(
  prompt: string,
): Promise<DetailedInsightResponse> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (text === "") {
    throw new Error("Claude returned an empty detailed insight response");
  }

  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return parseDetailedInsightResponse(clean);
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
