-- WealthOS database schema
-- Apply to a fresh Supabase project to get a fully working instance.
-- Prerequisites: enable the pgvector extension in Supabase Dashboard → Database → Extensions.
--
-- Run order:
--   1. schema.sql  (this file — tables, indexes, RPCs)
--   2. rls.sql     (Row Level Security policies)

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text          NOT NULL,
  created_at      timestamptz   DEFAULT now(),
  total_value     numeric       NOT NULL,
  total_cost      numeric       NOT NULL,
  total_gain      numeric       NOT NULL,
  total_gain_pct  numeric       NOT NULL,
  source          text          CHECK (source = ANY (ARRAY['kite', 'groww', 'manual'])),
  raw_data        jsonb,
  embedding       vector,
  context_cache   text
);

CREATE TABLE IF NOT EXISTS public.holdings (
  id                   uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id          uuid      NOT NULL REFERENCES public.portfolio_snapshots (id) ON DELETE CASCADE,
  symbol               text      NOT NULL,
  name                 text,
  quantity             numeric   NOT NULL,
  avg_cost             numeric   NOT NULL,
  current_price        numeric   NOT NULL,
  current_value        numeric   NOT NULL,
  unrealised_gain      numeric   NOT NULL,
  unrealised_gain_pct  numeric   NOT NULL,
  allocation_pct       numeric   NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id     uuid        NOT NULL REFERENCES public.portfolio_snapshots (id) ON DELETE CASCADE,
  user_id         text        NOT NULL,
  created_at      timestamptz DEFAULT now(),
  summary         text,
  recommendations jsonb,
  alerts          jsonb,
  trigger         text        CHECK (trigger = ANY (ARRAY['manual', 'cron', 'upload']))
);

CREATE TABLE IF NOT EXISTS public.snapshot_embeddings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid        NOT NULL REFERENCES public.portfolio_snapshots (id) ON DELETE CASCADE,
  user_id     text        NOT NULL,
  chunk_type  text        CHECK (chunk_type = ANY (ARRAY['snapshot_summary', 'diff_summary', 'insight_summary', 'goal_summary'])),
  content     text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  embedding   vector,
  -- Auto-generated tsvector for full-text search; kept in sync by the generated column.
  content_tsv tsvector    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

CREATE TABLE IF NOT EXISTS public.advisor_conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text        NOT NULL,
  role       text        CHECK (role = ANY (ARRAY['user', 'assistant'])),
  content    text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goals (
  id              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text      NOT NULL,
  name            text      NOT NULL,
  target_corpus   numeric   NOT NULL,
  target_date     date      NOT NULL,
  monthly_sip     numeric   DEFAULT 0,
  expected_return numeric   DEFAULT 12,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mutual_fund_snapshots (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at          timestamptz DEFAULT now(),
  snapshot_date       date        NOT NULL,
  total_invested      numeric     NOT NULL,
  total_current_value numeric     NOT NULL,
  total_returns       numeric     NOT NULL,
  total_returns_pct   numeric     NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mutual_fund_holdings (
  id              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id     uuid      NOT NULL REFERENCES public.mutual_fund_snapshots (id) ON DELETE CASCADE,
  scheme_name     text      NOT NULL,
  amc             text,
  category        text,
  sub_category    text,
  folio_no        text,
  units           numeric,
  invested_value  numeric,
  current_value   numeric,
  returns         numeric,
  returns_pct     numeric,
  allocation_pct  numeric
);

-- Global symbol→sector lookup. The app writes via the service role; authenticated
-- users only need SELECT access.
CREATE TABLE IF NOT EXISTS public.symbol_sectors (
  symbol        text  PRIMARY KEY,
  sector        text  NOT NULL,
  classified_by text  CHECK (classified_by = ANY (ARRAY['hardcoded', 'ai', 'user'])),
  created_at    timestamptz DEFAULT now()
);

-- Encrypted user API keys (Anthropic + Gemini). RLS already set on fresh installs.
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  user_id       uuid  PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  anthropic_key text,
  gemini_key    text,
  updated_at    timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- IVFFlat index for approximate nearest-neighbour search on embeddings.
-- lists=100 is calibrated for the expected corpus size (~thousands of chunks).
-- Rebuild with more lists if the corpus grows to tens of thousands.
CREATE INDEX IF NOT EXISTS snapshot_embeddings_embedding_idx
  ON public.snapshot_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- GIN index for full-text keyword search.
CREATE INDEX IF NOT EXISTS snapshot_embeddings_tsv_idx
  ON public.snapshot_embeddings USING gin (content_tsv);

-- Covering indexes for common lookup patterns.
CREATE INDEX IF NOT EXISTS mutual_fund_holdings_snapshot_id_idx
  ON public.mutual_fund_holdings (snapshot_id);

CREATE INDEX IF NOT EXISTS mutual_fund_snapshots_user_id_snapshot_date_idx
  ON public.mutual_fund_snapshots (user_id, snapshot_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC functions used by the RAG retrieval pipeline
-- ─────────────────────────────────────────────────────────────────────────────

-- Semantic (vector) search over snapshot_embeddings.
CREATE OR REPLACE FUNCTION public.match_snapshot_embeddings_filtered(
  query_embedding vector,
  match_user_id   text,
  match_count     integer    DEFAULT 10,
  chunk_types     text[]     DEFAULT NULL,
  date_from       timestamptz DEFAULT NULL,
  date_to         timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id             uuid,
  content        text,
  chunk_type     text,
  created_at     timestamptz,
  semantic_score double precision
)
LANGUAGE sql STABLE AS $$
  SELECT
    e.id,
    e.content,
    e.chunk_type,
    e.created_at,
    1 - (e.embedding <=> query_embedding) AS semantic_score
  FROM snapshot_embeddings e
  WHERE e.user_id = match_user_id
    AND (chunk_types IS NULL OR e.chunk_type = ANY(chunk_types))
    AND (date_from IS NULL OR e.created_at >= date_from)
    AND (date_to   IS NULL OR e.created_at <= date_to)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Full-text keyword search over snapshot_embeddings.
CREATE OR REPLACE FUNCTION public.keyword_search_snapshot_embeddings(
  query_text    text,
  match_user_id text,
  match_count   integer     DEFAULT 10,
  chunk_types   text[]      DEFAULT NULL,
  date_from     timestamptz DEFAULT NULL,
  date_to       timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  content       text,
  chunk_type    text,
  created_at    timestamptz,
  keyword_score double precision
)
LANGUAGE sql STABLE AS $$
  SELECT
    e.id,
    e.content,
    e.chunk_type,
    e.created_at,
    ts_rank(e.content_tsv, plainto_tsquery('english', query_text))::float AS keyword_score
  FROM snapshot_embeddings e
  WHERE e.user_id = match_user_id
    AND e.content_tsv @@ plainto_tsquery('english', query_text)
    AND (chunk_types IS NULL OR e.chunk_type = ANY(chunk_types))
    AND (date_from IS NULL OR e.created_at >= date_from)
    AND (date_to   IS NULL OR e.created_at <= date_to)
  ORDER BY keyword_score DESC
  LIMIT match_count;
$$;

-- Raise the ivfflat probe count for better ANN recall on this session.
-- Called by retrieval.ts before every vector search; failure is non-fatal.
CREATE OR REPLACE FUNCTION public.set_ivfflat_probes(probes integer)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('SET ivfflat.probes = %s', probes);
END;
$$;
