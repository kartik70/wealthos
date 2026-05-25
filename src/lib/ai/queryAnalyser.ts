import type { Holding } from "../../types/portfolio";
import type { ChunkType } from "./retrieval";

export interface QueryAnalysis {
  chunkTypes: ChunkType[];
  symbols: string[];
  dateRange: { from: string; to: string } | null;
  isGeneric: boolean;
}

const DIFF_KEYWORDS = ["changed", "bought", "sold", "when did", "added", "exited"];
const INSIGHT_KEYWORDS = ["analysis", "recommendation", "advice", "should i"];
const GOAL_KEYWORDS = ["goal", "target", "retirement", "on track"];
const SNAPSHOT_KEYWORDS = ["portfolio", "value", "allocation", "worth"];

const ALL_CHUNK_TYPES: ChunkType[] = [
  "snapshot_summary",
  "diff_summary",
  "insight_summary",
  "goal_summary",
];

const MONTH_NAMES: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export function analyseQuery(question: string, holdings: Holding[]): QueryAnalysis {
  const lower = question.toLowerCase();

  const symbols = extractSymbols(lower, holdings);
  const chunkTypes = routeChunkTypes(lower);
  const dateRange = detectDateRange(lower);
  const wordCount = question.trim().split(/\s+/).filter(Boolean).length;
  const isGeneric = symbols.length === 0 && dateRange === null && wordCount < 5;

  return { chunkTypes, symbols, dateRange, isGeneric };
}

function extractSymbols(lowerQ: string, holdings: Holding[]): string[] {
  const matched = new Set<string>();

  for (const h of holdings) {
    if (h.symbol && lowerQ.includes(h.symbol.toLowerCase())) {
      matched.add(h.symbol);
    }
  }

  const lossIntent = /(exit|sell|loss|worst)/.test(lowerQ);
  const profitIntent = /(profit|book|gain|best)/.test(lowerQ);

  if (lossIntent) {
    for (const h of holdings) {
      if (h.unrealisedGainPct < -10) matched.add(h.symbol);
    }
  }

  if (profitIntent) {
    for (const h of holdings) {
      if (h.unrealisedGainPct > 20) matched.add(h.symbol);
    }
  }

  return Array.from(matched);
}

function routeChunkTypes(lowerQ: string): ChunkType[] {
  if (DIFF_KEYWORDS.some((k) => lowerQ.includes(k))) {
    return ["diff_summary"];
  }
  if (INSIGHT_KEYWORDS.some((k) => lowerQ.includes(k))) {
    return ["insight_summary"];
  }
  if (GOAL_KEYWORDS.some((k) => lowerQ.includes(k))) {
    return ["goal_summary"];
  }
  if (SNAPSHOT_KEYWORDS.some((k) => lowerQ.includes(k))) {
    return ["snapshot_summary"];
  }
  return ALL_CHUNK_TYPES;
}

function detectDateRange(lowerQ: string): { from: string; to: string } | null {
  const now = new Date();
  const toIso = (d: Date): string => d.toISOString();

  if (lowerQ.includes("last week")) {
    return { from: toIso(daysAgo(now, 7)), to: toIso(now) };
  }
  if (lowerQ.includes("last month") || lowerQ.includes("this month")) {
    return { from: toIso(daysAgo(now, 30)), to: toIso(now) };
  }
  if (lowerQ.includes("last year")) {
    return { from: toIso(daysAgo(now, 365)), to: toIso(now) };
  }
  if (lowerQ.includes("today") || lowerQ.includes("latest")) {
    return { from: toIso(daysAgo(now, 7)), to: toIso(now) };
  }

  // Specific month name (e.g., "May", "January") — interpret as that month
  // of the current year, or the previous year if the month is in the future.
  for (const name of Object.keys(MONTH_NAMES)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(lowerQ)) {
      const monthIdx = MONTH_NAMES[name];
      let year = now.getFullYear();
      if (monthIdx > now.getMonth()) {
        year -= 1;
      }
      const from = new Date(year, monthIdx, 1, 0, 0, 0, 0);
      const to = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
      return { from: toIso(from), to: toIso(to) };
    }
  }

  return null;
}

function daysAgo(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d;
}

// ---------------------------------------------------------------------------
// Forward-looking vs historical classification (used by the research agent
// to decide whether real-time market news is worth fetching).
// ---------------------------------------------------------------------------

const FORWARD_LOOKING_PHRASES = [
  "should i",
  "should i hold",
  "should i exit",
  "should i sell",
  "should i buy",
  "what is happening",
  "what's happening",
  "whats happening",
  "latest news",
  "is it worth",
  "good time to",
  "buy more",
  "outlook",
  "future",
  "target price",
];

const HISTORICAL_PHRASES = [
  "when did i buy",
  "when did i sell",
  "when did i add",
  "what did i buy",
  "what changed",
  "what was my portfolio",
  "how much did i pay",
  "what was the price",
];

const HISTORICAL_PREFIXES = ["when ", "what was ", "how many "];

export function isForwardLookingQuestion(question: string): boolean {
  const lower = question.toLowerCase().trim();
  if (lower === "") return false;

  // Explicit forward-looking phrasing wins outright.
  if (FORWARD_LOOKING_PHRASES.some((p) => lower.includes(p))) {
    return true;
  }

  // Explicit historical/factual phrasing or prefix → not forward-looking.
  if (HISTORICAL_PHRASES.some((p) => lower.includes(p))) {
    return false;
  }
  if (HISTORICAL_PREFIXES.some((p) => lower.startsWith(p))) {
    return false;
  }

  // Default: treat as not forward-looking — only fetch market news when we
  // have a clear advisory / current-context signal.
  return false;
}
