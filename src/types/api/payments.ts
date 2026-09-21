import type { IsoDateTime, Kobo, PageParams } from './common';
import type { PaymentStatus } from './vouchers';

export type FulfillmentStatus = 'fulfilled' | 'paid_unfulfilled' | 'unverified';
export type DeliveryStatus =
  'not_requested' | 'pending' | 'sending' | 'accepted' | 'failed' | 'unknown';

export interface PaymentRecovery {
  purchase_kind?: 'voucher' | 'iot';
  id: number;
  reference: string;
  amount: Kobo;
  status: PaymentStatus;
  verified_at: IsoDateTime | null;
  voucher: number | null;
  fulfillment_status: FulfillmentStatus;
  delivery_status: DeliveryStatus;
}

export interface RecoveryListParams extends PageParams {
  status?: PaymentStatus;
  plan?: number;
}

export interface PaymentDelivery {
  id: string;
  payment: number;
  status: Exclude<DeliveryStatus, 'not_requested'>;
  error_code: string;
  created_at: IsoDateTime;
  started_at: IsoDateTime | null;
  completed_at: IsoDateTime | null;
}

export interface DeliveryListParams extends PageParams {
  payment?: number;
  status?: string;
}

export interface DeliverRequest {
  acknowledge_duplicate_risk?: boolean;
}

export interface PublicBuyRequest {
  device_limit?: number;
  plan_id: number;
  email: string;
  name?: string;
  phone?: string;
}

export interface PaymentCallbackPlan {
  device_limit?: number;
  name: string;
  duration_hours: number;
  /** MB; 0 = unlimited. */
  data_limit: number;
}

/**
 * `GET payments/callback/?reference=` (anonymous). Customer vouchers use one access code as both
 * username and password; `access_code` is present only while the voucher is still unused, so a
 * shared or logged reference stops being a usable credential after the first login.
 */
export interface PaymentCallbackResponse {
  captive_portal_url?: string | null;
  kind?: 'voucher' | 'iot';
  renewal_token?: string | null;
  device_status?: string | null;
  expires_at?: string | null;
  network_enforcement?: string;
  fulfilled?: boolean;
  payment_verified?: boolean;
  status: PaymentStatus;
  reference: string;
  voucher: string | null;
  access_code?: string | null;
  code_revealed?: boolean;
  plan?: PaymentCallbackPlan | null;
  tenant_name?: string;
  /** e.g. `c•••@example.com` — for "we emailed it to …" copy. */
  customer_email_masked?: string;
}
