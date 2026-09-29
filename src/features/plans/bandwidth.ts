import { useQuery } from '@tanstack/react-query';
import { http } from '@/services/api/http';
import type { Paginated } from '@/types/api';

export type BandwidthProfile = {
  id: number;
  name: string;
  upload_kbps: number;
  download_kbps: number;
  rate_limit: string;
  is_active: boolean;
  plan_count?: number;
  created_at: string;
};
export type BandwidthWrite = Pick<
  BandwidthProfile,
  'name' | 'upload_kbps' | 'download_kbps' | 'is_active'
>;
export const bandwidthKey = ['bandwidth-profiles'] as const;
export const bandwidthApi = {
  list: (params: Record<string, string | number | boolean>) =>
    http.get<Paginated<BandwidthProfile>>('/bandwidth-profiles/', params),
  get: (id: number) => http.get<BandwidthProfile>(`/bandwidth-profiles/${id}/`),
  create: (data: BandwidthWrite, idempotencyKey: string) =>
    http.post<BandwidthProfile>('/bandwidth-profiles/', data, { idempotencyKey }),
  update: (id: number, data: Partial<BandwidthWrite>) =>
    http.patch<BandwidthProfile>(`/bandwidth-profiles/${id}/`, data),
  remove: (id: number) => http.delete(`/bandwidth-profiles/${id}/`),
};
export function useBandwidth(params: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: [...bandwidthKey, 'list', params],
    queryFn: () => bandwidthApi.list(params),
  });
}
export function speedInput(kbps: number) {
  const unit = kbps >= 1000000 ? 'Gbps' : kbps >= 1000 ? 'Mbps' : 'kbps';
  const factor = unit === 'Gbps' ? 1000000 : unit === 'Mbps' ? 1000 : 1;
  return { value: String(kbps / factor), unit };
}
export function formatSpeed(kbps: number) {
  const { value, unit } = speedInput(kbps);
  return `${value} ${unit === 'kbps' ? 'Kbps' : unit}`;
}
export function toKbps(value: string, unit: string) {
  const precision = unit === 'Gbps' ? 6 : unit === 'Mbps' ? 3 : unit === 'kbps' ? 0 : -1;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  const fraction = match?.[2] ?? '';
  if (precision < 0 || !match || /[1-9]/.test(fraction.slice(precision)))
    throw new Error('Use whole Kbps, Mbps with up to three decimals, or Gbps with up to six decimals.');
  const result = Number(match[1]) * 10 ** precision +
    Number(fraction.slice(0, precision).padEnd(precision, '0'));
  if (!Number.isSafeInteger(result) || result < 1 || result > 10000000)
    throw new Error('Enter a speed from 1 Kbps to 10 Gbps, in whole Kbps.');
  return result;
}
