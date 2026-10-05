import { http } from '@/services/api/http';

export type Period = 'last_7_days' | 'last_30_days' | 'this_month' | 'custom';
export type GroupBy = 'day' | 'week' | 'month';
export interface ReportParams {
  period: Period;
  group_by: GroupBy;
  from?: string;
  to?: string;
}
export interface CollectionsByChannel {
  online_payments: number;
  agent_wallet: number;
  credit_repayments: number;
}
export interface ReportRow {
  start: string;
  end_exclusive: string;
  in_progress: boolean;
  complete: boolean;
  activated_value: number;
  collections: number;
  /** Absent on backends deployed before the channel split. */
  collections_by_channel?: CollectionsByChannel;
  active_vouchers: number | null;
}
export interface TenantReport {
  period: Period;
  group_by: GroupBy;
  from_date: string;
  to_date: string;
  reporting_timezone: string;
  observed_at: string;
  currency: 'NGN';
  amount_unit: 'kobo';
  activation_basis: string;
  collections_basis: string;
  usage_basis: string;
  accounting_available: boolean;
  latest_accounting_at: string | null;
  completed_periods: number;
  totals: {
    activated_value: number;
    collections: number;
    collections_by_channel?: CollectionsByChannel;
  };
  averages: {
    activated_value: number | null;
    collections: number | null;
    active_vouchers: number | null;
  };
  rows: ReportRow[];
}

export function fetchReport(params: ReportParams) {
  return http.get<TenantReport>('/reports/', { ...params });
}
