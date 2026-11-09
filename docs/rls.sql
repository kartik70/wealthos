-- WealthOS Row Level Security policies
-- Apply AFTER schema.sql. Run this once on your Supabase project.
--
-- All server-side code uses the service-role client (createSupabaseAdminClient),
-- which bypasses RLS automatically. These policies only restrict direct client
-- access via the anon/authenticated Supabase client, preventing one user from
-- reading or modifying another user's data if the anon key is ever exposed.
--
-- user_api_keys already has RLS enabled with policies from initial setup.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.portfolio_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshot_embeddings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutual_fund_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutual_fund_holdings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbol_sectors          ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- portfolio_snapshots (user_id text — cast auth.uid() uuid → text)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own snapshots"
  ON public.portfolio_snapshots FOR ALL
  USING     (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- holdings (no user_id; joined through portfolio_snapshots)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage holdings belonging to their snapshots"
  ON public.holdings FOR ALL
  USING (
    snapshot_id IN (
      SELECT id FROM public.portfolio_snapshots
      WHERE user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    snapshot_id IN (
      SELECT id FROM public.portfolio_snapshots
      WHERE user_id = auth.uid()::text
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_insights (user_id text)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own insights"
  ON public.ai_insights FOR ALL
  USING     (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- snapshot_embeddings (user_id text)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own embeddings"
  ON public.snapshot_embeddings FOR ALL
  USING     (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- advisor_conversations (user_id text)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own conversations"
  ON public.advisor_conversations FOR ALL
  USING     (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- goals (user_id text)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own goals"
  ON public.goals FOR ALL
  USING     (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- mutual_fund_snapshots (user_id uuid — matches auth.uid() directly)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own MF snapshots"
  ON public.mutual_fund_snapshots FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- mutual_fund_holdings (no user_id; joined through mutual_fund_snapshots)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage MF holdings belonging to their MF snapshots"
  ON public.mutual_fund_holdings FOR ALL
  USING (
    snapshot_id IN (
      SELECT id FROM public.mutual_fund_snapshots
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    snapshot_id IN (
      SELECT id FROM public.mutual_fund_snapshots
      WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- symbol_sectors — global lookup table, no per-user rows.
-- Authenticated users may read; writes go through the service-role client only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Authenticated users can read sector classifications"
  ON public.symbol_sectors FOR SELECT
  TO authenticated
  USING (true);
