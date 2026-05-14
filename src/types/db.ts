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

export interface Database {
  public: {
    Tables: {
      portfolio_snapshots: {
        Row: PortfolioSnapshotRow;
        Insert: Omit<PortfolioSnapshotRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
