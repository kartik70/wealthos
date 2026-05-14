import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";

import type { Alert, InsightResponse, Recommendation } from "../../types/portfolio";

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
    output_config: {
      format: {
        type: "json_schema",
        schema: INSIGHT_RESPONSE_SCHEMA,
      },
    },
  });

  const text = response.content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (text === "") {
    throw new Error("Claude returned an empty insight response");
  }

  return parseInsightResponse(text);
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
