import type { Holding, PortfolioSnapshot } from "@/types/portfolio";

export function buildAdvisorSystemPrompt(
  retrievedContext: string,
  currentSnapshot: PortfolioSnapshot | null,
): string {
  const currentSnapshotSection =
    currentSnapshot !== null ? buildCurrentSnapshotSection(currentSnapshot) : "";

  return `You are WealthOS, a personal portfolio intelligence advisor.
You have access to both the user's portfolio history (retrieved from their own data) AND real-time market news for relevant holdings (fetched live via a research agent when applicable).
Always cite whether your answer is based on portfolio data ("from your snapshots") or current market news ("per recent news"). Never blur the two.
Always cite specific dates and numbers from the context.
Never make up data not present in the context.
Be concise, specific, and actionable.

Retrieved portfolio history (most relevant to the question):
${retrievedContext}
${currentSnapshotSection}
Answer the user's question using both the retrieved history and current snapshot.`;
}

/**
 * Variant used by the Research Agent pipeline: the caller has already
 * assembled the merged context (RAG + current snapshot + market news)
 * into a single block via `runResearchAgent`, so the system prompt just
 * injects that block verbatim.
 */
export function buildAdvisorSystemPromptFromContext(finalContext: string): string {
  return `You are WealthOS, a personal portfolio intelligence advisor.
You have access to both the user's portfolio history AND real-time market news for relevant holdings.
Always cite whether your answer is based on portfolio data ("from your snapshots") or current market news ("per recent news"). Never blur the two.
Always cite specific dates and numbers from the context.
Never make up data not present in the context.
Be concise, specific, and actionable.

${finalContext}

Answer the user's question grounded in the context above.`;
}

/**
 * Plain-text snapshot summary used by the Research Agent as the
 * "CURRENT PORTFOLIO" section of the merged context.
 */
export function buildCurrentSnapshotText(snapshot: PortfolioSnapshot | null): string {
  if (snapshot === null) return "";
  return buildCurrentSnapshotSection(snapshot).trim();
}

function buildCurrentSnapshotSection(snapshot: PortfolioSnapshot): string {
  const date = new Date(snapshot.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const top10 = getTop10Holdings(snapshot.holdings);
  const holdingsText = top10
    .map(
      (h) =>
        `${h.symbol} ${h.allocationPct.toFixed(1)}% (${h.unrealisedGainPct >= 0 ? "+" : ""}${h.unrealisedGainPct.toFixed(1)}%)`,
    )
    .join(", ");

  return `
Current portfolio snapshot (${date}):
Total value: ₹${snapshot.totalValue.toLocaleString("en-IN")} | Gain/Loss: ₹${snapshot.totalGain.toLocaleString("en-IN")} (${snapshot.totalGainPct >= 0 ? "+" : ""}${snapshot.totalGainPct.toFixed(2)}%)
Top holdings (showing top 10 of ${snapshot.holdings.length} holdings): ${holdingsText}`;
}

function getTop10Holdings(holdings: Holding[]): Holding[] {
  return [...holdings].sort((a, b) => b.allocationPct - a.allocationPct).slice(0, 10);
}
