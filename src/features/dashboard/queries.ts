import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LIVE_POLL_INTERVAL_MS } from '@/app/config/constants';
import type { LiveUsersParams } from '@/types/api';
import { dashboardApi } from './api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  live: (params: LiveUsersParams) => [...dashboardKeys.all, 'live', params] as const,
};

/** Aggregate options; callers must supply a permission-gated, identity-scoped key. */
export function dashboardStatsQuery() {
  return {
    queryKey: dashboardKeys.stats(),
    queryFn: dashboardApi.stats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  };
}

export function dashboardLiveQuery(params: LiveUsersParams) {
  return {
    queryKey: dashboardKeys.live(params),
    queryFn: () => dashboardApi.liveUsers(params),
    staleTime: 30_000,
  };
}

export function useDashboardStats(enabled = true) {
  const principal = usePrincipal();
  const tenant =
    principal.kind === 'member'
      ? principal.tenantId
      : principal.kind === 'platform_staff'
        ? principal.activeTenantId
        : null;
  return useQuery({
    ...dashboardStatsQuery(),
    queryKey: [...dashboardKeys.stats(), principal.user.id, tenant],
    enabled: enabled && can(principal, 'dashboard.view'),
  });
}

export function useLiveUsers(
  params: LiveUsersParams,
  options: { live?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    ...dashboardLiveQuery(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    refetchInterval: options.live === false ? false : LIVE_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useDisconnectSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) => dashboardApi.disconnect(sessionId),
    onSuccess: () => client.invalidateQueries({ queryKey: [...dashboardKeys.all, 'live'] }),
  });
}

export function useNetworkSummary(live = true, enabled = true) {
  const principal = usePrincipal();
  const tenant =
    principal.kind === 'member'
      ? principal.tenantId
      : principal.kind === 'platform_staff'
        ? principal.activeTenantId
        : null;
  return useQuery({
    queryKey: [...dashboardKeys.all, 'network', principal.user.id, tenant],
    queryFn: dashboardApi.network,
    enabled: enabled && can(principal, 'sessions.view'),
    staleTime: 15_000,
    refetchInterval: live ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}
