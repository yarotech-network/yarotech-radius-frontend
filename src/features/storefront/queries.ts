import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PaymentCallbackResponse,
  PaymentDisplayStatus,
  PublicBuyRequest,
} from '@/types/api';
import { isPollableDisplayStatus, resolveDisplayStatus } from '@/features/payments/paymentStatus';
import { storefrontApi, type PublicPlanParams } from './api';

export const storefrontKeys = {
  all: ['storefront'] as const,
  tenant: (slug: string) => [...storefrontKeys.all, 'tenant', slug] as const,
  plans: (slug: string, params: PublicPlanParams) =>
    [...storefrontKeys.all, 'plans', slug, params] as const,
  result: (reference: string) => [...storefrontKeys.all, 'result', reference] as const,
  pricing: () => [...storefrontKeys.all, 'pricing'] as const,
};

/** Older servers signal fulfillment through voucher; never render that legacy value. */
export function paymentFulfilled(result: PaymentCallbackResponse) {
  return result.fulfilled ?? Boolean(result.voucher);
}

export function usePublicTenant(slug: string | null) {
  return useQuery({
    queryKey: storefrontKeys.tenant(slug ?? ''),
    queryFn: () => storefrontApi.tenant(slug ?? ''),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
    retry: (count, error) =>
      !(error instanceof Error && 'status' in error && error.status === 404) && count < 2,
  });
}

export function usePublicPlans(slug: string | null, params: PublicPlanParams = {}) {
  return useQuery({
    queryKey: storefrontKeys.plans(slug ?? '', params),
    queryFn: () => storefrontApi.plans(slug ?? '', params),
    enabled: Boolean(slug),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchInterval: 10_000,
  });
}

export function useStartCheckout() {
  return useMutation({ mutationFn: (payload: PublicBuyRequest) => storefrontApi.buy(payload) });
}

/** Polls the return endpoint every 5 s while still pending/needs_review/paid_unfulfilled. Backend is authoritative. */
export function usePaymentResult(reference: string | null) {
  return useQuery({
    queryKey: storefrontKeys.result(reference ?? ''),
    queryFn: () => storefrontApi.result(reference ?? ''),
    enabled: Boolean(reference),
    refetchInterval: (query) => {
      const result = query.state.data as unknown as {
        display_status_code?: PaymentDisplayStatus | null;
        status?: string | null;
      } | undefined;
      if (!result) return false;
      // Backend remains authoritative: never derive needs_review from timestamps.
      const code = resolveDisplayStatus(result);
      if (isPollableDisplayStatus(code)) return 5_000;
      // Legacy backends without display_status_code: keep checking while the
      // voucher has not been issued yet (pre-existing recovery behavior).
      if (
        !result.display_status_code &&
        result.status === 'success' &&
        !paymentFulfilled(result as unknown as PaymentCallbackResponse)
      )
        return 5_000;
      return false;
    },
  });
}

export function usePlatformPricing() {
  return useQuery({
    queryKey: storefrontKeys.pricing(),
    queryFn: storefrontApi.pricing,
    select: (page) => page.results.filter((p) => p.is_active),
    staleTime: 5 * 60_000,
  });
}


export function useVerifyPaymentResult() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: storefrontApi.verify,
    onSuccess: async (payment) => {
      const queryKey = storefrontKeys.result(payment.reference);
      await client.cancelQueries({ queryKey });
      client.setQueryData(queryKey, payment);
    },
  });
}
