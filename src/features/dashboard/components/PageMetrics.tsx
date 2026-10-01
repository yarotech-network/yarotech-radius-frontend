import { Link } from 'react-router';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { Alert } from '@/components/feedback';
import { Stat } from '@/components/ui';
import { formatNumber } from '@/lib/formatting/units';
import { formatDateTime } from '@/lib/formatting/dates';
import { useDashboardStats } from '../queries';
import { BusinessCards } from './BusinessCards';

export function PaymentAttention({ count }: { count: number | undefined }) {
  const principal = usePrincipal();
  if (!count || !can(principal, 'payments.view')) return null;
  return (
    <Alert tone="warning" title={`${count} paid ${count === 1 ? 'order needs' : 'orders need'} fulfilment`}>
      Payment was verified but access has not been fulfilled.{' '}
      <Link
        className="dashboard-data-link"
        to={can(principal, 'payments.recovery.view') ? '/payments/recovery' : '/payments'}
      >
        Review payments
      </Link>
    </Alert>
  );
}

export function PageMetrics({
  section,
}: {
  section: 'payments' | 'vouchers' | 'plans' | 'customers';
}) {
  const principal = usePrincipal();
  const allowed =
    can(principal, 'dashboard.view') &&
    can(
      principal,
      section === 'payments'
        ? 'payments.view'
        : section === 'vouchers'
          ? 'vouchers.view'
          : section === 'plans'
            ? 'plans.view'
            : 'customers.view',
    );
  const query = useDashboardStats(allowed);
  if (!allowed) return null;
  const s = query.data;
  const counts =
    section === 'customers'
      ? ([['Contact records', s?.total_customers]] as const)
      : ([
          ['Total plans', s?.total_plans],
          ['Active plans', s?.active_plans],
          [
            'Inactive plans',
            s?.total_plans == null || s.active_plans == null
              ? undefined
              : s.total_plans - s.active_plans,
          ],
        ] as const);
  return (
    <section aria-label={`${section} workspace summary`} className="space-y-4">
      <p className="text-sm text-ink-500">
        Workspace-wide figures · independent of list filters
        {section === 'customers' || section === 'plans' ? ' · archived records excluded' : ''}.
      </p>
      {s?.observed_at && (
        <p className="text-xs text-ink-500">Figures as of {formatDateTime(s.observed_at)}.</p>
      )}
      {section === 'customers' && (
        <p className="text-sm text-ink-500">
          Saved customer profiles, separate from purchases and connected devices.
        </p>
      )}
      {query.isError && (
        <Alert tone="warning" title="Summary could not be refreshed">
          {s
            ? 'Showing the last successful figures.'
            : 'Figures are unavailable; this does not mean zero.'}{' '}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            Retry summary
          </button>
        </Alert>
      )}
      {section === 'payments' && <PaymentAttention count={s?.paid_unfulfilled_payments} />}
      {section === 'payments' || section === 'vouchers' ? (
        <div id={section === 'vouchers' ? 'voucher-revenue' : 'collections'}>
          <BusinessCards section={section} stats={s} loading={query.isPending} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {counts.map(([label, value]) => (
            <Stat
              key={label}
              label={label}
              value={value == null ? '—' : formatNumber(value)}
              loading={query.isPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}
