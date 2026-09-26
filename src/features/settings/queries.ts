import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isApiError } from '@/services/api/errors';
import { isPollableDisplayStatus, resolveDisplayStatus } from '@/features/payments/paymentStatus';
import type {
  MembershipRole,
  PaymentDisplayStatus,
  SubscriptionCheckoutRequest,
  TenantMembershipWrite,
  TenantProfileWrite,
  TenantSettingWrite,
} from '@/types/api';
import { settingsApi, type MembershipListParams } from './api';

export const settingsKeys = {
  all: ['settings'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
  billing: () => [...settingsKeys.all, 'billing'] as const,
  memberships: (params: MembershipListParams) =>
    [...settingsKeys.all, 'memberships', params] as const,
  subscription: () => [...settingsKeys.all, 'subscription'] as const,
  pricing: () => [...settingsKeys.all, 'pricing'] as const,
  subscriptionPayment: (reference: string) =>
    [...settingsKeys.all, 'subscription-payment', reference] as const,
};

export function useTenantProfile(enabled = true) {
  return useQuery({ queryKey: settingsKeys.profile(), queryFn: settingsApi.profile, enabled });
}

export function useUpdateTenantProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: TenantProfileWrite) => settingsApi.updateProfile(payload),
    onSuccess: (profile) => client.setQueryData(settingsKeys.profile(), profile),
  });
}

export function useTenantSettings(enabled = true) {
  return useQuery({ queryKey: settingsKeys.billing(), queryFn: settingsApi.settings, enabled });
}

export function useUpdateTenantSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: TenantSettingWrite) => settingsApi.updateSettings(payload),
    onSuccess: (settings) => client.setQueryData(settingsKeys.billing(), settings),
  });
}

export function useMemberships(params: MembershipListParams) {
  return useQuery({
    queryKey: settingsKeys.memberships(params),
    queryFn: () => settingsApi.memberships(params),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateMemberships() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [...settingsKeys.all, 'memberships'] });
}

export function useAddMember() {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: (payload: TenantMembershipWrite) => settingsApi.addMember(payload),
    onSuccess: () => void invalidate(),
  });
}

export function useChangeRole() {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: MembershipRole }) =>
      settingsApi.changeRole(id, role),
    onSuccess: () => void invalidate(),
  });
}

export function useRemoveMember() {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: (id: number) => settingsApi.removeMember(id),
    onSuccess: () => void invalidate(),
  });
}

/** `null` data means "no subscription yet" (server 404) — not an error. */
export function useSubscription(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.subscription(),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await settingsApi.subscription();
      } catch (error) {
        if (isApiError(error) && error.status === 404) return null;
        throw error;
      }
    },
  });
}

export function usePricing() {
  return useQuery({
    queryKey: settingsKeys.pricing(),
    queryFn: settingsApi.pricing,
    select: (page) => page.results.filter((p) => p.is_active),
    staleTime: 5 * 60_000,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (payload: SubscriptionCheckoutRequest) => settingsApi.checkout(payload),
  });
}

/** Polls a checkout reference every 5 s while pending/needs_review/paid_unfulfilled. Backend is authoritative. */
export function useSubscriptionPayment(reference: string | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: settingsKeys.subscriptionPayment(reference ?? ''),
    queryFn: async () => {
      const payment = await settingsApi.subscriptionPayment(reference ?? '');
      if (payment.status === 'success')
        void client.invalidateQueries({ queryKey: settingsKeys.subscription() });
      return payment;
    },
    enabled: reference !== null,
    refetchInterval: (query) => {
      const data = query.state.data as unknown as {
        display_status_code?: PaymentDisplayStatus | null;
        status?: string | null;
      } | undefined;
      if (!data) return false;
      return isPollableDisplayStatus(resolveDisplayStatus(data)) ? 5_000 : false;
    },
  });
}

export function useVerifySubscriptionPayment(reference: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => settingsApi.verifySubscriptionPayment(reference),
    onSuccess: async (payment) => {
      const queryKey = settingsKeys.subscriptionPayment(reference);
      // Cancel an older status read before publishing the verified result.
      await client.cancelQueries({ queryKey });
      client.setQueryData(queryKey, payment);
      if (payment.status === 'success')
        await client.invalidateQueries({ queryKey: settingsKeys.subscription() });
    },
  });
}
