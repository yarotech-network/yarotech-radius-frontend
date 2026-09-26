export type VoucherCodeFormat = 'legacy' | 'numeric' | 'alphabetic' | 'alphanumeric';
import type { IsoDateTime, Kobo, PageParams, PaymentDisplayStatus, ReconciliationState } from './common';

export interface InternetPlan {
  max_devices?: number;
  archived_at?: IsoDateTime | null;
  duration_seconds?: number;
  bandwidth_profile?: number | null;
  bandwidth_profile_name?: string | null;
  service_type?: 'hotspot' | 'iot_mac';
  plan_type?: 'voucher' | 'iot_mac';
  is_public?: boolean;
  agent_enabled?: boolean;
  public_router?: string | null;
  id: number;
  name: string;
  price: Kobo;
  /** Pre-formatted by the server, e.g. "₦1,000". */
  price_display: string;
  duration_hours: number;
  /** e.g. "5M/10M" (up/down). */
  rate_limit: string;
  /** MB; 0 = unlimited. */
  data_limit: number;
  voucher_prefix: string;
  voucher_code_format?: VoucherCodeFormat | 'tenant_default';
  is_active: boolean;
  created_at: IsoDateTime;
}

export interface InternetPlanWrite {
  bandwidth_profile?: number | null;
  service_type?: 'hotspot' | 'iot_mac';
  plan_type?: 'voucher' | 'iot_mac';
  is_public?: boolean;
  agent_enabled?: boolean;
  public_router?: string | null;
  name: string;
  price: Kobo;
  duration_hours: number;
  rate_limit: string;
  data_limit?: number;
  voucher_prefix?: string;
  voucher_code_format?: VoucherCodeFormat | 'tenant_default';
  is_active?: boolean;
}

export interface PlanListParams extends PageParams {
  archived?: boolean;
  plan_type?: 'voucher' | 'iot_mac';
  is_active?: boolean;
  duration_hours?: number;
}

export type VoucherStatus = 'unused' | 'sold' | 'used' | 'active' | 'expired' | 'disabled';
export type VoucherSource = 'admin' | 'agent' | 'customer';

/** `password` is write-only; credentials are only readable through print/pdf. */
export interface Voucher {
  id: number;
  username: string;
  /** Single customer access code (username == password); null when the voucher has a separate, print-only password. */
  access_code?: string | null;
  plan: number;
  plan_name: string;
  plan_duration: string;
  price_display: string;
  tenant: number;
  tenant_name: string;
  agent: number | null;
  agent_name: string | null;
  status: VoucherStatus;
  can_edit?: boolean;
  generation_source: VoucherSource;
  device_limit: number;
  expires_at: IsoDateTime | null;
  activated_at: IsoDateTime | null;
  created_at: IsoDateTime;
}

export interface VoucherListParams extends PageParams {
  agent?: number;
  status?: VoucherStatus;
  plan?: number;
  created_after?: string;
  created_before?: string;
}

export interface VoucherGenerateRequest {
  device_limit?: number;
  plan_id: number;
  /** 1–100 */
  quantity: number;
  /** ≤ 10 chars */
  prefix?: string;
}

export interface VoucherManualWrite {
  username: string;
  password: string;
  plan: number;
  device_limit?: number;
}

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned' | 'reversed';

export interface PaymentTransaction {
  id: number;
  reference: string;
  amount: Kobo;
  status: PaymentStatus;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  voucher: number | null;
  voucher_username: string | null;
  tenant: number;
  plan: number | null;
  paystack_reference: string;
  created_at: IsoDateTime;
  paid_at: IsoDateTime | null;
  // Phase 3B
  display_status_code?: PaymentDisplayStatus | null;
  display_status_label?: string | null;
  provider_status?: string | null;
  reconciliation_state?: ReconciliationState | null;
  next_reconciliation_at?: IsoDateTime | null;
  verification_attempts?: number | null;
  last_verified_at?: IsoDateTime | null;
  reconciliation_error?: string | null;
  fulfilment_attempts?: number | null;
  last_fulfilment_attempt_at?: IsoDateTime | null;
}

export interface PaymentListParams extends PageParams {
  status?: PaymentStatus;
  tenant?: number;
  plan?: number;
}
