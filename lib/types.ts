import type { Currency } from "@/lib/money";

export type AccountType = "bank" | "crypto" | "investment" | "loan" | "cash";
export type AccountCategory = "asset" | "debt";
export type AccountSource = "plaid" | "manual" | "csv" | "crypto_api";

export interface Account {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  subtitle: string | null;
  account_type: AccountType;
  category: AccountCategory;
  balance: number;
  currency: Currency;
  apr: number | null;
  min_payment: number | null;
  payment_due_day: number | null;
  renewal_date: string | null;
  credit_limit: number | null;
  statement_close_day: number | null;
  source: AccountSource;
  plaid_account_id: string | null;
  plaid_item_id: string | null;
  institution_id: string | null;
  crypto_symbol: string | null;
  crypto_quantity: number | null;
  quick_login_url: string | null;
  last_acknowledged_at: string | null;
  last_balance_updated_at: string | null;
  position: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string | null;
  invited_email: string;
  invite_token: string;
  role: WorkspaceRole;
  invited_by_user_id: string | null;
  invited_at: string;
  accepted_at: string | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  role_context: string | null;
  home_currency: Currency;
  timezone: string;
  jurisdictions: string[];
  awareness_streak: number;
  best_streak: number;
  last_checkin_date: string | null;
  capital_waterfall: unknown;
  expert_hints_enabled: boolean;
  decay_warnings_enabled: boolean;
  weekly_email_enabled: boolean;
  monthly_email_enabled: boolean;
  active_workspace_id: string;
  referral_token: string | null;
  invited_by_user_id: string | null;
  welcomed: boolean;
  locale_detected: boolean;
  created_at: string;
  updated_at: string;
}

export type HintCategory = "pay_attention" | "opportunity" | "strategic";
export type HintStatus = "active" | "dismissed" | "acted" | "muted";

export interface Hint {
  id: string;
  user_id: string;
  workspace_id: string;
  hint_template_id: string;
  category: HintCategory;
  severity_score: number;
  title: string;
  body: string;
  composed_body: string | null;
  composed_at: string | null;
  data_snapshot: unknown;
  related_account_id: string | null;
  action_label: string | null;
  action_target: string | null;
  status: HintStatus;
  dismissed_count: number;
  fired_at: string;
  expires_at: string | null;
  acted_at: string | null;
  dismissed_at: string | null;
}
