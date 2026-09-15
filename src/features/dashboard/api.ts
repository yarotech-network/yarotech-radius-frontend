import { http } from '@/services/api/http';
import type {
  DashboardStats,
  NetworkSummary,
  DisconnectResult,
  LiveUsersParams,
  LiveUsersResponse,
} from '@/types/api';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';

export const dashboardApi = {
  network() {
    return http.get<NetworkSummary>('/dashboard/network/');
  },
  stats() {
    return http.get<DashboardStats>('/dashboard/stats/');
  },
  liveUsers(params: LiveUsersParams) {
    return http.get<LiveUsersResponse>('/dashboard/live-users/', { ...params });
  },
  disconnect(sessionId: number, idempotencyKey = newIdempotencyKey('kick')) {
    return http.post<DisconnectResult>(
      `/dashboard/live-users/${sessionId}/disconnect/`,
      undefined,
      { idempotencyKey },
    );
  },
};
