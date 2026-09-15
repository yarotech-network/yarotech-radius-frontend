import type { VoucherCodeFormat } from './vouchers';
import type { IsoDateTime, Kobo, PageParams } from './common';

export interface Tenant {
  owner_setup_pending?: boolean;
  owner_delivery_status?: 'sent' | 'failed';
  id: number;
  name: string;
  business_name?: string;
  slug: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  is_platform_admin: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  member_count: number;
  voucher_count: number;
}

export interface TenantListParams extends PageParams {
  is_active?: boolean;
  is_platform_admin?: boolean;
}

export interface TenantWrite {
  owner_email?: string;
  owner_username?: string;
  name: string;
  business_name?: string;
  slug: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active?: boolean;
  is_platform_admin?: boolean;
}

/** `GET/PATCH tenants/profile/` — a manager's own tenant contact record. */
export interface TenantProfile {
  id: number;
  name: string;
  business_name?: string;
  slug: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  updated_at: IsoDateTime;
}

export interface TenantProfileWrite {
  business_name?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export type MembershipRole = 'owner' | 'manager' | 'staff';

export interface TenantMembership {
  is_active?: boolean;
  id: number;
  user: number;
  tenant: number;
  role: MembershipRole;
  user_display: string;
  tenant_display: string;
  created_at: IsoDateTime;
}

export interface MembershipListParams extends PageParams {
  role?: MembershipRole;
  user?: number;
  tenant?: number;
}

export interface TenantMembershipWrite {
  is_active?: boolean;
  user: number;
  /** Required by the serializer even for owners (send your own tenant id); owners are pinned to their tenant server-side. */
  tenant: number;
  role: MembershipRole;
}

/** Paystack keys are write-only and never returned. */
export interface TenantSetting {
  agent_funding_fee_percent?: string;
  agent_funding_flat_fee?: Kobo;
  id: number;
  tenant: number;
  agent_commission_percent: string;
  voucher_prefix: string;
  default_voucher_code_format?: VoucherCodeFormat;
  max_funding_amount: Kobo;
  updated_at: IsoDateTime;
}

export interface TenantSettingWrite {
  agent_funding_fee_percent?: string;
  agent_funding_flat_fee?: Kobo;
  paystack_secret_key?: string;
  paystack_public_key?: string;
  agent_commission_percent?: string;
  voucher_prefix?: string;
  default_voucher_code_format?: VoucherCodeFormat;
  max_funding_amount?: Kobo;
}

export interface PublicTenant {
  id: number;
  slug: string;
  name: string;
}

export interface PublicPlan {
  plan_type?: 'voucher' | 'iot_mac';
  max_devices?: number;
  id: number;
  name: string;
  price: Kobo;
  duration_hours: number;
  rate_limit: string;
  data_limit: number;
}
