import { http } from '@/services/api/http';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type {
  AuditEvent,
  AuditListParams,
  MembershipListParams,
  NasDevice,
  Paginated,
  PaymentListParams,
  PaymentTransaction,
  PlatformStats,
  PlatformSubscriptionPayment,
  PlatformWalletPayment,
  PlatformWalletPaymentListParams,
  RouterListParams,
  StaffAssignment,
  StaffAccount,
  StaffAccountCreate,
  StaffAssignmentListParams,
  StaffAssignmentWrite,
  StaffInvitation,
  StaffInvitationListParams,
  SubscriptionPaymentListParams,
  Tenant,
  TenantListParams,
  TenantMembership,
  TenantMembershipWrite,
  TenantWrite,
} from '@/types/api';

/**
 * Platform console (`IsPlatformAdmin`). Admins have no tenant context, so every call pins
 * `tenantId: null` — an `X-Tenant-ID` header would be meaningless (and misleading) here.
 */
const opts = { tenantId: null } as const;

export const platformApi = {
  stats: () => http.get<PlatformStats>('/platform/dashboard/', undefined, opts),

  /* tenants — `tenants/` is shared with owners, but only admins may write */
  tenants: (params: TenantListParams = {}) =>
    http.get<Paginated<Tenant>>('/tenants/', { ...params }, opts),
  tenant: (id: number) => http.get<Tenant>(`/tenants/${id}/`, undefined, opts),
  createTenant: (payload: TenantWrite, idempotencyKey = newIdempotencyKey('tenant')) =>
    http.post<Tenant>('/tenants/', payload, { ...opts, idempotencyKey }),
  updateTenant: (id: number, payload: Partial<TenantWrite>) =>
    http.patch<Tenant>(`/tenants/${id}/`, payload, opts),
  /** Hard delete: cascades memberships, routers, vouchers, payments. */
  deleteTenant: (id: number) => http.delete(`/tenants/${id}/`, opts),

  /* memberships (admin sees all tenants) */
  memberships: (params: MembershipListParams = {}) =>
    http.get<Paginated<TenantMembership>>('/tenant-memberships/', { ...params }, opts),
  addMembership: (payload: TenantMembershipWrite, idempotencyKey = newIdempotencyKey('member')) =>
    http.post<TenantMembership>('/tenant-memberships/', payload, { ...opts, idempotencyKey }),
  changeMembershipRole: (id: number, role: TenantMembershipWrite['role']) =>
    http.patch<TenantMembership>(`/tenant-memberships/${id}/`, { role }, opts),
  removeMembership: (id: number) => http.delete(`/tenant-memberships/${id}/`, opts),

  /* read-only fleet + money views */
  routers: (params: RouterListParams = {}) =>
    http.get<Paginated<NasDevice>>('/platform/routers/', { ...params }, opts),
  router: (id: string) => http.get<NasDevice>(`/platform/routers/${id}/`, undefined, opts),
  payments: (params: PaymentListParams = {}) =>
    http.get<Paginated<PaymentTransaction>>('/platform/payments/', { ...params }, opts),
  walletPayments: (params: PlatformWalletPaymentListParams = {}) =>
    http.get<Paginated<PlatformWalletPayment>>('/platform/wallet-payments/', { ...params }, opts),
  subscriptionPayments: (params: SubscriptionPaymentListParams = {}) =>
    http.get<Paginated<PlatformSubscriptionPayment>>(
      '/platform/subscription-payments/',
      { ...params },
      opts,
    ),
  audit: (params: AuditListParams = {}) =>
    http.get<Paginated<AuditEvent>>('/platform/audit-events/', { ...params }, opts),

  /* staff */
  staffAccounts: (params: { search?: string; status?: string; page?: number; page_size?: number } = {}) =>
    http.get<Paginated<StaffAccount>>('/platform/staff-accounts/', { ...params }, opts),
  createStaffAccount: (payload: StaffAccountCreate) =>
    http.post<StaffAccount>('/platform/staff-accounts/', payload, opts),
  resendStaffSetup: (id: number, temporary_password: string) =>
    http.post<StaffAccount>(`/platform/staff-accounts/${id}/resend-setup/`, { temporary_password }, opts),
  suspendStaffAccount: (id: number) =>
    http.post<StaffAccount>(`/platform/staff-accounts/${id}/suspend/`, {}, opts),
  invitations: (params: StaffInvitationListParams = {}) =>
    http.get<Paginated<StaffInvitation>>('/platform/staff-invitations/', { ...params }, opts),
  revokeInvitation: (id: string, idempotencyKey = newIdempotencyKey('revoke')) =>
    http.post<StaffInvitation>(`/platform/staff-invitations/${id}/revoke/`, undefined, {
      ...opts,
      idempotencyKey,
    }),
  assignments: (params: StaffAssignmentListParams = {}) =>
    http.get<Paginated<StaffAssignment>>('/platform/staff-assignments/', { ...params }, opts),
  createAssignment: (payload: StaffAssignmentWrite, idempotencyKey = newIdempotencyKey('assign')) =>
    http.post<StaffAssignment>('/platform/staff-assignments/', payload, {
      ...opts,
      idempotencyKey,
    }),
  updateAssignment: (
    id: number,
    payload: Partial<Pick<StaffAssignmentWrite, 'services' | 'is_active' | 'is_primary' | 'work_email' | 'work_phone'>>,
  ) => http.patch<StaffAssignment>(`/platform/staff-assignments/${id}/`, payload, opts),
  revokeAssignment: (id: number) => http.delete(`/platform/staff-assignments/${id}/`, opts),
  officerChangeRequests: () => http.get<Array<{ id: number; tenant: number; tenant_name: string; reason: string; status: string; created_at: string }>>('/platform/officer-change-requests/', undefined, opts),
  reviewOfficerChange: (id: number, status: 'approved' | 'declined', assignmentId?: number) =>
    http.post<{ id: number; status: string }>(`/platform/officer-change-requests/${id}/review/`, {
      status, ...(assignmentId ? { assignment_id: assignmentId } : {}),
    }, opts),
};
