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
export function formatSpeed(kbps: number) {
  return kbps >= 1000 ? `${kbps / 1000} Mbps` : `${kbps} kbps`;
}
export function toKbps(value: string, unit: string) {
  const text = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  const fraction = match?.[2] ?? '';
  const precision = unit === 'Mbps' ? 3 : 0;
  if (!match || /[1-9]/.test(fraction.slice(precision)))
    throw new Error('Use whole kbps, or Mbps with up to three decimal places.');
  const result =
    Number(match[1]) * (unit === 'Mbps' ? 1000 : 1) +
    (unit === 'Mbps' ? Number(fraction.slice(0, 3).padEnd(3, '0')) : 0);
  if (!Number.isSafeInteger(result) || result < 1 || result > 10000000)
    throw new Error('Enter a speed from 1 kbps to 10,000 Mbps, in whole kbps.');
  return result;
}
