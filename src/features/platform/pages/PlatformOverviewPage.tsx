import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Building2,
  Clock3,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { KpiTile, MiniBar, Section, StatusBadge } from '@/components/layout';
import { Badge, Button, ButtonLink, Card, Skeleton } from '@/components/ui';
import { Alert, EmptyState, ErrorState } from '@/components/feedback';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { PLATFORM_RECENT_TENANTS_PARAMS, usePlatformStats, useTenants } from '../queries';
import type { PlatformStats } from '@/types/api';
import { TenantSetupBadge } from '../components/TenantSetupBadge';
import { PlatformPerformance, PlatformSubscriptions } from '../components/PlatformPerformance';
import '../platform-overview.css';

/** Cross-tenant totals and recent operators, each with independent query feedback. */
export default function PlatformOverviewPage() {
  const stats = usePlatformStats();
  const recent = useTenants(PLATFORM_RECENT_TENANTS_PARAMS);
  const s = stats.data;
  const refreshing = stats.isFetching || recent.isFetching;
  const number = (value: number | undefined) =>
    value === undefined ? '—' : value.toLocaleString();

  useEffect(() => {
    document.title = 'Platform overview · Yarotech RADIUS';
  }, []);

  return (
    <div className="platform-overview min-w-0 space-y-6">
      <header className="platform-overview-header">
        <div className="min-w-0">
          <span className="platform-eyebrow">
            <ShieldCheck size={14} aria-hidden /> Platform administration
          </span>
          <h1>Platform overview</h1>
          <p>Your operators, payments and network operations in one place.</p>
          <div className="platform-updated" role="status">
            <Clock3 size={14} aria-hidden />
            {s && stats.dataUpdatedAt
              ? `Figures retrieved ${formatRelative(new Date(stats.dataUpdatedAt))}`
              : 'Figures appear after loading'}
          </div>
        </div>
        <div className="platform-header-actions">
          <Button
            variant="secondary"
            disabled={refreshing}
            leadingIcon={
              <RefreshCw className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />
            }
            onClick={() => {
              void stats.refetch();
              void recent.refetch();
            }}
          >
            {refreshing ? 'Refreshing…' : 'Refresh overview'}
          </Button>
          <ButtonLink to="/platform/tenants" leadingIcon={<Building2 />}>
            Manage operators
          </ButtonLink>
        </div>
      </header>

      {stats.isError && !s ? (
        <ErrorState
          error={stats.error}
          onRetry={() => void stats.refetch()}
          title="Could not load platform figures"
        />
      ) : (
        <>
          {stats.isError && s && (
            <Alert tone="warning" title="Figures could not be refreshed">
              Showing the last retrieved figures. Use Refresh overview to try again.
            </Alert>
          )}
          <Section title="Platform at a glance" description="Current totals across the platform.">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiTile
                label="Tenants"
                value={number(s?.tenants)}
                detail={s ? `${number(s.active_tenants)} active` : 'Registered businesses'}
                extra={
                  s && s.tenants > 0 ? (
                    <MiniBar
                      parts={[
                        { value: s.active_tenants, color: 'var(--color-success-600)' },
                        { value: s.tenants - s.active_tenants, color: 'var(--color-ink-300)' },
                      ]}
                    />
                  ) : undefined
                }
                to="/platform/tenants"
                link="View tenants"
                loading={stats.isPending}
              />
              <KpiTile
                label="Routers"
                value={number(s?.routers)}
                detail={
                  s ? `${number(s.onboarded_routers)} onboarded` : 'Registered network devices'
                }
                extra={
                  s && s.routers > 0 ? (
                    <MiniBar
                      parts={[
                        { value: s.onboarded_routers, color: 'var(--color-success-600)' },
                        {
                          value: s.routers - s.onboarded_routers,
                          color: 'var(--color-warning-600)',
                        },
                      ]}
                    />
                  ) : undefined
                }
                to="/platform/routers"
                link="View routers"
                loading={stats.isPending}
              />
              <KpiTile
                label="Agents"
                value={number(s?.agents)}
                detail="Resellers across all tenants"
                loading={stats.isPending}
              />
              <KpiTile
                label="Vouchers issued"
                value={number(s?.vouchers)}
                detail="Total access vouchers"
                loading={stats.isPending}
              />
            </div>
          </Section>

          {s && <NeedsAttention stats={s} number={number} />}
        </>
      )}

      {(!stats.isError || s) && (
        <>
          <PlatformPerformance stats={s} loading={stats.isPending} />
          {s && <PlatformSubscriptions stats={s} />}
        </>
      )}

      <div className="platform-workspace-grid">
        <Section
          title="Newest tenants"
          description="The latest operator businesses to join your platform."
          actions={
            <ButtonLink
              to="/platform/tenants"
              variant="link"
              size="sm"
              trailingIcon={<ArrowRight />}
            >
              All tenants
            </ButtonLink>
          }
        >
          {recent.isError && recent.data && (
            <Alert tone="warning" title="Tenant list could not be refreshed">
              Showing the last retrieved operators. Use Refresh overview to try again.
            </Alert>
          )}
          {recent.isPending ? (
            <Card
              aria-busy="true"
              aria-label="Loading newest tenants"
              className="space-y-5 rounded-2xl"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </Card>
          ) : recent.isError && !recent.data ? (
            <ErrorState
              error={recent.error}
              onRetry={() => void recent.refetch()}
              title="Could not load tenants"
            />
          ) : recent.data && recent.data.results.length === 0 ? (
            <Card className="rounded-2xl">
              <EmptyState
                icon={<Building2 className="size-6" />}
                title="No operator tenants yet."
                description="Add your first operator to start building your platform."
              />
              <div className="mt-3 flex justify-center">
                <ButtonLink to="/platform/tenants">Manage tenants</ButtonLink>
              </div>
            </Card>
          ) : (
            <div
              className="platform-table-scroll"
              role="region"
              aria-label="Recent tenant records"
              tabIndex={0}
            >
              <table className="platform-tenants-table">
                <caption className="sr-only">Newest tenants</caption>
                <thead>
                  <tr>
                    <th scope="col">Business</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Members
                    </th>
                    <th scope="col" className="text-right">
                      Vouchers
                    </th>
                    <th scope="col">Joined</th>
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data?.results.map((t) => (
                    <tr key={t.id}>
                      <th scope="row">
                        <div className="platform-tenant-name">
                          <span className="platform-tenant-avatar" aria-hidden>
                            {t.name.trim().slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <Link className="dashboard-data-link" to={`/platform/tenants/${t.id}`}>
                              {t.name}
                            </Link>
                            <span className="platform-tenant-slug">/s/{t.slug}</span>
                            <TenantSetupBadge tenant={t} />
                          </span>
                        </div>
                      </th>
                      <td>
                        <StatusBadge
                          status={t.is_active ? 'active' : 'inactive'}
                          size="sm"
                          className={t.is_active ? '' : 'bg-surface-muted'}
                        />
                      </td>
                      <td className="text-right tabular-nums">{number(t.member_count)}</td>
                      <td className="text-right tabular-nums">{number(t.voucher_count)}</td>
                      <td>
                        <time dateTime={t.created_at} title={formatDateTime(t.created_at)}>
                          {formatRelative(t.created_at)}
                        </time>
                      </td>
                      <td>
                        <Link
                          className="platform-row-action"
                          to={`/platform/tenants/${t.id}`}
                          aria-label={`View ${t.name}`}
                        >
                          <ArrowRight size={16} aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <Section
          title="Quick actions"
          description="Go directly to your operational tools."
          className="platform-quick-actions"
        >
          <div className="space-y-3">
            <QuickLink
              to="/platform/business-plans"
              title="Business plans"
              text="Manage platform packages and limits."
              icon={<Building2 />}
            />
            <QuickLink
              to="/platform/routers"
              title="Router fleet"
              text="Inspect devices and onboarding across tenants."
              icon={<Radio />}
            />
            <QuickLink
              to="/platform/payments"
              title="Payments"
              text="Review transactions and payment status."
              icon={<Wallet />}
            />
            <QuickLink
              to="/platform/staff"
              title="Staff access"
              text="Manage invitations and tenant service grants."
              icon={<Users />}
            />
            <QuickLink
              to="/platform/audit"
              title="Audit log"
              text="Review recorded platform activity."
              icon={<ShieldCheck />}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  title,
  text,
  icon,
}: {
  to: string;
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <Link to={to} className="platform-quick-link group">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-600 group-hover:bg-brand-100 group-hover:text-brand-700 [&>svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-950">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-500">{text}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-400 group-hover:text-brand-600" aria-hidden />
    </Link>
  );
}

/** One list of everything an admin should act on, each linking to the filtered view. */
function NeedsAttention({
  stats,
  number,
}: {
  stats: PlatformStats;
  number: (value: number | undefined) => string;
}) {
  const routersInSetup = Math.max(0, stats.routers - stats.onboarded_routers);
  const inactiveTenants = Math.max(0, stats.tenants - stats.active_tenants);
  const items = [
    stats.pending_payments > 0 && {
      key: 'pending',
      tone: 'warning' as const,
      title: `${number(stats.pending_payments)} pending`,
      text: 'Voucher payments are awaiting confirmation. Review their status before treating them as completed sales.',
      to: '/platform/payments?source=vouchers&status=pending',
      action: 'Review pending payments',
    },
    routersInSetup > 0 && {
      key: 'routers',
      tone: 'info' as const,
      title: `${number(routersInSetup)} ${routersInSetup === 1 ? 'router' : 'routers'} not yet onboarded`,
      text: 'Registered devices that have not finished VPN and RADIUS onboarding.',
      to: '/platform/routers',
      action: 'Review router onboarding',
    },
    inactiveTenants > 0 && {
      key: 'tenants',
      tone: 'neutral' as const,
      title: `${number(inactiveTenants)} inactive ${inactiveTenants === 1 ? 'tenant' : 'tenants'}`,
      text: 'Their storefronts and customer purchases are unavailable.',
      to: '/platform/tenants?is_active=false',
      action: 'View inactive tenants',
    },
  ].filter(Boolean) as {
    key: string;
    tone: 'warning' | 'info' | 'neutral';
    title: string;
    text: string;
    to: string;
    action: string;
  }[];

  if (items.length === 0) {
    return (
      <p className="platform-clear-note">
        <ShieldCheck size={16} aria-hidden />
        Nothing needs attention in the last retrieved figures.
      </p>
    );
  }
  return (
    <div role="region" aria-label="Needs attention">
      <Section title="Needs attention" description="Items to review across the platform.">
        <Card padded={false} className="divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                  <Badge tone={item.tone} size="sm" dot>
                    {item.tone === 'warning' ? 'Action' : item.tone === 'info' ? 'Setup' : 'Status'}
                  </Badge>
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">{item.text}</p>
              </div>
              <ButtonLink to={item.to} variant="secondary" size="sm">
                {item.action}
              </ButtonLink>
            </div>
          ))}
        </Card>
      </Section>
    </div>
  );
}
