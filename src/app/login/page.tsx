"use client";

import { Landmark } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/db/supabase";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function signInWithGoogle() {
    setIsLoading(true);
    setErrorMessage(null);

    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error !== null) {
      setErrorMessage(error.message);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-lg bg-foreground text-background">
            <Landmark className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">WealthOS</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Portfolio intelligence for your investments
            </p>
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={() => void signInWithGoogle()}
          disabled={isLoading}
        >
          {isLoading ? "Redirecting…" : "Sign in with Google"}
        </Button>

        {errorMessage !== null ? (
          <p className="text-center text-sm text-rose-500">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
