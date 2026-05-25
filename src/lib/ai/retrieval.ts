import { createSupabaseAdminClient } from "../db/supabase";
import { generateEmbedding } from "./embeddings";
import { resolveGeminiKey } from "./keyResolver";

export async function retrieveRelevantContext(
  question: string,
  userId: string,
  topK: number = 5,
): Promise<string> {
  const supabase = createSupabaseAdminClient();

  const apiKey = await resolveGeminiKey(userId);
  const questionEmbedding = await generateEmbedding(question, apiKey);

  const { data, error } = await supabase.rpc("match_snapshot_embeddings", {
    query_embedding: questionEmbedding,
    match_user_id: userId,
    match_count: topK,
  });

  if (error !== null) {
    // Fallback: if the RPC doesn't exist yet, fetch recent snapshots as plain text
    const { data: fallback } = await supabase
      .from("snapshot_embeddings")
      .select("content, chunk_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(topK);

    if (fallback === null || fallback.length === 0) {
      return "No portfolio history available.";
    }

    return formatChunks(fallback);
  }

  if (data === null || (data as unknown[]).length === 0) {
    return "No relevant portfolio history found.";
  }

  return formatChunks(data as Array<{ content: string; chunk_type: string; created_at: string }>);
}

function formatChunks(
  chunks: Array<{ content: string; chunk_type: string; created_at: string }>,
): string {
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
