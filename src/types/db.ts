export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PortfolioSnapshotRow = {
  id: string;
  user_id: string;
  created_at: string;
  total_value: number;
  total_cost: number;
  total_gain: number;
  total_gain_pct: number;
  source: "kite" | "groww" | "manual" | null;
  raw_data: Json | null;
  context_cache: string | null;
};

export type HoldingRow = {
  id: string;
  snapshot_id: string;
  symbol: string;
  name: string | null;
  quantity: number;
  avg_cost: number;
  current_price: number;
  current_value: number;
  unrealised_gain: number;
  unrealised_gain_pct: number;
  allocation_pct: number;
};

export type AiInsightRow = {
  id: string;
  snapshot_id: string;
  user_id: string;
  created_at: string;
  summary: string | null;
  recommendations: Json | null;
  alerts: Json | null;
  trigger: "manual" | "cron" | "upload" | null;
};

export type SnapshotEmbeddingRow = {
  id: string;
  snapshot_id: string;
  user_id: string;
  chunk_type: "snapshot_summary" | "diff_summary" | "insight_summary" | "goal_summary";
  content: string;
  embedding: number[];
  created_at: string;
};

export type AdvisorConversationRow = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type GoalRow = {
  id: string;
  user_id: string;
  name: string;
  target_corpus: number;
  target_date: string;
  expected_return: number;
  created_at: string;
};

export type MutualFundSnapshotRow = {
  id: string;
  user_id: string;
  created_at: string;
  snapshot_date: string;
  total_invested: number;
  total_current_value: number;
  total_returns: number;
  total_returns_pct: number;
};

export type MutualFundHoldingRow = {
  id: string;
  snapshot_id: string;
  scheme_name: string;
  amc: string | null;
  category: string | null;
  sub_category: string | null;
  folio_no: string | null;
  units: number | null;
  invested_value: number | null;
  current_value: number | null;
  returns: number | null;
  returns_pct: number | null;
  allocation_pct: number | null;
};

export type SymbolSectorRow = {
  symbol: string;
  sector: string;
  classified_by: "hardcoded" | "ai" | "user" | null;
  created_at: string | null;
};

export type UserApiKeyRow = {
  user_id: string;
  anthropic_key: string | null;
  gemini_key: string | null;
  updated_at: string | null;
};

export interface Database {
  public: {
    Tables: {
      portfolio_snapshots: {
        Row: PortfolioSnapshotRow;
        Insert: Omit<PortfolioSnapshotRow, "id" | "created_at" | "context_cache"> & {
          id?: string;
          created_at?: string;
          context_cache?: string | null;
        };
        Update: Partial<PortfolioSnapshotRow>;
        Relationships: [];
      };
      holdings: {
        Row: HoldingRow;
        Insert: Omit<HoldingRow, "id"> & {
          id?: string;
        };
        Update: Partial<HoldingRow>;
        Relationships: [];
      };
      ai_insights: {
        Row: AiInsightRow;
        Insert: Omit<AiInsightRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AiInsightRow>;
        Relationships: [];
      };
      snapshot_embeddings: {
        Row: SnapshotEmbeddingRow;
        Insert: Omit<SnapshotEmbeddingRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<SnapshotEmbeddingRow>;
        Relationships: [];
      };
      advisor_conversations: {
        Row: AdvisorConversationRow;
        Insert: Omit<AdvisorConversationRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AdvisorConversationRow>;
        Relationships: [];
      };
      goals: {
        Row: GoalRow;
        Insert: Omit<GoalRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GoalRow>;
        Relationships: [];
      };
      mutual_fund_snapshots: {
        Row: MutualFundSnapshotRow;
        Insert: Omit<MutualFundSnapshotRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<MutualFundSnapshotRow>;
        Relationships: [];
      };
      mutual_fund_holdings: {
        Row: MutualFundHoldingRow;
        Insert: Omit<MutualFundHoldingRow, "id"> & {
          id?: string;
        };
        Update: Partial<MutualFundHoldingRow>;
        Relationships: [];
      };
      symbol_sectors: {
        Row: SymbolSectorRow;
        Insert: Omit<SymbolSectorRow, "created_at"> & {
          created_at?: string;
        };
        Update: Partial<SymbolSectorRow>;
        Relationships: [];
      };
      user_api_keys: {
        Row: UserApiKeyRow;
        Insert: Omit<UserApiKeyRow, "updated_at"> & {
          updated_at?: string;
        };
        Update: Partial<UserApiKeyRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_snapshot_embeddings: {
        Args: {
          query_embedding: number[];
          match_user_id: string;
          match_count: number;
        };
        Returns: Array<{
          content: string;
          chunk_type: string;
          created_at: string;
        }>;
      };
      match_snapshot_embeddings_filtered: {
        Args: {
          query_embedding: number[];
          match_user_id: string;
          match_count?: number;
          chunk_types?: string[] | null;
          date_from?: string | null;
          date_to?: string | null;
        };
        Returns: Array<{
          id: string;
          content: string;
          chunk_type: string;
          created_at: string;
          semantic_score: number;
        }>;
      };
      keyword_search_snapshot_embeddings: {
        Args: {
          query_text: string;
          match_user_id: string;
          match_count?: number;
          chunk_types?: string[] | null;
          date_from?: string | null;
          date_to?: string | null;
        };
        Returns: Array<{
          id: string;
          content: string;
          chunk_type: string;
          created_at: string;
          keyword_score: number;
        }>;
      };
      set_ivfflat_probes: {
        Args: {
          probes: number;
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
