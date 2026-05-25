import { createSupabaseAdminClient } from "../db/supabase";
import { generateEmbedding } from "./embeddings";
import { resolveGeminiKey } from "./keyResolver";

export type ChunkType =
  | "snapshot_summary"
  | "diff_summary"
  | "insight_summary"
  | "goal_summary";

interface SearchResult {
  id: string;
  content: string;
  chunk_type: string;
  created_at: string;
}

export interface RetrieveOptions {
  topK?: number;
  chunkTypes?: ChunkType[];
  dateRange?: { from: string; to: string };
  symbols?: string[];
}

export interface RetrieveResult {
  context: string;
  chunksUsed: number;
  chunkTypes: string[];
}

const NO_HISTORY = "No portfolio history available.";
const NO_RELEVANT = "No relevant portfolio history found.";

export async function retrieveRelevantContext(
  question: string,
  userId: string,
  options?: RetrieveOptions,
): Promise<RetrieveResult> {
  const supabase = createSupabaseAdminClient();
  const topK = options?.topK ?? 5;
  const chunkTypes =
    options?.chunkTypes && options.chunkTypes.length > 0
      ? options.chunkTypes
      : null;
  const dateFrom = options?.dateRange?.from ?? null;
  const dateTo = options?.dateRange?.to ?? null;

  const apiKey = await resolveGeminiKey(userId);
  const questionEmbedding = await generateEmbedding(question, apiKey);

  const [semanticRes, keywordRes] = await Promise.all([
    supabase.rpc("match_snapshot_embeddings_filtered", {
      query_embedding: questionEmbedding,
      match_user_id: userId,
      match_count: 10,
      chunk_types: chunkTypes,
      date_from: dateFrom,
      date_to: dateTo,
    }),
    supabase.rpc("keyword_search_snapshot_embeddings", {
      query_text: question,
      match_user_id: userId,
      match_count: 10,
      chunk_types: chunkTypes,
      date_from: dateFrom,
      date_to: dateTo,
    }),
  ]);

  const semanticResults: SearchResult[] =
    semanticRes.error === null && semanticRes.data !== null
      ? (semanticRes.data as SearchResult[])
      : [];

  const keywordResults: SearchResult[] =
    keywordRes.error === null && keywordRes.data !== null
      ? (keywordRes.data as SearchResult[])
      : [];

  if (semanticResults.length === 0 && keywordResults.length === 0) {
    // Fallback: recent chunks for the user
    const fallbackQuery = supabase
      .from("snapshot_embeddings")
      .select("id, content, chunk_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(topK);

    const { data: fallback } = await fallbackQuery;
    if (fallback === null || fallback.length === 0) {
      return { context: NO_HISTORY, chunksUsed: 0, chunkTypes: [] };
    }

    const ctx = formatChunks(fallback as SearchResult[]);
    return {
      context: ctx,
      chunksUsed: fallback.length,
      chunkTypes: uniqueChunkTypes(fallback as SearchResult[]),
    };
  }

  const merged = reciprocalRankFusion(semanticResults, keywordResults, 60).slice(
    0,
    topK,
  );

  if (merged.length === 0) {
    return { context: NO_RELEVANT, chunksUsed: 0, chunkTypes: [] };
  }

  return {
    context: formatChunks(merged),
    chunksUsed: merged.length,
    chunkTypes: uniqueChunkTypes(merged),
  };
}

function reciprocalRankFusion(
  semanticResults: SearchResult[],
  keywordResults: SearchResult[],
  k: number = 60,
): SearchResult[] {
  const scores = new Map<string, number>();

  semanticResults.forEach((result, rank) => {
    const current = scores.get(result.id) ?? 0;
    scores.set(result.id, current + 1 / (k + rank + 1));
  });

  keywordResults.forEach((result, rank) => {
    const current = scores.get(result.id) ?? 0;
    scores.set(result.id, current + 1 / (k + rank + 1));
  });

  const allResults = [...semanticResults, ...keywordResults].filter(
    (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i,
  );

  return allResults.sort(
    (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0),
  );
}

function uniqueChunkTypes(chunks: SearchResult[]): string[] {
  const set = new Set<string>();
  for (const c of chunks) set.add(c.chunk_type);
  return Array.from(set);
}

function formatChunks(chunks: SearchResult[]): string {
  return chunks
    .map((chunk) => {
      const label = chunk.chunk_type.replace(/_/g, " ");
      return `[${label}]\n${truncateChunkContent(chunk.content)}`;
    })
    .join("\n\n---\n\n");
}

function truncateChunkContent(content: string): string {
  if (content.length <= 300) {
    return content;
  }

  return `${content.slice(0, 300)}...`;
}
