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
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error !== null) {
      setErrorMessage(error.message);
      setIsLoading(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.06) 0%, transparent 60%), #0a0f1e",
      }}
    >
      {/* Wordmark top-left */}
      <header className="flex items-center gap-2.5 px-6 py-6 lg:px-12 lg:py-8">
        <div
          className="grid size-8 place-items-center rounded-md"
          style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" }}
        >
          <Landmark className="size-4" aria-hidden="true" />
        </div>
        <span
          className="text-base tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          WealthOS
        </span>
      </header>

      {/* Main two-column hero */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-6 pb-24 lg:px-12">
        <div className="grid w-full grid-cols-1 items-center gap-16 lg:grid-cols-[55fr_45fr] lg:gap-20">
          {/* Left: 55% */}
          <section className="flex flex-col gap-10">
            <span
              className="text-xs font-medium uppercase tracking-[0.22em]"
              style={{ color: "#3b82f6" }}
            >
              Portfolio Intelligence
            </span>

            <h1
              className="leading-[1.02] tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 300,
                fontSize: "clamp(44px, 5.4vw, 64px)",
              }}
            >
              <span style={{ color: "#ffffff" }}>Your portfolio.</span>
              <br />
              <span style={{ color: "#3b82f6" }}>Understood.</span>
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
                  style={{ color: "#8899aa" }}
                >
                  <span
                    aria-hidden="true"
                    className="font-mono"
                    style={{ color: "#3b82f6" }}
                  >
                    →
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Right: 45% — sign in card */}
          <section className="flex justify-center lg:justify-end">
            <div
              className="w-full max-w-md rounded-2xl p-10"
              style={{
                background: "#111827",
                border: "1px solid #1e2d40",
              }}
            >
              <div className="flex flex-col items-center gap-6">
                <div
                  className="grid size-12 place-items-center rounded-xl"
                  style={{
                    background: "rgba(59, 130, 246, 0.12)",
                    color: "#3b82f6",
                  }}
                >
                  <Landmark className="size-6" aria-hidden="true" />
                </div>

                <div className="space-y-2 text-center">
                  <h2
                    className="text-2xl tracking-tight text-white"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 500,
                    }}
                  >
                    Welcome back
                  </h2>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#8899aa" }}
                  >
                    Sign in to access your portfolio intelligence.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#1f2937] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GoogleIcon />
                  {isLoading ? "Redirecting…" : "Continue with Google"}
                </button>

                <p
                  className="-mt-3 text-center text-xs"
                  style={{ color: "#4a5568" }}
                >
                  No account needed — sign in to get started
                </p>

                {errorMessage !== null ? (
                  <p
                    className="w-full rounded-md px-3 py-2 text-xs"
                    style={{
                      background: "rgba(244, 63, 94, 0.08)",
                      color: "#f43f5e",
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
        className="absolute inset-x-0 bottom-8 text-center text-xs"
        style={{ color: "#4a5568" }}
      >
        Self-hosted · Open source · Your keys, your data
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
