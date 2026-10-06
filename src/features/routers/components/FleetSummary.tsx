import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { Alert } from '@/components/feedback';
import { KpiTile, MiniBar } from '@/components/layout';
import { formatNumber } from '@/lib/formatting/units';
import { formatDateTime } from '@/lib/formatting/dates';
import { useNetworkSummary } from '@/features/dashboard/queries';
import { routerStatusParts } from '@/features/dashboard/components/hubData';
import { RouterAllowance } from './RouterAllowance';

/**
 * One compact row above the router directory: allowance plus workspace-wide
 * connectivity. Observations are independent of the directory's filters.
 */
export function FleetSummary() {
  const principal = usePrincipal();
  const networkAllowed = can(principal, 'sessions.view') && can(principal, 'routers.view');
  const network = useNetworkSummary(true, networkAllowed);
  const n = network.data;
  const counts = n?.router_counts;
  const notInService = counts ? counts.awaiting_import + counts.inactive : 0;
  return (
    <section aria-label="Fleet summary" className="space-y-2">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <RouterAllowance />
        {networkAllowed && (
          <>
            <KpiTile
              label="Connectivity"
              value={counts ? `${formatNumber(counts.online)} online` : 'Unavailable'}
              detail={
                counts
                  ? `${formatNumber(counts.offline)} confirmed offline · ${formatNumber(counts.unknown)} unknown`
                  : 'Observations unavailable; unknown does not mean offline.'
              }
              extra={n ? <MiniBar parts={routerStatusParts(n)} /> : undefined}
              loading={network.isPending}
            />
            <KpiTile
              label="Users on your routers"
              value={n ? formatNumber(n.online_users) : 'Unavailable'}
              detail={n ? `${formatNumber(n.sessions_today)} sessions today` : 'Live sessions'}
              live={Boolean(n && n.online_users > 0)}
              to="/sessions"
              link="View live sessions"
              loading={network.isPending}
            />
            <KpiTile
              label="Not in service"
              value={counts ? formatNumber(notInService) : 'Unavailable'}
              detail={
                counts
                  ? `${formatNumber(counts.awaiting_import)} awaiting import · ${formatNumber(counts.inactive)} inactive`
                  : 'Awaiting import or switched off'
              }
              loading={network.isPending}
            />
          </>
        )}
      </div>
      {networkAllowed && network.isError && (
        <Alert tone="warning" title="Network figures unavailable">
          {n
            ? 'Showing the last successful observation.'
            : 'Unavailable data does not mean zero users or offline routers.'}
        </Alert>
      )}
      {networkAllowed && n && (
        <p className="text-xs text-ink-500">
          Observed {formatDateTime(n.observed_at)} across the whole fleet, independent of the
          filters below. Unknown means no fresh observation, not that a router is down.
        </p>
      )}
    </section>
  );
}
