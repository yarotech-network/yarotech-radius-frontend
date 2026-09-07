import type { IsoDateTime, Kobo, PageParams } from './common';

export interface PlanLimits {
  max_routers?: number | null;
  daily_voucher_print_limit?: number | null;
  whatsapp_enabled?: boolean;
}

export interface PurchasedPlanTerms extends PlanLimits {
  name: string;
  price: number;
  duration_days: number;
  version: number;
}

export interface SubscriptionPlan extends PlanLimits {
  id: number;
  name: string;
  price: Kobo;
  price_display: string;
  duration_days: number;
  features: unknown[];
  is_active: boolean;
  version?: number;
}

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export interface TenantSubscription {
  id: number;
  tenant: number;
  plan: number;
  plan_name: string;
  status: SubscriptionStatus;
  started_at: IsoDateTime;
  expires_at: IsoDateTime;
  is_trial: boolean;
  is_expired: boolean;
  entitlements?: {
    terms: PurchasedPlanTerms;
    plan_id?: number;
    enabled: boolean;
    routers_used: number;
    vouchers_prepared_today: number;
    day: string;
    timezone: string;
    upcoming: { starts_at: string; ends_at: string; terms: PurchasedPlanTerms }[];
  };
}

export interface SubscriptionCheckoutRequest {
  plan_id: number;
}

export type SubscriptionPaymentStatus = 'pending' | 'success' | 'failed';

export interface SubscriptionPayment {
  reference: string;
  amount: Kobo;
  status: SubscriptionPaymentStatus;
  plan: number;
  subscription: number | null;
  created_at: IsoDateTime;
  completed_at: IsoDateTime | null;
}

export interface PlatformSubscriptionPayment extends SubscriptionPayment {
  id: number;
  tenant: number;
}

export interface SubscriptionPaymentListParams extends PageParams {
  tenant?: number;
  status?: SubscriptionPaymentStatus;
  plan?: number;
}
