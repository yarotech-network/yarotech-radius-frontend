import { BusinessCards } from '../components/BusinessCards';
import { NetworkCards } from '../components/NetworkCards';
import { SubscriptionSummary } from '../components/SubscriptionSummary';
import { Link } from 'react-router';
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Layers,
  Radio,
  RefreshCw,
  ShoppingBag,
  Ticket,
  Users,
} from 'lucide-react';
import { PageHeader, Section } from '@/components/layout';
import { Button, ButtonLink, Card, Stat } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { formatKobo } from '@/lib/formatting/money';
import { formatBytes, formatNumber } from '@/lib/formatting/units';
import { formatRelative } from '@/lib/formatting/dates';
import { can, workspaceName } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import { DASHBOARD_LIVE_PARAMS, useDashboardStats, useLiveUsers } from '../queries';
import { OverviewIntro } from '../components/OverviewIntro';

export default function DashboardPage() {
  const principal = usePrincipal();
  const stats = useDashboardStats();
  const canSessions = can(principal, 'sessions.view');
  const live = useLiveUsers(DASHBOARD_LIVE_PARAMS, { live: canSessions, enabled: canSessions });
  const s = stats.data;
  const name = workspaceName(principal) || principal.user.first_name || principal.user.username;
  const refreshing = stats.isFetching || (canSessions && live.isFetching);
  const latest = live.data?.users[0];
  const observed =
    s?.observed_at && Number.isFinite(Date.parse(s.observed_at))
      ? formatRelative(s.observed_at)
      : null;
  return (
    <div className="overview-page min-w-0 space-y-6">
      <PageHeader
        title={
          <>
            Welcome, <span className="text-brand-600">{name}</span>
          </>
        }
        description={
          <>Your workspace overview{observed ? ` | Figures observed ${observed}` : ''}</>
        }
        meta={<span className="overview-role">{principal.user.role.replaceAll('_', ' ')}</span>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={refreshing}
              leadingIcon={
                <RefreshCw
                  className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''}
                />
              }
              onClick={() => {
                void stats.refetch();
                if (canSessions) void live.refetch();
              }}
            >
              {refreshing ? 'Refreshing...' : 'Refresh overview'}
            </Button>
            {can(principal, 'vouchers.generate') && (
              <ButtonLink to="/vouchers/generate" leadingIcon={<Ticket />}>
                Generate vouchers
              </ButtonLink>
            )}
          </div>
        }
      />
      <OverviewIntro />
      <SubscriptionSummary />
      {s && s.paid_unfulfilled_payments > 0 && can(principal, 'payments.recovery.view') && (
        <Alert
          tone="warning"
          title={`${s.paid_unfulfilled_payments} paid ${s.paid_unfulfilled_payments === 1 ? 'order has' : 'orders have'} no voucher yet`}
          actions={
            <ButtonLink to="/payments/recovery" size="sm" variant="secondary">
              Review
            </ButtonLink>
          }
        >
          Customers have paid and still need their access code. Review delivery and the available
          recovery actions.
        </Alert>
      )}
      {stats.isError && !s ? (
        <ErrorState
          error={stats.error}
          onRetry={() => void stats.refetch()}
          title="Dashboard could not be loaded"
        />
      ) : (
        <>
          {stats.isError && s && (
            <Alert tone="warning" title="Business figures could not be refreshed">
              Showing the last observed figures. Refresh to try again.
            </Alert>
          )}
          <section aria-label="Business overview" className="overview-metrics">
            <Stat
              label="Vouchers issued"
              value={s ? formatNumber(s.total_vouchers) : '—'}
              hint="Total access codes"
              icon={<Ticket />}
              loading={stats.isPending}
              className="overview-metric overview-metric-blue"
            />
            <Stat
              label="Active vouchers"
              value={s ? formatNumber(s.active_vouchers) : '—'}
              hint={s ? `of ${formatNumber(s.total_vouchers)} issued` : 'Current voucher status'}
              icon={<Activity />}
              loading={stats.isPending}
              className="overview-metric overview-metric-green"
            />
            <Stat
              label="Routers"
              value={s ? `${formatNumber(s.active_routers)}/${formatNumber(s.total_routers)}` : '—'}
              hint="Active configuration / registered"
              icon={<Radio />}
              loading={stats.isPending}
              className="overview-metric overview-metric-purple"
            />
            <Stat
              label="Online revenue"
              value={s ? formatKobo(s.total_revenue) : '—'}
              hint="Successful online payments | All time"
              icon={<Banknote />}
              loading={stats.isPending}
              className="overview-metric overview-metric-blue"
            />
          </section>
        </>
      )}
      <BusinessCards stats={s} loading={stats.isPending} />
      <NetworkCards />
      <div className="overview-columns">
        <Card className="overview-activity" padded={false}>
          <div className="overview-panel-heading">
            <div>
              <h2>Network activity</h2>
              <p>Current sessions reported by RADIUS accounting.</p>
            </div>
            <span className="overview-source">RADIUS</span>
          </div>
          <div className="overview-panel-body">
            <Stat
              label="Online now"
              value={!canSessions ? 'n/a' : live.data ? formatNumber(live.data.count) : '—'}
              hint={
                !canSessions
                  ? 'No access'
                  : live.data
                    ? `Observed ${formatRelative(live.data.observed_at)}`
                    : live.isError
                      ? 'Currently unavailable'
                      : 'Loading live sessions'
              }
              icon={<Activity />}
              loading={canSessions && live.isPending}
              className="overview-live-count"
            />
            {canSessions && live.isError && (
              <Alert
                tone="warning"
                title="Live sessions could not be refreshed"
                actions={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void live.refetch()}
                    disabled={live.isFetching}
                  >
                    Retry live sessions
                  </Button>
                }
              >
                {live.data
                  ? 'The count above is from the last successful check.'
                  : 'The current online count is unavailable. This does not mean nobody is connected.'}
              </Alert>
            )}
            {canSessions && latest && (
              <div className="overview-session">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="overview-eyebrow">Most recent accounting session</p>
                    <p className="mt-2 font-semibold break-words text-ink-900">{latest.username}</p>
                    <p className="mt-1 text-xs break-words text-ink-500">
                      {latest.router_name || 'Router name unavailable'}
                    </p>
                  </div>
                </div>
                <div className="overview-session-counters">
                  <div>
                    <span>
                      <ArrowDownLeft className="size-4" aria-hidden /> Download
                    </span>
                    <strong>{formatBytes(latest.bytes_out)}</strong>
                  </div>
                  <div>
                    <span>
                      <ArrowUpRight className="size-4" aria-hidden /> Upload
                    </span>
                    <strong>{formatBytes(latest.bytes_in)}</strong>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-ink-500">
                  Cumulative data for this session only. These values are not current bandwidth
                  rates.
                </p>
              </div>
            )}
            {canSessions && live.data?.count === 0 && !live.isError && (
              <div className="overview-network-empty">
                <Radio className="size-8 text-brand-400" aria-hidden />
                <h3>No active sessions reported</h3>
                <p>Connections appear here when your routers send RADIUS accounting records.</p>
              </div>
            )}
            {canSessions ? (
              <ButtonLink to="/sessions" variant="secondary" trailingIcon={<ArrowRight />}>
                View live sessions
              </ButtonLink>
            ) : (
              <p className="text-sm text-ink-500">
                Your account does not have access to live sessions in this workspace.
              </p>
            )}
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="overview-quick" padded={false}>
            <div className="overview-panel-heading">
              <div>
                <h2>Quick deployment</h2>
                <p>Your everyday workspace tools.</p>
              </div>
            </div>
            <div className="overview-quick-links">
              {can(principal, 'payments.view') && (
                <QuickLink
                  to="/payments"
                  icon={<Banknote />}
                  title="Review payments"
                  description="Check customer payment status."
                />
              )}

              {can(principal, 'routers.manage') && (
                <QuickLink
                  to="/routers/new"
                  icon={<Radio />}
                  title="Attach a router"
                  description="Register a MikroTik device."
                />
              )}
              {can(principal, 'plans.view') && (
                <QuickLink
                  to="/plans"
                  icon={<Layers />}
                  title="Internet plans"
                  description="Review prices, speeds and durations."
                />
              )}
              {can(principal, 'vouchers.view') && (
                <QuickLink
                  to="/vouchers"
                  icon={<Ticket />}
                  title="Vouchers"
                  description="Find access codes and check status."
                />
              )}
              {can(principal, 'settings.profile') && (
                <QuickLink
                  to="/storefront"
                  icon={<ShoppingBag />}
                  title="Manage storefront"
                  description="Share your customer link and plans."
                />
              )}
            </div>
          </Card>
          <Card className="overview-summary">
            <p className="overview-eyebrow">Workspace activity</p>
            <dl>
              <div>
                <dt>
                  <Users className="size-4" aria-hidden /> Agents
                </dt>
                <dd>{s ? formatNumber(s.total_agents) : '—'}</dd>
              </div>
              <div>
                <dt>
                  <AlertTriangle className="size-4" aria-hidden /> Payment confirmation queue
                </dt>
                <dd>{s ? formatNumber(s.pending_payments) : '—'}</dd>
              </div>
            </dl>
            <p className="text-xs text-ink-500">Pending payments are awaiting confirmation.</p>
          </Card>
        </div>
      </div>
      <Section title="Workspace shortcuts" description="Open the tools available to your role.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {can(principal, 'routers.view') && (
            <QuickLink
              to="/routers"
              icon={<Radio />}
              title="Routers"
              description="Inspect registered devices and connection details."
            />
          )}
          {can(principal, 'agents.manage') && (
            <QuickLink
              to="/agents"
              icon={<Users />}
              title="Agents"
              description="Manage the resellers serving your customers."
            />
          )}
          {can(principal, 'payments.view') && (
            <QuickLink
              to="/payments"
              icon={<Banknote />}
              title="Payments"
              description="Track transactions and payment status."
            />
          )}
        </div>
      </Section>
    </div>
  );
}
function QuickLink({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} aria-label={title} className="overview-quick-link">
      <span className="overview-link-icon">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-950">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-500">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-400" aria-hidden />
    </Link>
  );
}
