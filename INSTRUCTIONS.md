# WealthOS — Agent Instructions

> Read this file before writing a single line of code. This is the source of truth for all architecture, conventions, and rules. If something isn't covered here, ask before assuming.

---

## What this product is

WealthOS is a personal AI-powered portfolio intelligence platform. It helps the user understand their investments — not predict markets, not execute trades. Think of it as a smart, private financial journal that gets smarter over time.

**It is:**
- A portfolio snapshot and diff engine
- A deterministic financial calculator
- An AI interpretation and narration layer
- A daily alert system for actionable portfolio events

**It is NOT:**
- A trading platform
- A stock predictor
- A chatbot product
- A finfluencer tool

---

## Tech stack (do not deviate without checking INSTRUCTIONS.md first)

| Layer | Tool | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Frontend + API routes in one repo |
| Language | TypeScript (strict mode) | Type safety everywhere |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent UI |
| State | Zustand | Simple client state |
| Charts | Recharts | Portfolio visualisation |
| Database | Supabase (Postgres) | Free tier, auth included |
| AI | Anthropic SDK (direct) | No LiteLLM, no abstraction layer yet |
| Email | Resend | Alert delivery |
| Cron | Vercel Cron Jobs | Daily analysis trigger |
| Deployment | Vercel | Free tier |

**Do not add new dependencies without a clear reason. Every new package must solve a problem that cannot be solved with what's already here.**

---

## Project structure

```
wealthos/
├── INSTRUCTIONS.md               ← you are here
├── docs/                         ← architecture notes, ADRs
├── src/
│   ├── app/
│   │   ├── (dashboard)/          ← main app pages (layout protected)
│   │   │   ├── page.tsx          ← dashboard home
│   │   │   ├── portfolio/
│   │   │   ├── insights/
│   │   │   ├── timeline/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── upload/           ← CSV upload + parse + snapshot creation
│   │   │   ├── insights/         ← AI insight generation
│   │   │   └── daily-analysis/   ← cron-triggered analysis + alert
│   │   ├── layout.tsx
│   │   └── page.tsx              ← landing / login
│   │
│   ├── components/
│   │   ├── ui/                   ← shadcn/ui primitives only
│   │   ├── dashboard/            ← dashboard-specific components
│   │   ├── portfolio/            ← holdings table, allocation chart
│   │   ├── insights/             ← insight cards, recommendation display
│   │   └── layout/               ← sidebar, navbar, shell
│   │
│   ├── features/
│   │   ├── portfolio/            ← upload flow, snapshot logic
│   │   └── ai/                   ← prompt builders, response parsers
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   └── client.ts         ← ONLY place Anthropic SDK is used
│   │   ├── db/
│   │   │   └── supabase.ts       ← ONLY place Supabase client is initialised
│   │   ├── finance/
│   │   │   ├── calculations.ts   ← P&L, CAGR, allocation — pure functions, no AI
│   │   │   ├── risk.ts           ← concentration, sector exposure
│   │   │   └── tax.ts            ← STCG/LTCG logic
│   │   └── parsers/
│   │       ├── kite.ts           ← Kite CSV parser
│   │       └── groww.ts          ← Groww CSV parser
│   │
│   ├── hooks/                    ← custom React hooks
│   ├── stores/                   ← Zustand stores
│   ├── types/                    ← shared TypeScript types and interfaces
│   └── mock/                     ← mock data for development/testing
```

---

## The most important architectural rule

**Deterministic finance logic and AI interpretation must never mix.**

The AI (Claude) must NEVER calculate:
- P&L or unrealised gains
- CAGR or returns
- Tax liability
- Allocation percentages
- Risk metrics
- Concentration ratios

All of the above live in `src/lib/finance/` as pure TypeScript functions.

The AI ONLY receives the **already-calculated output** and does three things:
1. Interprets what the numbers mean in plain language
2. Prioritises which findings need attention
3. Narrates the portfolio story over time

**Example flow — correct:**
```
calculations.ts → { totalGain: 45000, concentration: { HDFC: 28% } }
           ↓
prompt-builder.ts → "Portfolio has ₹45,000 unrealised gain. HDFC concentration is 28%. What should the investor be aware of?"
           ↓
claude → "Your HDFC position is approaching concentration risk territory..."
```

**Example flow — wrong:**
```
claude → "Calculate my returns and tell me if I'm overweight"
```

---

## AI client rules

The Anthropic SDK is only ever called from `src/lib/ai/client.ts`. No component, hook, or API route imports the SDK directly.

```ts
// src/lib/ai/client.ts — the only file that touches Anthropic SDK
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateInsight(prompt: string): Promise<InsightResponse> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });
  // Always parse and validate before returning
  return parseInsightResponse(response.content[0].text);
}
```

All AI responses must be structured JSON validated against a TypeScript type before being used anywhere in the app.

---

## TypeScript conventions

- Strict mode is on. No `any` types.
- All API responses have a typed interface in `src/types/`
- All finance functions have typed inputs and outputs
- All Supabase table rows have a generated or hand-written type in `src/types/db.ts`

Key types to define early:

```ts
// src/types/portfolio.ts
export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  unrealisedGain: number;
  unrealisedGainPct: number;
  allocationPct: number;
}

export interface PortfolioSnapshot {
  id: string;
  userId: string;
  createdAt: string;
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  holdings: Holding[];
  source: "kite" | "groww" | "manual";
}

export interface InsightResponse {
  summary: string;
  recommendations: Recommendation[];
  alerts: Alert[];
  generatedAt: string;
}

export interface Recommendation {
  action: "BUY" | "SELL" | "HOLD" | "REVIEW";
  symbol: string;
  reason: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export interface Alert {
  type: "CONCENTRATION" | "TAX" | "LOSS" | "GOAL" | "REBALANCE";
  message: string;
  urgency: "INFO" | "WARNING" | "ACTION_NEEDED";
}
```

---

## Database schema (Supabase)

```sql
-- Users (handled by Supabase Auth)

-- Portfolio snapshots
create table portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  created_at timestamptz default now(),
  total_value numeric not null,
  total_cost numeric not null,
  total_gain numeric not null,
  total_gain_pct numeric not null,
  source text check (source in ('kite', 'groww', 'manual')),
  raw_data jsonb
);

-- Holdings (linked to snapshot)
create table holdings (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references portfolio_snapshots not null,
  symbol text not null,
  name text,
  quantity numeric not null,
  avg_cost numeric not null,
  current_price numeric not null,
  current_value numeric not null,
  unrealised_gain numeric not null,
  unrealised_gain_pct numeric not null,
  allocation_pct numeric not null
);

-- AI insights (linked to snapshot)
create table ai_insights (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references portfolio_snapshots not null,
  user_id uuid references auth.users not null,
  created_at timestamptz default now(),
  summary text,
  recommendations jsonb,
  alerts jsonb,
  trigger text check (trigger in ('manual', 'cron', 'upload'))
);
```

---

## Environment variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
ALERT_EMAIL=your@email.com
CRON_SECRET=a-random-secret-string
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` to the client. These are server-only.

---

## Alert / cron rules

The `/api/daily-analysis` route is protected by a cron secret header:

```ts
if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
  return new Response("Unauthorised", { status: 401 });
}
```

Vercel Cron config in `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/daily-analysis",
    "schedule": "0 8 * * *"
  }]
}
```

The daily analysis flow:
1. Fetch latest snapshot for each user from DB
2. Run deterministic analysis (finance functions)
3. Check thresholds (concentration > 25%, loss > 10%, tax event approaching)
4. If any threshold crossed → call Claude with analysis data
5. Send email alert via Resend only if `urgency === "ACTION_NEEDED"`

---

## UI Design Guidelines

### Design language
Calm, data-dense, institutional. Inspired by Linear and Vercel.
No gradients, no shadows, no rounded corners on everything.
Dark mode first.

### Colors (Tailwind classes only)
- Background: bg-background
- Surface/cards: bg-card or bg-muted/40
- Borders: border-border (use sparingly, 1px only)
- Primary text: text-foreground
- Muted text: text-muted-foreground
- Positive/gain: text-emerald-500
- Negative/loss: text-rose-500
- Accent/active: text-primary

### Typography
- Page titles: text-xl font-medium
- Section labels: text-sm font-medium text-muted-foreground uppercase tracking-wide
- Table headers: text-xs font-medium text-muted-foreground uppercase
- Body: text-sm
- Numbers/values: font-mono text-sm

### Layout
- Sidebar: fixed left, 220px wide, bg-background border-r border-border
- Main content: ml-[220px], p-8, max-w-7xl
- Cards: rounded-lg border border-border bg-card p-6, no drop shadows
- Stat cards: 4 in a row, each showing label + large value + sub-label

### Formatting
- Currency: ₹1,23,456 (Indian format)
- Percentages: +12.34% or -4.56% with color
- Dates: 14 May 2026
- Positive values prefixed with +, negative with -

---

## What to build first (in order)

1. Project init + folder structure + this file committed
2. Types in `src/types/portfolio.ts`
3. CSV parsers in `src/lib/parsers/`
4. Finance calculations in `src/lib/finance/calculations.ts`
5. Upload API route + snapshot save to Supabase
6. Dashboard page with holdings table and allocation chart
7. AI client + insight generation + display
8. Daily analysis cron + Resend email alert

Do not jump ahead. Each step depends on the previous one being solid.

---

## What NOT to do

- Do not add LiteLLM, LangChain, LangGraph, CrewAI, or any agent framework until explicitly instructed
- Do not add FastAPI or any Python backend until explicitly instructed
- Do not build multi-user features until the personal use case is validated
- Do not call the Anthropic SDK from anywhere except `src/lib/ai/client.ts`
- Do not put financial calculations inside AI prompts
- Do not use `any` in TypeScript
- Do not add Redis or BullMQ until async job queues are actually needed

---

## When in doubt

Ask: "Does this make the product more useful to one user today?" If yes, build it. If it's infrastructure for a hypothetical future, defer it.