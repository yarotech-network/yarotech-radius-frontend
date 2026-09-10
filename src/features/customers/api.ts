import { http } from '@/services/api/http';
import type { Paginated } from '@/types/api';
export type CustomerWrite = {
  reference: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};
export type Customer = CustomerWrite & {
  id: number;
  archived_at: string | null;
  has_service?: boolean;
  created_at: string;
  updated_at: string;
};
export type Preview = { count: number; rows: CustomerWrite[]; preview_token: string };
export const customersKey = ['customers'] as const;
export const customersApi = {
  list: (params: Record<string, string | number>) =>
    http.get<Paginated<Customer>>('/customers/', params),
  get: (id: number) => http.get<Customer>(`/customers/${id}/`),
  create: (data: CustomerWrite, idempotencyKey: string) =>
    http.post<Customer>('/customers/', data, { idempotencyKey }),
  update: (id: number, data: CustomerWrite) => http.patch<Customer>(`/customers/${id}/`, data),
  archive: (id: number) => http.post<Customer>(`/customers/${id}/archive/`, {}),
  restore: (id: number) => http.post<Customer>(`/customers/${id}/restore/`, {}),
  preview: (csv: string) => http.post<Preview>('/customers/import-preview/', { csv }),
  confirm: (csv: string, preview_token: string, idempotencyKey: string) =>
    http.post<{ count: number }>(
      '/customers/import-confirm/',
      { csv, preview_token },
      { idempotencyKey },
    ),
};
