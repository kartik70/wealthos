import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { tavily, type TavilySearchResponse } from "@tavily/core";

import type { Holding, PortfolioSnapshot } from "@/types/portfolio";

/**
 * Portfolio Research Agent
 *
 * A multi-node LangGraph workflow that augments the RAG advisor with
 * real-time market context for the holdings mentioned in (or relevant
 * to) the user's question.
 *
 * Pipeline:
 *   extractSymbols  ──► shouldFetchNews ──► fetchMarketNews ──► buildFinalContext ──► END
 *                                       └────────────────────► buildFinalContext ──► END
 */

const MAX_SYMBOLS_TO_RESEARCH = 3;
const TAVILY_MAX_RESULTS = 3;
const TAVILY_TIMEOUT_MS = 8000;

const EXIT_INTENT_KEYWORDS = [
  "exit",
  "sell",
  "book profit",
  "book loss",
  "get out",
  "should i hold",
  "should i keep",
  "trim",
  "reduce",
  "cut",
];

const GENERIC_QUESTION_KEYWORDS = [
  "how is my portfolio",
  "portfolio doing",
  "overall",
  "summary",
  "summarise",
  "summarize",
  "tax",
  "ltcg",
  "stcg",
  "goal",
  "retirement",
  "allocation",
  "diversification",
  "concentration",
];

const ResearchStateAnnotation = Annotation.Root({
  question: Annotation<string>(),
  userId: Annotation<string>(),
  ragContext: Annotation<string>(),
  currentSnapshotText: Annotation<string>(),
  snapshot: Annotation<PortfolioSnapshot | null>(),
  mentionedSymbols: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  marketNews: Annotation<Record<string, string>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  usedMarketNews: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  finalContext: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

type ResearchState = typeof ResearchStateAnnotation.State;

export interface ResearchAgentResult {
  finalContext: string;
  mentionedSymbols: string[];
  usedMarketNews: boolean;
}

export async function runResearchAgent(params: {
  question: string;
  userId: string;
  ragContext: string;
  currentSnapshotText: string;
  snapshot: PortfolioSnapshot | null;
}): Promise<ResearchAgentResult> {
  const graph = buildGraph();
  const result = await graph.invoke({
    question: params.question,
    userId: params.userId,
    ragContext: params.ragContext,
    currentSnapshotText: params.currentSnapshotText,
    snapshot: params.snapshot,
  });

  return {
    finalContext: result.finalContext,
    mentionedSymbols: result.mentionedSymbols,
    usedMarketNews: result.usedMarketNews,
  };
}

function buildGraph() {
  return new StateGraph(ResearchStateAnnotation)
    .addNode("extractSymbols", extractSymbolsNode)
    .addNode("fetchMarketNews", fetchMarketNewsNode)
    .addNode("buildFinalContext", buildFinalContextNode)
    .addEdge(START, "extractSymbols")
    .addConditionalEdges("extractSymbols", shouldFetchNews, {
      fetch: "fetchMarketNews",
      skip: "buildFinalContext",
    })
    .addEdge("fetchMarketNews", "buildFinalContext")
    .addEdge("buildFinalContext", END)
    .compile();
}

// ---------------------------------------------------------------------------
// Node 1: extractSymbols — pure string matching, no LLM call.
// ---------------------------------------------------------------------------
function extractSymbolsNode(state: ResearchState): Partial<ResearchState> {
  const holdings = state.snapshot?.holdings ?? [];
  const question = state.question;
  const upperQuestion = question.toUpperCase();

  const directMatches: string[] = [];
  for (const holding of holdings) {
    if (holding.symbol.length < 2) continue;
    const symbolRegex = new RegExp(`\\b${escapeRegex(holding.symbol)}\\b`, "i");
    if (symbolRegex.test(question)) {
      directMatches.push(holding.symbol);
      continue;
    }
    // Match by holding name (first significant word) as a fallback.
    const nameToken = firstSignificantToken(holding.name);
    if (nameToken !== null && nameToken.length >= 4) {
      const nameRegex = new RegExp(`\\b${escapeRegex(nameToken)}\\b`, "i");
      if (nameRegex.test(question)) {
        directMatches.push(holding.symbol);
      }
    }
  }

  let symbols = dedupe(directMatches);

  // Intent-based expansion: exit/hold-style questions → surface loss positions.
  if (symbols.length === 0 && hasExitIntent(upperQuestion) && holdings.length > 0) {
    symbols = topLossSymbols(holdings, MAX_SYMBOLS_TO_RESEARCH);
  }

  return {
    mentionedSymbols: symbols.slice(0, MAX_SYMBOLS_TO_RESEARCH),
  };
}

function shouldFetchNews(state: ResearchState): "fetch" | "skip" {
  if (state.mentionedSymbols.length === 0) return "skip";
  if (isPurelyGenericQuestion(state.question)) return "skip";
  return "fetch";
}

// ---------------------------------------------------------------------------
// Node 2: fetchMarketNews — Tavily search per symbol (max 3).
// ---------------------------------------------------------------------------
async function fetchMarketNewsNode(
  state: ResearchState,
): Promise<Partial<ResearchState>> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    throw new Error(
      "TAVILY_API_KEY is not set. Add it to .env.local to enable real-time market context.",
    );
  }

  const client = tavily({ apiKey });
  const newsBySymbol: Record<string, string> = {};

  const settled = await Promise.allSettled(
    state.mentionedSymbols.map(async (symbol) => {
      const query = `${symbol} NSE stock news India ${new Date().getFullYear()}`;
      const response = await client.search(query, {
        searchDepth: "basic",
        topic: "news",
        maxResults: TAVILY_MAX_RESULTS,
        includeAnswer: "basic",
        timeout: TAVILY_TIMEOUT_MS / 1000,
      });
      return { symbol, summary: summariseTavilyResponse(response) };
    }),
  );

  for (const item of settled) {
    if (item.status === "fulfilled" && item.value.summary !== "") {
      newsBySymbol[item.value.symbol] = item.value.summary;
    }
  }

  return {
    marketNews: newsBySymbol,
    usedMarketNews: Object.keys(newsBySymbol).length > 0,
  };
}

function summariseTavilyResponse(response: TavilySearchResponse): string {
  const parts: string[] = [];
  if (typeof response.answer === "string" && response.answer.trim() !== "") {
    parts.push(response.answer.trim());
  }

  const topResults = response.results.slice(0, 2);
  for (const result of topResults) {
    const date = result.publishedDate ? ` (${result.publishedDate.slice(0, 10)})` : "";
    const snippet = truncate(result.content.replace(/\s+/g, " ").trim(), 220);
    if (snippet !== "") {
      parts.push(`• ${result.title}${date}: ${snippet}`);
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Node 3: buildFinalContext — merge RAG + current snapshot + market news.
// ---------------------------------------------------------------------------
function buildFinalContextNode(state: ResearchState): Partial<ResearchState> {
  const sections: string[] = [];

  sections.push("PORTFOLIO HISTORY (from your data):");
  sections.push(state.ragContext.trim() === "" ? "(none)" : state.ragContext.trim());

  sections.push("");
  sections.push("CURRENT PORTFOLIO:");
  sections.push(
    state.currentSnapshotText.trim() === ""
      ? "(no snapshot uploaded yet)"
      : state.currentSnapshotText.trim(),
  );

  const newsEntries = Object.entries(state.marketNews);
  if (newsEntries.length > 0) {
    sections.push("");
    sections.push("REAL-TIME MARKET CONTEXT (via Tavily, fetched just now):");
    for (const [symbol, summary] of newsEntries) {
      sections.push(`${symbol}:`);
      sections.push(summary);
      sections.push("");
    }
  }

  return { finalContext: sections.join("\n") };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstSignificantToken(name: string | null | undefined): string | null {
  if (name === null || name === undefined) return null;
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  if (cleaned === "") return null;
  return cleaned.split(/\s+/)[0];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function hasExitIntent(upperQuestion: string): boolean {
  const lower = upperQuestion.toLowerCase();
  return EXIT_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

function isPurelyGenericQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  return GENERIC_QUESTION_KEYWORDS.some((kw) => lower.includes(kw));
}

function topLossSymbols(holdings: Holding[], limit: number): string[] {
  return [...holdings]
    .filter((h) => h.unrealisedGainPct < 0)
    .sort((a, b) => a.unrealisedGainPct - b.unrealisedGainPct)
    .slice(0, limit)
    .map((h) => h.symbol);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
