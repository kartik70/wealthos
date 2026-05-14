import {
  createBrowserClient,
  createServerClient,
} from "@supabase/ssr";

import type { Database } from "../../types/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseConfig(): { url: string; anonKey: string } {
  if (supabaseUrl === undefined || supabaseUrl === "") {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (supabaseAnonKey === undefined || supabaseAnonKey === "") {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  };
}

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseConfig();

  return createBrowserClient<Database>(url, anonKey);
}

export async function createSupabaseServerClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; middleware should refresh sessions.
        }
      },
    },
  });
}
