import { http } from '@/services/api/http';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type {
  Paginated,
  PageParams,
  PaymentCallbackResponse,
  PublicBuyRequest,
  PublicPlan,
  PublicTenant,
  SubscriptionPlan,
} from '@/types/api';

export interface PublicPlanParams extends PageParams {
  ordering?: 'price' | '-price' | 'duration_hours' | '-duration_hours';
}

export interface CheckoutStart {
  amount?: number;
  device_limit?: number;
  base_amount?: number;
  authorization_url: string;
  reference: string;
}

/** Unauthenticated storefront + checkout endpoints (also used by the agent portal to discover plans — gap #1). */
export const storefrontApi = {
  tenant: (slug: string) =>
    http.get<PublicTenant>(`/public/tenants/${encodeURIComponent(slug)}/`, undefined, {
      anonymous: true,
      tenantId: null,
    }),
  plans: (slug: string, params: PublicPlanParams = {}) =>
    http.get<Paginated<PublicPlan>>(
      `/public/tenants/${encodeURIComponent(slug)}/plans/`,
      { ordering: 'price', page_size: 100, ...params },
      { anonymous: true, tenantId: null },
    ),
  /** 200 → redirect to Paystack; 503 → provider down but a pending transaction + reference exist. */
  buy: (payload: PublicBuyRequest, idempotencyKey = newIdempotencyKey('buy')) =>
    http.post<CheckoutStart>('/buy/', payload, { anonymous: true, tenantId: null, idempotencyKey }),
  /** Paystack return handler: status, plan and — while the voucher is unused — its access code. */
  verify: (reference: string) =>
    http.post<PaymentCallbackResponse>('/payments/verify/', { reference }, { anonymous: true, tenantId: null }),
  result: (reference: string) =>
    http.get<PaymentCallbackResponse>(
      '/payments/callback/',
      { reference },
      { anonymous: true, tenantId: null },
    ),
  pricing: () =>
    http.get<Paginated<SubscriptionPlan>>(
      '/pricing/',
      { page_size: 100 },
      { anonymous: true, tenantId: null },
    ),
};
