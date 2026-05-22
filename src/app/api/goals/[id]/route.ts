import { createSupabaseAdminClient } from "@/lib/db/supabase";

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

  const supabase = createSupabaseAdminClient();
  const userId = "local-dev-user";

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

  return Response.json({ success: true });
}
