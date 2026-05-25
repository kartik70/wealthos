# WealthOS — Agent Instructions

> Read this file before writing a single line of code. This is the source of truth for all architecture, conventions, and rules. If something isn't covered here, ask before assuming.

---

## What this product is

WealthOS is a personal AI-powered portfolio intelligence platform. It helps the user understand their investments — not predict markets, not execute trades. Think of it as a smart, private financial journal that gets smarter over time.

**It is:**
- A portfolio snapshot and diff engine (equity via Kite CSV, MF via Groww XLSX)
- A deterministic financial calculator
- An AI interpretation and narration layer
- A RAG-powered advisor chat with full portfolio history
- A daily alert system for actionable portfolio events

**It is NOT:**
- A trading platform
- A stock predictor
- A chatbot product
- A finfluencer tool

---

## Tech stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | Frontend + API routes |
| Language | TypeScript (strict mode) | No `any` |
| Styling | Tailwind CSS + shadcn/ui | Nova preset, Slate base |
| State | Zustand | Client state + chat history |
| Charts | Recharts | Portfolio visualisation |
| Database | Supabase (Postgres + pgvector) | Auth included |
| AI Chat | Anthropic SDK | claude-sonnet-4-20250514 |
| AI Alt | Google Generative AI SDK | gemini-2.0-flash, user-selectable |
| Embeddings | Google Generative AI SDK | gemini-embedding-001, always used regardless of chat provider |
| Research Agent | LangGraph + Tavily | Multi-node async workflow for market context |
| Markdown | react-markdown | Advisor chat responses only |
| XLSX parsing | SheetJS (xlsx) | Groww XLSX parser |
| CSV parsing | papaparse | Kite CSV parser |
| Email | Resend | Alert delivery |
| Cron | Vercel Cron Jobs | Daily analysis trigger |
| Deployment | Vercel | Free tier |

**AI provider is user-selectable** via Settings page, saved to localStorage as `ai_provider`. Valid values: `anthropic` (default) or `gemini`. Embeddings always use Gemini regardless of this setting.

**Do not add new dependencies without a clear reason.**

---

## Project structure

```
wealthos/
├── INSTRUCTIONS.md
├── vercel.json                   ← cron config
├── docs/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx          ← dashboard home
│   │   │   ├── insights/         ← deep AI analysis page
│   │   │   ├── timeline/         ← snapshot history + diffs
│   │   │   ├── advisor/          ← RAG chat
│   │   │   ├── goals/            ← corpus goal tracking
│   │   │   └── settings/         ← account, AI provider, data management
│   │   ├── api/
│   │   │   ├── upload/           ← Kite CSV + Groww XLSX upload
│   │   │   ├── snapshots/
│   │   │   │   ├── latest/       ← fetch latest equity + MF snapshot
│   │   │   │   ├── all/          ← fetch all snapshots for timeline
│   │   │   │   └── [id]/         ← delete snapshot
│   │   │   ├── insights/
│   │   │   │   ├── route.ts      ← general insight generation
│   │   │   │   └── detailed/     ← deep analysis generation
│   │   │   ├── advisor/
│   │   │   │   └── chat/         ← RAG chat endpoint (streaming)
│   │   │   ├── goals/            ← CRUD for goals
│   │   │   ├── daily-analysis/   ← cron-triggered analysis + Resend alert
│   │   │   ├── export/
│   │   │   │   └── holdings/     ← CSV export of latest holdings
│   │   │   └── admin/
│   │   │       └── embed-all/    ← one-time backfill route for embeddings
│   │   ├── login/                ← Google OAuth login page
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/                   ← shadcn/ui primitives only
│   │   ├── dashboard/
│   │   ├── portfolio/            ← HoldingsTable, AllocationChart, MFHoldingsTable
│   │   ├── insights/             ← InsightCard, DetailedInsightView
│   │   ├── advisor/              ← ChatMessage, SuggestedQuestions
│   │   └── layout/               ← Sidebar, ImportPortfolioModal
│   │
│   ├── features/
│   │   ├── portfolio/
│   │   └── ai/
│   │       ├── promptBuilder.ts        ← equity insight prompt
│   │       ├── detailedPromptBuilder.ts← deep analysis prompt
│   │       └── advisorPromptBuilder.ts ← RAG chat system prompt
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── client.ts         ← ONLY place Anthropic/Gemini SDK is called for chat
│   │   │   ├── embeddings.ts     ← ONLY place Gemini embedding SDK is called
│   │   │   └── retrieval.ts      ← pgvector similarity search
│   │   ├── db/
│   │   │   └── supabase.ts       ← browser + server + admin clients
│   │   ├── finance/
│   │   │   ├── calculations.ts   ← P&L, CAGR, allocation
│   │   │   ├── risk.ts           ← concentration, sector exposure
│   │   │   ├── tax.ts            ← STCG/LTCG, harvesting opportunities
│   │   │   ├── diff.ts           ← snapshot diff engine
│   │   │   ├── goals.ts          ← corpus projection, gap analysis
│   │   │   ├── sectors.ts        ← symbol → sector mapping
│   │   │   ├── health.ts         ← portfolio health score
│   │   │   └── combined.ts       ← equity + MF combined totals
│   │   └── parsers/
│   │       ├── kite.ts           ← Kite CSV → Holding[]
│   │       └── groww.ts          ← Groww XLSX → MutualFundHolding[]
│   │
│   ├── hooks/
│   ├── stores/                   ← Zustand (chat history, portfolio state)
│   ├── types/
│   │   ├── portfolio.ts          ← Holding, PortfolioSnapshot, MutualFundHolding, InsightResponse etc.
│   │   └── db.ts                 ← Supabase row types
│   └── mock/
```

---

## The most important architectural rule

**Deterministic finance logic and AI interpretation must never mix.**

The AI must NEVER calculate P&L, CAGR, tax, allocation %, risk metrics, or concentration ratios. All of these live in `src/lib/finance/` as pure TypeScript functions.

The AI ONLY receives already-calculated output and interprets, prioritises, contextualises, and narrates it.

---

## AI client rules

- `src/lib/ai/client.ts` is the ONLY file that calls the Anthropic or Gemini chat SDK
- `src/lib/ai/embeddings.ts` is the ONLY file that calls the Gemini embedding SDK
- The chat provider is determined by reading the `x-ai-provider` request header (sent by frontend from localStorage)
- All AI responses must be structured JSON validated against a TypeScript type before use
- Strip markdown code fences before JSON.parse: `.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()`
- Chat model: `claude-sonnet-4-20250514` (Anthropic) or `gemini-2.0-flash` (Gemini)
- Embedding model: `gemini-embedding-001` always, output truncated to 768 dimensions via `.slice(0, 768)`
- `max_tokens`: 4000 for insights/detailed, 800 for advisor chat

---

## Database schema (Supabase)

```sql
-- Equity snapshots
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

-- Equity holdings
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

-- AI insights
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

-- RAG embeddings (pgvector, 768 dimensions)
create table snapshot_embeddings (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references portfolio_snapshots not null,
  user_id text not null,
  chunk_type text check (chunk_type in ('snapshot_summary', 'diff_summary', 'insight_summary')),
  content text not null,
  embedding vector(768),
  created_at timestamptz default now()
);

-- Advisor chat history
create table advisor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  role text check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Goals
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  target_corpus numeric not null,
  target_date date not null,
  expected_return numeric default 12,
  created_at timestamptz default now()
);

-- Mutual fund snapshots (Groww)
create table mutual_fund_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  created_at timestamptz default now(),
  snapshot_date date not null,
  total_invested numeric not null,
  total_current_value numeric not null,
  total_returns numeric not null,
  total_returns_pct numeric not null
);

-- Mutual fund holdings
create table mutual_fund_holdings (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references mutual_fund_snapshots not null,
  scheme_name text not null,
  amc text,
  category text,
  sub_category text,
  folio_no text,
  units numeric,
  invested_value numeric,
  current_value numeric,
  returns numeric,
  returns_pct numeric,
  allocation_pct numeric
);
```

---

## RAG architecture

### Retrieval Strategy: Hybrid Search
Two queries run in parallel:
- Vector search: cosine similarity via pgvector `<=>` operator
- Keyword search: Postgres full-text search via `tsvector` + `plainto_tsquery`

Results merged using Reciprocal Rank Fusion (RRF, k=60). Final top 5 chunks passed to Claude / Gemini.

### Query Analysis (pre-retrieval)
Before embedding the question, `analyseQuery()` (in `src/lib/ai/queryAnalyser.ts`) extracts:
- Relevant symbols from the question + current holdings context
- Optimal chunk types for the query intent
- Date range if a temporal reference is detected

All filtering is applied at the DB query level for efficiency. Pure string matching — no LLM call.

### Chunking Strategy: Record-based semantic chunking
Four chunk types stored in `snapshot_embeddings`:
- `snapshot_summary` — full portfolio state on a date (all holdings, values, gain/loss)
- `diff_summary` — changes between previous and current snapshot (buys, sells, profit bookings)
- `insight_summary` — AI commentary from that date
- `goal_summary` — goal progress / corpus gap

Each chunk = one complete business event, not an arbitrary token window. The `content_tsv` column is auto-generated (GENERATED ALWAYS AS) for full-text search.

Embeddings use Gemini `gemini-embedding-001`, 768 dimensions (truncated via `.slice(0, 768)`).

Chat history: last 10 messages passed as conversation history. Capped at 800 max_tokens response.

---

## Research Agent Architecture

The Advisor chat does NOT go straight from RAG → LLM. Instead, every user question is run through a LangGraph workflow (`src/lib/ai/researchAgent.ts`) that conditionally augments the context with real-time market news:

```
User question
      ↓
Node 1: Extract mentioned/relevant symbols from question + holdings
      ↓ (conditional — skip if generic question or no symbols found)
Node 2: Fetch real-time market news via Tavily (max 3 symbols)
      ↓
Node 3: Build final context = RAG history + current snapshot + market news
      ↓
Claude / Gemini generates grounded answer
```

Rules:
- Symbol extraction is pure string matching against the user's current holdings (no LLM call).
- Exit/hold intent ("should I exit", "sell", "trim") with no explicit symbol expands to the top loss positions.
- Tavily is capped at 3 symbols per request and uses the `news` topic with `searchDepth: "basic"`.
- If `TAVILY_API_KEY` is missing or Tavily fails, the agent falls back to plain RAG + snapshot context — chat never breaks.
- The system prompt instructs the LLM to cite whether each claim is grounded in portfolio data or current market news.
- A `✦ Includes live market data` badge appears on assistant messages whose context included Tavily results.

---

## Upload flow

**Kite (equity):** CSV file + report date → `parseKiteCSV` → `calcAllocationPct` + `calcPortfolioTotals` → insert `portfolio_snapshots` + `holdings` → `embedSnapshot`

**Groww (MF):** XLSX file → `parseGrowwXLSX` (date auto-extracted from row 17: 'HOLDINGS AS ON YYYY-MM-DD') → insert `mutual_fund_snapshots` + `mutual_fund_holdings`

**Duplicate check:** reject if a snapshot already exists for the same date. Allow replace with `replace=true` form field — deletes existing snapshot + holdings + insights + embeddings before reinserting.

**Import UI:** single 'Import Portfolio' button in sidebar opens modal with two tabs: 'Kite Equity' (CSV + date picker) and 'Groww MF' (XLSX only, date auto-extracted).

---

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
TAVILY_API_KEY=
RESEND_API_KEY=
ALERT_EMAIL=
CRON_SECRET=
AI_PROVIDER=anthropic
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` to the client.

---

## UI Design Guidelines

### Design language
Calm, data-dense, institutional. Inspired by Linear and Vercel. Dark mode supported.
No neon, no gradients, no crypto aesthetics.

### Colors
- Background: `bg-background`
- Surface: `bg-card` or `bg-muted/40`
- Borders: `border-border` (1px, sparingly)
- Primary text: `text-foreground`
- Muted text: `text-muted-foreground`
- Positive/gain: `text-emerald-500`
- Negative/loss: `text-rose-500`

### Typography
- Page titles: `text-2xl font-semibold tracking-tight`
- Page subtitles: `text-sm text-muted-foreground mt-1`
- Section labels: `text-xs font-medium tracking-widest uppercase text-muted-foreground`
- Table headers: `text-xs font-medium text-muted-foreground uppercase`
- Numbers/values: `font-mono text-sm`

### Layout
- Sidebar: fixed left, 220px wide, `bg-background border-r border-border`
- Main content: `ml-[220px] p-8 max-w-7xl`
- Cards: `rounded-lg border border-border bg-card p-6` — no drop shadows

### Formatting
- Currency: ₹1,23,456 (Indian locale format)
- Percentages: `+12.34%` or `-4.56%` with color
- Dates: `14 May 2026`

### Chat UI
- User messages: right-aligned, `bg-foreground text-background rounded-2xl rounded-br-sm`
- Assistant messages: left-aligned, no bubble, markdown rendered via `react-markdown` AFTER streaming completes
- During streaming: render as plain `whitespace-pre-wrap` text
- Provider badge shown on each assistant message

---

## Advisor chat guardrails (system prompt rules)

- Only answer using data from retrieved context and current snapshot
- If data is not in context, say so briefly and suggest uploading older CSVs
- Never predict future prices or guarantee returns
- Frame recommendations as observations, not advice
- Decline off-topic questions and redirect to portfolio queries
- Keep refusals short — no moralising or lectures
- End with a brief disclaimer only when relevant

---

## Sector mapping (hardcoded in sectors.ts)

```
Power: ADANIPOWER, NTPC, TATAPOWER, POWERGRID, NHPC, RPOWER, RTNPOWER
Financials: JIOFIN, SBIN, SBICARD, IDBI, CDSL
Metals: TATASTEEL, BHARATFORG
Infrastructure: RVNL, JSWINFRA, PNCINFRA, BEL, COCHINSHIP
Consumer: ASIANPAINT, COLPAL, HINDUNILVR, IRCTC, CIPLA
Auto: TMCV, TMPV
ETFs: HDFCGOLD, NIFTYBEES, SILVERBEES
Technology: WIPRO, ACCELYA
Other: anything not matched
```

---

## What NOT to do

- Do not call Anthropic/Gemini SDK outside `src/lib/ai/client.ts`
- Do not call Gemini embedding SDK outside `src/lib/ai/embeddings.ts`
- Do not call Supabase outside `src/lib/db/supabase.ts`
- Do not put financial calculations inside AI prompts
- LangGraph is allowed ONLY inside `src/lib/ai/researchAgent.ts` for the Portfolio Research Agent. Do not introduce LangChain, CrewAI, LiteLLM, or FastAPI elsewhere.
- Do not use `any` in TypeScript
- Do not add Redis or BullMQ until async queues are actually needed
- Do not build multi-user BYOK until personal use is fully validated

---

## When in doubt

Ask: "Does this make the product more useful to one user today?" If yes, build it. If it's infrastructure for a hypothetical future, defer it.