import { streamAdvisorResponse } from "@/lib/ai/client";
import {
  missingApiKeyResponse,
  resolveGeminiKey,
  resolveProviderKey,
} from "@/lib/ai/keyResolver";
import { requireAuth } from "@/lib/db/require-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase";
import { retrieveRelevantContext } from "../../../../lib/ai/retrieval";
import { generateEmbedding } from "../../../../lib/ai/embeddings";
import { analyseQuery } from "../../../../lib/ai/queryAnalyser";
import { runResearchAgent } from "../../../../lib/ai/researchAgent";
import {
  buildStaticAdvisorSystemPrompt,
  buildCurrentSnapshotText,
} from "../../../../features/ai/advisorPromptBuilder";
import type { PortfolioSnapshot } from "../../../../types/portfolio";
import type { HoldingRow, PortfolioSnapshotRow } from "../../../../types/db";
import { getAIProviderFromRequest, getModelFromRequest } from "../../../../lib/ai/provider";

export const runtime = "nodejs";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  conversationHistory: Message[];
}

type ConversationInsert = {
  user_id: string;
  role: "user" | "assistant";
  content: string;
};

const RATE_LIMIT_MAX_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const ADVISOR_SYSTEM_PROMPT = `Guardrails:
- If the user asks anything unrelated to their portfolio, investing, or personal finance, respond in one short sentence and redirect to what WealthOS can analyze from their portfolio data.
- Only answer using data from the retrieved context and current snapshot. If the data to answer a question is not in the context, say so explicitly. Never make up stock prices, dates, or portfolio values.
- When data needed to answer is missing from context, keep the reply short and direct: state what data is missing and suggest uploading older CSVs from the Timeline page. Do not provide a bulleted list of workaround steps.
- Do not use moralising or lecture-style caveats. Keep refusals and limitations brief, then redirect to actionable portfolio analysis the system can provide.`;

export async function POST(request: Request): Promise<Response> {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, conversationHistory } = body;

  if (typeof message !== "string") {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const sanitizedMessage = stripHtmlAndScriptTags(message).trim();

  if (sanitizedMessage === "") {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (sanitizedMessage.length > 500) {
    return Response.json(
      { error: "message must be 500 characters or less" },
      { status: 400 },
    );
  }

  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  if (await isRateLimited(supabase, userId)) {
    return Response.json(
      { error: "Too many requests, please wait before sending more messages" },
      { status: 429 },
    );
  }

  const provider = getAIProviderFromRequest(request);
  const modelOverride = getModelFromRequest(request) ?? undefined;
  let apiKey: string;
  try {
    apiKey = await resolveProviderKey(userId, provider);
  } catch (err) {
    const keyResponse = missingApiKeyResponse(err);
    if (keyResponse !== null) {
      return keyResponse;
    }
    throw err;
  }

  let retrievedContext: string;
  let retrievedChunksCount: number;
  let retrievedChunkTypes: string[];
  let currentSnapshot: PortfolioSnapshot | null;
  let mfSummary: string | null = null;
  try {
    // Fix 2: question embedding and snapshot fetch are independent — run in parallel.
    const geminiApiKey = await resolveGeminiKey(userId);
    const [questionEmbedding, snapshotResult] = await Promise.all([
      generateEmbedding(sanitizedMessage, geminiApiKey, "RETRIEVAL_QUERY"),
      fetchCurrentSnapshot(supabase, userId),
    ]);
    currentSnapshot = snapshotResult.snapshot;
    mfSummary = snapshotResult.mfSummary;
    const queryAnalysis = analyseQuery(
      sanitizedMessage,
      currentSnapshot?.holdings ?? [],
    );
    const retrieval = await retrieveRelevantContext(sanitizedMessage, userId, {
      topK: 5,
      chunkTypes: queryAnalysis.chunkTypes,
      dateRange: queryAnalysis.dateRange ?? undefined,
      precomputedEmbedding: questionEmbedding,
    });
    retrievedContext = retrieval.context;
    retrievedChunksCount = retrieval.chunksUsed;
    retrievedChunkTypes = retrieval.chunkTypes;
  } catch (err) {
    const keyResponse = missingApiKeyResponse(err);
    if (keyResponse !== null) {
      return keyResponse;
    }
    throw err;
  }

  // Extract symbols mentioned in recent conversation for multi-turn awareness.
  const recentSymbols = conversationHistory
    .slice(-4)
    .flatMap((msg) => analyseQuery(msg.content, currentSnapshot?.holdings ?? []).symbols);

  // Run the LangGraph research agent: extract symbols → (optionally) fetch
  // real-time market news via Tavily → assemble final context.
  let finalContext: string;
  let usedMarketNews = false;
  let mentionedSymbols: string[] = [];
  try {
    const agentResult = await runResearchAgent({
      question: sanitizedMessage,
      userId,
      ragContext: retrievedContext,
      currentSnapshotText: buildCurrentSnapshotText(currentSnapshot, mfSummary),
      snapshot: currentSnapshot,
      additionalSymbols: recentSymbols,
    });
    finalContext = agentResult.finalContext;
    usedMarketNews = agentResult.usedMarketNews;
    mentionedSymbols = agentResult.mentionedSymbols;
  } catch (err) {
    // Tavily failure (e.g., missing key or upstream timeout) should not break
    // the chat — fall back to plain RAG + snapshot context.
    console.error("[advisor/chat] research agent failed:", err);
    const snapshotText = buildCurrentSnapshotText(currentSnapshot, mfSummary);
    finalContext = `PORTFOLIO HISTORY (from your data):\n${retrievedContext}\n\nCURRENT PORTFOLIO:\n${snapshotText === "" ? "(no snapshot uploaded yet)" : snapshotText}`;
  }

  const systemPrompt = buildGuardrailedSystemPrompt();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send metadata first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "meta",
              retrievedChunks: retrievedChunksCount,
              retrievedChunkTypes,
              provider,
              usedMarketNews,
              mentionedSymbols,
            })}\n\n`,
          ),
        );

        const assistantResponse = await streamAdvisorResponse({
          provider,
          apiKey,
          modelOverride,
          systemPrompt,
          contextMessage: finalContext,
          conversationHistory,
          userMessage: sanitizedMessage,
          onDelta(text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`),
            );
          },
        });

        await saveConversationTurn(
          supabase,
          userId,
          sanitizedMessage,
          assistantResponse,
        );

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: err instanceof Error ? err.message : "Unknown error" })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function buildGuardrailedSystemPrompt(): string {
  return `${buildStaticAdvisorSystemPrompt()}\n\n${ADVISOR_SYSTEM_PROMPT}`;
}

function stripHtmlAndScriptTags(input: string): string {
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

// ponytail: uses existing advisor_conversations table — no extra infra, survives cold starts
async function isRateLimited(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("advisor_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", windowStart);
  return (count ?? 0) >= RATE_LIMIT_MAX_MESSAGES;
}

async function saveConversationTurn(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  userMessage: string,
  assistantResponse: string,
): Promise<void> {
  const rows: ConversationInsert[] = [
    {
      user_id: userId,
      role: "user",
      content: userMessage,
    },
    {
      user_id: userId,
      role: "assistant",
      content: assistantResponse,
    },
  ];

  const { error } = await supabase.from("advisor_conversations").insert(rows);

  if (error !== null) {
    throw new Error(`Failed to persist advisor conversation: ${error.message}`);
  }
}

async function fetchCurrentSnapshot(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<{ snapshot: PortfolioSnapshot | null; mfSummary: string | null }> {
  const { data: snapshotRow } = await supabase
    .from("portfolio_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotRow === null) return { snapshot: null, mfSummary: null };

  const [{ data: holdingRows }, { data: mfRow }] = await Promise.all([
    supabase.from("holdings").select("*").eq("snapshot_id", snapshotRow.id),
    supabase
      .from("mutual_fund_snapshots")
      .select("total_current_value, total_returns_pct")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const snapshot = rowToSnapshot(snapshotRow, holdingRows ?? []);
  const mfSummary =
    mfRow !== null
      ? `MF total: ₹${(mfRow.total_current_value as number).toFixed(0)} (${(mfRow.total_returns_pct as number) >= 0 ? "+" : ""}${(mfRow.total_returns_pct as number).toFixed(1)}%)`
      : null;

  return { snapshot, mfSummary };
}

function rowToSnapshot(row: PortfolioSnapshotRow, holdingRows: HoldingRow[]): PortfolioSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    totalValue: row.total_value,
    totalCost: row.total_cost,
    totalGain: row.total_gain,
    totalGainPct: row.total_gain_pct,
    holdings: holdingRows.map((h) => ({
      symbol: h.symbol,
      name: h.name ?? h.symbol,
      quantity: h.quantity,
      avgCost: h.avg_cost,
      currentPrice: h.current_price,
      currentValue: h.current_value,
      unrealisedGain: h.unrealised_gain,
      unrealisedGainPct: h.unrealised_gain_pct,
      allocationPct: h.allocation_pct,
    })),
    source: (row.source as PortfolioSnapshot["source"]) ?? "manual",
    contextCache: row.context_cache,
  };
}
