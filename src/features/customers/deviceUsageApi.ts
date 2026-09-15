import { http } from '@/services/api/http';
import type { Paginated } from '@/types/api';
export type DeviceUsage = {
  mac_address: string;
  codes_used: number;
  lifetime_codes_used: number;
  sessions: number;
  first_seen: string;
  last_seen: string;
  bytes_total: number;
  status: 'online' | 'offline' | 'unknown';
};
export type DeviceCode = {
  voucher_id: number;
  access_code: string;
  plan: string;
  status: string;
  expires_at: string | null;
  device_limit: number;
  first_seen: string;
  last_seen: string;
  sessions: number;
  bytes_total: number;
};
export type DeviceUsageResponse = Paginated<DeviceUsage> & {
  summary: { devices: number; distinct_codes: number };
  synced_at: string | null;
  timezone: string;
  accounting_note: string;
};
export const deviceUsageApi = {
  list: (params: Record<string, string | number>) =>
    http.get<DeviceUsageResponse>('/customer-devices/', params),
  codes: (mac: string, params: Record<string, string | number>) =>
    http.get<Paginated<DeviceCode>>(`/customer-devices/${encodeURIComponent(mac)}/codes/`, params),
};
