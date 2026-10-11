import { http } from '@/services/api/http';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type {
  MembershipRole,
  Paginated,
  SubscriptionCheckoutRequest,
  SubscriptionPayment,
  SubscriptionPlan,
  TenantMembership,
  TenantMembershipWrite,
  TenantProfile,
  TenantProfileWrite,
  TenantSetting,
  TenantSettingWrite,
  TenantSubscription,
} from '@/types/api';

export interface MembershipListParams {
  role?: MembershipRole;
  user?: number;
  tenant?: number;
  page?: number;
  page_size?: number;
}

export interface CheckoutResult {
  authorization_url: string;
  reference: string;
}

export const settingsApi = {
  officer: () => http.get<{ name: string; email: string; phone: string; assigned: boolean }>('/tenants/officer/'),
  officerRequests: () => http.get<Array<{ id: number; reason: string; status: string; created_at: string }>>('/tenants/officer/change-requests/'),
  requestOfficerChange: (reason: string) => http.post<{ id: number; status: string }>('/tenants/officer/change-requests/', { reason }),
  startOwnerTransfer: (email: string, password: string) => http.post<{ status: string; expires_at: string }>('/tenants/owner-transfer/', { email, password }),
  acceptOwnerTransfer: (payload: { token: string; username?: string; password?: string }) => http.post<{ status: string; tenant_name: string }>('/tenants/owner-transfer/accept/', payload),
  /* tenants/profile/ and tenants/settings/ — manager+ */
  profile: () => http.get<TenantProfile>('/tenants/profile/'),
  updateProfile: (payload: TenantProfileWrite) =>
    http.patch<TenantProfile>('/tenants/profile/', payload),
  settings: () => http.get<TenantSetting>('/tenants/settings/'),
  /** Paystack keys are write-only: send only when the user typed a new one. */
  updateSettings: (payload: TenantSettingWrite) =>
    http.patch<TenantSetting>('/tenants/settings/', payload),

  /* tenant-memberships/ — read any member, write owner-only */
  memberships: (params: MembershipListParams) =>
    http.get<Paginated<TenantMembership>>('/tenant-memberships/', { ...params }),
  addMember: (payload: TenantMembershipWrite, idempotencyKey = newIdempotencyKey('member')) =>
    http.post<TenantMembership>('/tenant-memberships/', payload, { idempotencyKey }),
  changeRole: (id: number, role: MembershipRole) =>
    http.patch<TenantMembership>(`/tenant-memberships/${id}/`, { role }),
  removeMember: (id: number) => http.delete(`/tenant-memberships/${id}/`),

  /* subscriptions */
  subscription: () => http.get<TenantSubscription>('/subscriptions/'),
  pricing: () => http.get<Paginated<SubscriptionPlan>>('/pricing/', { page_size: 100 }),
  checkout: (
    payload: SubscriptionCheckoutRequest,
    idempotencyKey = newIdempotencyKey('checkout'),
  ) => http.post<CheckoutResult>('/subscriptions/checkout/', payload, { idempotencyKey }),
  verifySubscriptionPayment: (reference: string) =>
    http.post<SubscriptionPayment>(
      `/subscriptions/payments/${encodeURIComponent(reference)}/verify/`,
      {},
    ),
  subscriptionPayment: (reference: string) =>
    http.get<SubscriptionPayment>(`/subscriptions/payments/${encodeURIComponent(reference)}/`),
};
