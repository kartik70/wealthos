import { requireAuth } from "@/lib/db/require-auth";
import { embedGoals } from "@/lib/ai/embeddings";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;

  if (!id) {
    return Response.json({ error: "Goal id is required" }, { status: 400 });
  }

  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error !== null) {
    return Response.json(
      { error: `Failed to delete goal: ${error.message}` },
      { status: 500 },
    );
  }

  try {
    await embedGoals(userId);
  } catch (embedErr) {
    console.error("Failed to refresh goal embeddings after delete", embedErr);
  }

  return Response.json({ success: true });
}
