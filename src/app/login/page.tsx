"use client";

import { Landmark } from "lucide-react";
import { useState } from "react";

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
    <div
      className="relative flex min-h-screen flex-col px-6 py-6 lg:px-12 lg:py-10"
      style={{ background: "var(--background)" }}
    >
      {/* Wordmark top-left */}
      <header className="flex items-center gap-2.5">
        <div
          className="grid size-8 place-items-center rounded-md"
          style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
        >
          <Landmark className="size-4" aria-hidden="true" />
        </div>
        <span
          className="text-base font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          WealthOS
        </span>
      </header>

      {/* Main centered two-column layout */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: headline */}
          <section className="flex flex-col gap-10">
            <h1
              className="leading-[1.05] tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 300,
                fontSize: "clamp(40px, 5.6vw, 56px)",
                color: "var(--text-primary)",
              }}
            >
              Your portfolio.
              <br />
              <span style={{ color: "var(--text-secondary)" }}>Understood.</span>
            </h1>

            <ul className="flex flex-col gap-3.5">
              {[
                "Snapshot intelligence across time",
                "AI advisor with full history",
                "Tax harvesting & sector analysis",
              ].map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: "var(--gain)" }}
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Right: sign in card */}
          <section className="flex justify-center lg:justify-end">
            <div
              className="w-full max-w-md rounded-xl p-8"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex flex-col items-start gap-6">
                <div
                  className="grid size-11 place-items-center rounded-lg"
                  style={{
                    background: "var(--accent-muted)",
                    color: "var(--accent)",
                  }}
                >
                  <Landmark className="size-5" aria-hidden="true" />
                </div>

                <div className="space-y-1.5">
                  <h2
                    className="text-xl tracking-tight"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    Welcome back
                  </h2>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Sign in to access your portfolio intelligence.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  disabled={isLoading}
                  className="flex h-11 w-full items-center justify-center gap-3 rounded-md bg-white px-4 text-sm font-medium text-[#1f2937] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GoogleIcon />
                  {isLoading ? "Redirecting…" : "Continue with Google"}
                </button>

                {errorMessage !== null ? (
                  <p
                    className="w-full rounded-md px-3 py-2 text-xs"
                    style={{
                      background: "rgba(244, 63, 94, 0.08)",
                      color: "var(--loss)",
                      border: "1px solid rgba(244, 63, 94, 0.25)",
                    }}
                  >
                    {errorMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer
        className="pt-8 text-xs"
        style={{ color: "var(--text-tertiary)" }}
      >
        Self-hosted. Your keys, your data.
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
