import { http } from '@/services/api/http';
import type { Paginated } from '@/types/api';
export type PPPoEPlan = {
  id: number;
  name: string;
  bandwidth_profile: number;
  bandwidth_profile_name: string;
  rate_limit: string;
  duration_hours: number;
  price: number;
  is_active: boolean;
};
export type PPPoEService = {
  id: number;
  customer: number;
  plan: number;
  plan_name: string;
  router: string;
  router_name: string;
  username: string;
  rate_limit: string;
  period_hours: number;
  expires_at: string;
  suspended: boolean;
  status: 'configured' | 'expired' | 'suspended';
  version: number;
  disconnect_state: string;
  last_reconciled_at: string | null;
};
export const pppoeApi = {
  plans: (params: Record<string, string | number | boolean>) =>
    http.get<Paginated<PPPoEPlan>>('/pppoe-plans/', params),
  createPlan: (
    data: { name: string; bandwidth_profile: number; duration_hours: number; price: number },
    idempotencyKey: string,
  ) => http.post<PPPoEPlan>('/pppoe-plans/', data, { idempotencyKey }),
  updatePlan: (id: number, is_active: boolean) =>
    http.patch<PPPoEPlan>(`/pppoe-plans/${id}/`, { is_active }),
  services: (customer: number) =>
    http.get<Paginated<PPPoEService>>('/pppoe-services/', { customer }),
  create: (
    data: { customer: number; plan: number; router: string; password: string },
    idempotencyKey: string,
  ) => http.post<PPPoEService>('/pppoe-services/', data, { idempotencyKey }),
  action: (service: PPPoEService, action: string, password: string, idempotencyKey: string) =>
    http.post<PPPoEService>(
      `/pppoe-services/${service.id}/${action}/`,
      { expected_version: service.version, ...(action === 'password' ? { password } : {}) },
      { idempotencyKey },
    ),
  routers: (search: string) =>
    http.get<Paginated<{ id: string; name: string; is_active: boolean }>>('/routers/', {
      search,
      page_size: 100,
    }),
};
