import { requireAuth } from "@/lib/db/require-auth";

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
    return Response.json({ error: "Snapshot id is required" }, { status: 400 });
  }

  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, userId } = auth.data;

  const { data: snapshot, error: fetchError } = await supabase
    .from("portfolio_snapshots")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError !== null) {
    return Response.json(
      { error: `Failed to fetch snapshot: ${fetchError.message}` },
      { status: 500 },
    );
  }

  if (snapshot === null || snapshot.user_id !== userId) {
    return Response.json({ error: "Snapshot not found" }, { status: 404 });
  }

  const { error: holdingsDeleteError } = await supabase
    .from("holdings")
    .delete()
    .eq("snapshot_id", id);

  if (holdingsDeleteError !== null) {
    return Response.json(
      { error: `Failed to delete holdings: ${holdingsDeleteError.message}` },
      { status: 500 },
    );
  }

  const { error: insightsDeleteError } = await supabase
    .from("ai_insights")
    .delete()
    .eq("snapshot_id", id);

  if (insightsDeleteError !== null) {
    return Response.json(
      { error: `Failed to delete insights: ${insightsDeleteError.message}` },
      { status: 500 },
    );
  }

  const { error: embeddingsDeleteError } = await supabase
    .from("snapshot_embeddings")
    .delete()
    .eq("snapshot_id", id);

  if (embeddingsDeleteError !== null) {
    return Response.json(
      { error: `Failed to delete embeddings: ${embeddingsDeleteError.message}` },
      { status: 500 },
    );
  }

  const { error: snapshotDeleteError } = await supabase
    .from("portfolio_snapshots")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (snapshotDeleteError !== null) {
    return Response.json(
      { error: `Failed to delete snapshot: ${snapshotDeleteError.message}` },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
