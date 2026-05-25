import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Brain,
  Camera,
  Calculator,
  KeyRound,
  Landmark,
  LineChart,
  Star,
  Target,
} from "lucide-react";

const GITHUB_URL = "https://github.com/kartik70/wealthos";
const LINKEDIN_URL = "https://linkedin.com/in/kartik-kakad";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.944.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.852 3.37-1.852 3.601 0 4.268 2.37 4.268 5.455v6.288zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Camera,
    title: "Snapshot Timeline",
    body: "Every portfolio state saved. Compare any two dates. See exactly what changed.",
  },
  {
    icon: Brain,
    title: "RAG-Powered Advisor",
    body: "Chat with your entire portfolio history. Claude retrieves relevant snapshots to answer precisely.",
  },
  {
    icon: Calculator,
    title: "Deterministic Engine",
    body: "P&L, CAGR, tax, concentration computed in pure code. AI never touches the math.",
  },
  {
    icon: Target,
    title: "Deep Analysis",
    body: "Health score, sector classification, tax harvesting opportunities, action plan.",
  },
  {
    icon: KeyRound,
    title: "Your Keys, Your Data",
    body: "Bring your own Anthropic or Gemini API key. Self-host on Vercel for free.",
  },
  {
    icon: LineChart,
    title: "Equity + Mutual Funds",
    body: "Kite CSV for equity. Groww XLSX for MFs. Combined portfolio intelligence.",
  },
];

const ARCHITECTURE_STEPS = [
  "Kite CSV  ·  Groww XLSX",
  "Pure TS Finance Engine\n(P&L · Tax · Risk · Diff)",
  "Prompt Builder",
  "Claude  /  Gemini",
  "Structured JSON (Zod validated)",
  "Dashboard  ·  Insights  ·  Advisor",
];

const STACK_ROWS: string[][] = [
  ["Next.js 15", "TypeScript", "Tailwind", "shadcn/ui", "Zustand", "Recharts"],
  ["Supabase", "pgvector", "Anthropic Claude", "Google Gemini", "Vercel"],
];

export default function LandingPage() {
  return (
    <div style={{ background: "#0a0f1e", color: "#f0f4f8" }}>
      <Nav />
      <Hero />
      <Features />
      <Architecture />
      <Stack />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 backdrop-blur-md"
      style={{
        background: "rgba(10, 15, 30, 0.8)",
        borderBottom: "1px solid #1e2d40",
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="grid size-8 place-items-center rounded-lg"
            style={{ background: "rgba(30, 58, 138, 0.3)", color: "#3b82f6" }}
          >
            <Landmark className="size-4" aria-hidden="true" />
          </span>
          <span
            className="text-base text-white"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            WealthOS
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors sm:inline-flex"
            style={{ color: "#8899aa" }}
          >
            <GithubIcon className="size-4" />
            View on GitHub
          </a>
          <Link
            href="/login"
            className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "#3b82f6" }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section
      className="relative flex flex-col items-center justify-center px-6 pb-20 pt-32 text-center sm:pb-24 sm:pt-36"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%), #0a0f1e",
      }}
    >
      <div
        className="fade-in-up mx-auto flex max-w-3xl flex-col items-center gap-6"
        style={{ animationDelay: "0.05s" }}
      >
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] tracking-[0.18em] uppercase font-mono"
          style={{
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            color: "#3b82f6",
          }}
        >
          OPEN SOURCE · BYOK · SELF-HOSTABLE
        </span>

        <h1
          className="leading-[1.05] tracking-tight"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 300,
            fontSize: "clamp(40px, 8vw, 72px)",
          }}
        >
          <span className="text-white">Your portfolio.</span>
          <br />
          <span style={{ color: "#3b82f6" }}>Finally understood.</span>
        </h1>

        <p
          className="mx-auto max-w-xl text-base leading-relaxed sm:text-[17px]"
          style={{ color: "#8899aa" }}
        >
          AI-powered portfolio intelligence for Indian investors. Upload your
          Kite and Groww exports, get deep analysis, and chat with your entire
          investment history.
        </p>

        <div className="mt-1 flex flex-col items-center gap-3 sm:flex-row sm:gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "#ffffff", color: "#0a0f1e" }}
          >
            <Star className="size-4" aria-hidden="true" />
            Star on GitHub
          </a>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "#3b82f6" }}
          >
            Try Live Demo
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <p className="text-xs" style={{ color: "#4a5568" }}>
          Free to self-host · Bring your own Claude or Gemini key
        </p>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-[11px] uppercase tracking-[0.22em]"
      style={{ color: "#3b82f6", fontFamily: "var(--font-mono)" }}
    >
      {children}
    </span>
  );
}

function Features() {
  return (
    <section
      className="fade-in-up px-6 py-28"
      style={{ animationDelay: "0.1s" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex flex-col gap-4 text-center">
          <SectionLabel>WHY WEALTHOS</SectionLabel>
          <h2
            className="mx-auto max-w-3xl text-3xl leading-tight tracking-tight text-white sm:text-4xl"
            style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
          >
            Intelligence your broker dashboard will never give you.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="fade-in-up rounded-xl p-6 transition-colors"
                style={{
                  background: "#111827",
                  border: "1px solid #1e2d40",
                  animationDelay: `${0.15 + idx * 0.05}s`,
                }}
              >
                <div
                  className="mb-4 inline-grid place-items-center rounded-lg p-2"
                  style={{ background: "#1d3a5f", color: "#3b82f6" }}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h3
                  className="mb-2 text-base text-white"
                  style={{ fontWeight: 500 }}
                >
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#8899aa" }}>
                  {feature.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  return (
    <section
      className="fade-in-up px-6 py-28"
      style={{
        animationDelay: "0.1s",
        background: "rgba(17, 24, 39, 0.4)",
        borderTop: "1px solid #1e2d40",
        borderBottom: "1px solid #1e2d40",
      }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 flex flex-col gap-4 text-center">
          <SectionLabel>BUILT RIGHT</SectionLabel>
          <h2
            className="text-3xl leading-tight tracking-tight text-white sm:text-4xl"
            style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
          >
            Deterministic finance. AI interpretation. Clean separation.
          </h2>
        </div>

        <div className="flex flex-col items-center gap-3">
          {ARCHITECTURE_STEPS.map((step, idx) => (
            <div
              key={step}
              className="flex w-full max-w-sm flex-col items-center gap-3"
            >
              <div
                className="w-full whitespace-pre-line rounded-lg px-4 py-2.5 text-center font-mono text-sm"
                style={{
                  background: "#111827",
                  border: "1px solid #1e2d40",
                  color: "#f0f4f8",
                }}
              >
                {step}
              </div>
              {idx < ARCHITECTURE_STEPS.length - 1 ? (
                <span
                  className="font-mono text-lg leading-none"
                  style={{ color: "#3b82f6" }}
                  aria-hidden="true"
                >
                  ↓
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <p
          className="mt-10 text-center text-sm italic"
          style={{ color: "#8899aa" }}
        >
          The AI never calculates. It only interprets.
        </p>
      </div>
    </section>
  );
}

function Stack() {
  return (
    <section
      className="fade-in-up px-6 py-28"
      style={{ animationDelay: "0.1s" }}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex flex-col gap-4 text-center">
          <SectionLabel>STACK</SectionLabel>
          <h2
            className="text-3xl leading-tight tracking-tight text-white sm:text-4xl"
            style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
          >
            Boring tools, picked deliberately.
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {STACK_ROWS.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="flex flex-wrap items-center justify-center gap-2"
            >
              {row.map((badge) => (
                <span
                  key={badge}
                  className="rounded-lg px-4 py-2 font-mono text-sm"
                  style={{
                    background: "#111827",
                    border: "1px solid #1e2d40",
                    color: "#8899aa",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #1e2d40" }} className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <span
              className="text-base text-white"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              WealthOS
            </span>
            <span className="text-sm" style={{ color: "#8899aa" }}>
              Portfolio intelligence for Indian investors.
            </span>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex items-center gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white"
                style={{ color: "#8899aa" }}
              >
                <GithubIcon className="size-4" />
                GitHub
              </a>
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white"
                style={{ color: "#8899aa" }}
              >
                <LinkedinIcon className="size-4" />
                LinkedIn
              </a>
            </div>
            <span className="text-sm" style={{ color: "#8899aa" }}>
              Built by{" "}
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="transition-colors hover:text-white"
                style={{ color: "#3b82f6" }}
              >
                Kartik Kakad
              </a>
            </span>
          </div>
        </div>

        <p
          className="mt-8 text-center text-xs font-mono"
          style={{ color: "#4a5568" }}
        >
          MIT License · Self-host for free
        </p>
      </div>
    </footer>
  );
}
