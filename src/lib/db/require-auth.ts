import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "./supabase";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type AuthenticatedContext = {
  supabase: ServerSupabaseClient;
  user: User;
  userId: string;
};

export async function requireAuth():
  Promise<{ data: AuthenticatedContext } | { error: Response }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error !== null || user === null) {
    return {
      error: Response.json({ error: "Unauthorised" }, { status: 401 }),
    };
  }

  return {
    data: { supabase, user, userId: user.id },
  };
}
