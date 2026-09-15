import type { IsoDateTime, Kobo, PageParams } from './common';

export interface DashboardStats {
  collected_revenue?: { total: number; today: number; month: number };
  revenue_sources?: { online: number; agent_wallet: number; agent_credit_repayments: number };
  voucher_usage?: Record<string, number>;
  vouchers_issued_today?: number;
  successful_payments?: number;
  failed_payments?: number;
  active_plans?: number;
  total_plans?: number;
  reporting_timezone?: string;
  total_vouchers: number;
  active_vouchers: number;
  total_revenue: Kobo;
  total_agents: number;
  total_routers: number;
  active_routers: number;
  currency: string;
  amount_unit: string;
  observed_at: IsoDateTime;
  pending_payments: number;
  paid_unfulfilled_payments: number;
}

export interface LiveUser {
  session_id: number;
  username: string;
  ip_address: string;
  client_ip: string | null;
  /** seconds */
  session_time: number;
  bytes_in: number;
  bytes_out: number;
  connected_at: IsoDateTime | null;
  router_id: string | null;
  router_name: string | null;
}

/** Non-standard envelope: `users` instead of `results`. */
export interface LiveUsersResponse {
  users: LiveUser[];
  count: number;
  current_page: number;
  total_pages: number;
  observed_at: IsoDateTime;
  source: string;
}

export interface LiveUsersParams extends Pick<PageParams, 'page' | 'page_size'> {
  username?: string;
  router?: string;
}

export interface DisconnectResult {
  acknowledged: boolean;
}

export interface PlatformStats {
  tenants: number;
  active_tenants: number;
  routers: number;
  onboarded_routers: number;
  agents: number;
  vouchers: number;
  successful_payment_amount: Kobo;
  pending_payments: number;
  currency: string;
  amount_unit: string;
  successful_wallet_funding_amount: Kobo;
  successful_subscription_amount: Kobo;
}

export interface AuditEvent {
  id: string;
  tenant: number | null;
  actor: number | null;
  action: string;
  /** "app.model:pk" */
  resource: string;
  details: Record<string, unknown>;
  created_at: IsoDateTime;
}

export interface AuditListParams extends PageParams {
  /** Exact action key, e.g. `vouchers.generated`. */
  action?: string;
  actor?: number;
  tenant?: number;
}

export interface NetworkSummary {
  rate_sampled_sessions: number;
  online_users: number;
  online_vouchers: number;
  stale_sessions: number;
  sessions_today: number;
  live_upload_bytes: number;
  live_download_bytes: number;
  live_traffic_bytes: number;
  today_upload_bytes: number;
  today_download_bytes: number;
  today_traffic_bytes: number;
  all_time_upload_bytes: number;
  all_time_download_bytes: number;
  all_time_traffic_bytes: number;
  upload_bytes_per_second: number | null;
  download_bytes_per_second: number | null;
  latest_accounting_at: string | null;
  router_counts: Record<'online' | 'offline' | 'unknown' | 'awaiting_import' | 'inactive', number>;
  routers: {
    id: string;
    name: string;
    status: string;
    online_users: number;
    last_seen_at: string | null;
  }[];
  routers_total: number;
  observed_at: string;
  freshness_seconds: number;
  traffic_basis: string;
  source: string;
}
