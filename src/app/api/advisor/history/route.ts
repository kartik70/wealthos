import { requireAuth } from "@/lib/db/require-auth";

export const runtime = "nodejs";

interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  const { data, error } = await supabase
    .from("advisor_conversations")
    .select("id, role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error !== null) {
    return Response.json(
      { error: `Failed to fetch advisor history: ${error.message}` },
      { status: 500 },
    );
  }

  const messages: HistoryMessage[] = [...(data ?? [])].sort((a, b) => {
    const timeDelta =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

    if (timeDelta !== 0) {
      return timeDelta;
    }

    // Keep user message before assistant if timestamps are equal.
    if (a.role !== b.role) {
      return a.role === "user" ? -1 : 1;
    }

    return a.id.localeCompare(b.id);
  });

  return Response.json({ messages });
}
