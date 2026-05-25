# WealthOS — AI Portfolio Intelligence Platform

> Your portfolio. Finally understood.

WealthOS is an open-source, AI-powered portfolio intelligence platform built for Indian investors. Upload your Zerodha Kite and Groww exports, get deep analysis, track every decision over time, and chat with your entire investment history using RAG-powered AI.

**Live demo:** [wealthos-liard.vercel.app](https://wealthos-liard.vercel.app)

---

## What it does

Most broker dashboards show you numbers. WealthOS tells you what those numbers mean.

- **Snapshot Timeline** — every portfolio state saved with a date. Compare any two snapshots. See exactly what changed, what was bought, sold, or profit-booked.
- **AI Insights** — stock-by-stock verdicts (BOOK PROFIT / HOLD / EXIT), MF fund quality check, LTCG timing alerts, tax harvesting opportunities, and a ranked priority action plan.
- **Deep Analysis** — health score, sector classification, investor risk profile detection, fund overlap analysis, combined equity + MF view.
- **RAG-Powered Advisor with Live Market Context** — conversational AI that retrieves relevant snapshots AND fetches real-time market news for mentioned holdings via a LangGraph research agent. Ask "should I hold JIOFIN?" and get an answer grounded in both your portfolio history and current market developments.
- **Goals Tracking** — set a target corpus, track progress against combined equity + MF value, see projected value at target date.
- **Bring Your Own Key** — self-host for free on Vercel. Add your own Anthropic or Gemini API key in settings.

---

## Architecture

The core principle: **deterministic finance engine first, AI interpretation layer second.**

```
Kite CSV / Groww XLSX
        ↓
Pure TypeScript Finance Engine
(P&L · CAGR · Tax · Diff · Risk · Sector · Health Score)
        ↓
Prompt Builder
        ↓
Claude / Gemini
        ↓
Structured JSON (validated)
        ↓
Dashboard · Insights · Advisor · Timeline
```

The AI never calculates. It only interprets. Every number shown in the UI — P&L, CAGR, allocation %, tax liability, health score — is computed in pure TypeScript before the AI sees it.

### RAG Pipeline

```
Upload CSV/XLSX
        ↓
Generate text chunks per snapshot:
  - snapshot_summary (full portfolio state)
  - diff_summary (changes vs previous)
  - insight_summary (AI commentary)
  - goal_summary (goal progress)
        ↓
Embed via Gemini text-embedding-004 (768 dims)
        ↓
Store in Supabase pgvector
        ↓
At query time: embed question → cosine similarity search → retrieve top 5 chunks
        ↓
Inject retrieved context + current snapshot into Claude system prompt
        ↓
Answer grounded in actual portfolio history
```

Chunking strategy: **record-based semantic chunking** — each chunk represents one complete business event (a snapshot state, a portfolio diff, an AI commentary, a goal status) rather than arbitrary token windows. This preserves the relationship between dates, symbols, and values.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui (Nova preset) |
| State | Zustand |
| Charts | Recharts |
| Database | Supabase (Postgres + pgvector) |
| Auth | Supabase Google OAuth |
| AI Chat | Anthropic Claude (claude-sonnet-4-20250514) |
| AI Alternative | Google Gemini (gemini-2.0-flash) |
| Embeddings | Google Gemini (gemini-embedding-001, 768 dims) |
| Research Agent | LangGraph + Tavily Search | Multi-node async research workflow |
| CSV Parsing | papaparse |
| XLSX Parsing | SheetJS |
| Email Alerts | Resend |
| Cron | Vercel Cron Jobs |
| Deployment | Vercel |

---

## Self-hosting

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- An Anthropic or Gemini API key
- A Google Cloud project with OAuth credentials

### Setup

**1. Clone and install**
```bash
git clone https://github.com/kartik70/wealthos.git
cd wealthos
npm install
```

**2. Configure environment**
```bash
cp .env.example .env.local
```

Fill in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_secret_key
ANTHROPIC_API_KEY=sk-ant-...          # optional if using Gemini
GEMINI_API_KEY=AIza...                # optional if using Claude
TAVILY_API_KEY=tvly-...               # optional, enables live market context in advisor chat
RESEND_API_KEY=re_...                 # optional, for email alerts
ALERT_EMAIL=your@email.com
CRON_SECRET=any-random-string
AI_PROVIDER=anthropic                 # or gemini
```

**3. Set up Supabase database**

Run the SQL in `docs/schema.sql` in your Supabase SQL Editor. Enable the pgvector extension first:
```sql
create extension if not exists vector;
```

**4. Configure Google OAuth**

- Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
- Create OAuth 2.0 Client ID (Web application)
- Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
- Copy Client ID and Secret into Supabase → Authentication → Providers → Google

**5. Run locally**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**6. Backfill embeddings** (after first upload)

Hit `GET /api/admin/embed-all` once to generate embeddings for existing snapshots.

### Deploy to Vercel

```bash
# Push to GitHub, then:
# vercel.com → Import project → add environment variables → deploy
```

Add your Vercel URL to:
- Supabase → Authentication → URL Configuration → Site URL
- Supabase → Authentication → Redirect URLs
- Google OAuth → Authorized redirect URIs

---

## Usage

**1. Import your portfolio**
- Kite: download holdings CSV from Zerodha → Console → Portfolio → Holdings → Download
- Groww: download MF statement from Groww → Mutual Funds → Statements → Portfolio Statement (XLSX)

**2. Generate insights**
Click "Generate" on the dashboard for a quick analysis or go to Insights for a deep report.

**3. Chat with your portfolio**
Ask the Advisor anything: "which positions should I exit?", "what's my tax liability if I sell JIOFIN?", "am I overexposed to PSU stocks?"

**4. Track goals**
Set a target corpus under Goals. WealthOS tracks your combined equity + MF progress toward it.

---

## Project structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (dashboard)/        # Protected pages: dashboard, insights, timeline, advisor, goals, settings
│   ├── api/                # API routes: upload, snapshots, insights, advisor/chat, goals, daily-analysis
│   └── login/              # Google OAuth login page
├── components/             # React components
├── features/ai/            # Prompt builders for each AI use case
├── lib/
│   ├── ai/                 # client.ts (chat), embeddings.ts, retrieval.ts
│   ├── db/                 # Supabase client
│   └── finance/            # Pure TS: calculations, diff, tax, risk, sectors, health, goals
├── parsers/                # Kite CSV and Groww XLSX parsers
└── types/                  # TypeScript types for portfolio, DB, and AI responses
```

---

## Key design decisions

**Why no LangChain/LangGraph?** Premature orchestration complexity. The intelligence here is deterministic calculation + single LLM call. LangGraph becomes relevant when scheduling autonomous workflows — deferred until needed.

**Why LangGraph now?** The Portfolio Research Agent is a genuine multi-step orchestration problem — extract symbols, conditionally fetch news, synthesise context. This is exactly the use case LangGraph was designed for. Earlier features (insights, chat) were single LLM calls and didn't need it.

**Why Next.js API routes instead of FastAPI?** Single repo, faster iteration. FastAPI migration path is clean when Python-native ML is needed.

**Why pgvector instead of Pinecone?** Data already lives in Supabase. Zero additional infrastructure. Performs identically at this scale.

**Why record-based chunking?** Financial data is event-structured. Sliding window would split a holding's symbol, value, and date across chunks, breaking retrieval precision.

**Why Gemini for embeddings?** Free tier, no billing required. Fixed at 768 dimensions with MRL truncation for pgvector compatibility.

---

## Roadmap

- [ ] Daily cron + Resend email alerts
- [ ] Nifty 50 benchmark comparison
- [ ] Mobile responsive layout
- [ ] Broker API sync (Kite Connect)
- [ ] Multi-user SaaS mode
- [ ] LangGraph for scheduled autonomous analysis

---

## License

MIT — free to self-host, modify, and distribute.

---

## Author

Built by **Kartik Kakad** — Full Stack Developer @ Deloitte USI

[GitHub](https://github.com/kartik70) · [LinkedIn](linkedin.com/in/kartik-kakad) · [Email](mailto:kartikkakad007@gmail.com)

---

*This is not SEBI-registered investment advice. WealthOS is a portfolio intelligence tool, not a financial advisor.*