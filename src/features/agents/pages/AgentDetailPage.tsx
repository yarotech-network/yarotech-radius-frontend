import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CheckCircle2, PauseCircle, Pencil, Phone, RefreshCw, Store, Ticket } from 'lucide-react';
import { KpiTile, PageHeader, StatusBadge } from '@/components/layout';
import { Button, Card, ConfirmDialog, DescriptionList, Skeleton, Tabs } from '@/components/ui';
import { Alert, EmptyState, QueryBoundary, useToast } from '@/components/feedback';
import { DataTable, Pagination, type Column } from '@/components/data';
import { formatDate, formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { formatKobo } from '@/lib/formatting/money';
import { cn } from '@/lib/utilities/cn';
import type { AgentProfile, Voucher } from '@/types/api';
import { useVouchers } from '@/features/vouchers/queries';
import { useAgent, useApproveAgent, useSuspendAgent } from '../queries';
import { AGENT_STATUS_LABELS, canApprove, canSuspend } from '../agentRules';
import { formatCommission, initials } from '../agentSchemas';
import { EditAgentDialog } from '../components/AgentForms';
import { AgentCreditPanel } from '../components/AgentCreditPanel';
import { usePrincipal } from '@/app/auth/useAuth';

type Tab = 'overview' | 'sales' | 'credit';

export default function AgentDetailPage() {
  const { id = '' } = useParams();
  const query = useAgent(Number(id));
  return (
    <QueryBoundary
      query={query}
      errorTitle="Could not load agent"
      skeleton={
        <>
          <PageHeader title={<Skeleton className="h-7 w-48" />} backTo="/agents" />
          <Card>
            <Skeleton className="h-32 w-full" />
          </Card>
        </>
      }
    >
      {(agent) => (
        <AgentDetail
          key={agent.id}
          agent={agent}
          refreshing={query.isFetching}
          refreshFailed={query.isError}
          onRefresh={() => void query.refetch()}
        />
      )}
    </QueryBoundary>
  );
}

function AgentDetail({
  agent,
  refreshing,
  refreshFailed,
  onRefresh,
}: {
  agent: AgentProfile;
  refreshing: boolean;
  refreshFailed: boolean;
  onRefresh: () => void;
}) {
  useEffect(() => {
    document.title = `${agent.username} - Agents - Yarotech RADIUS`;
  }, [agent.username]);
  const toast = useToast();
  const principal = usePrincipal();
  const canManageCredit = principal.kind === 'member' && principal.role === 'owner';
  const approve = useApproveAgent();
  const suspend = useSuspendAgent();
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<'approve' | 'suspend' | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/agents"
        crumbs={[{ label: 'Agents', to: '/agents' }, { label: agent.username }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="break-all">{agent.username}</span>
            <StatusBadge status={agent.status} size="md" />
          </span>
        }
        description={agent.shop_name || 'No shop name'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={onRefresh}
              disabled={refreshing}
              leadingIcon={
                <RefreshCw
                  className={
                    refreshing ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'
                  }
                  aria-hidden
                />
              }
            >
              Refresh agent
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<Pencil className="size-4" aria-hidden />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            {canApprove(agent.status) && (
              <Button
                leadingIcon={<CheckCircle2 className="size-4" aria-hidden />}
                onClick={() => setConfirm('approve')}
              >
                {agent.status === 'suspended' ? 'Re-activate' : 'Approve'}
              </Button>
            )}
            {canSuspend(agent.status) && (
              <Button
                variant="danger"
                leadingIcon={<PauseCircle className="size-4" aria-hidden />}
                onClick={() => setConfirm('suspend')}
              >
                Suspend
              </Button>
            )}
          </div>
        }
      />

      {refreshFailed && (
        <Alert tone="warning" title="Agent could not be refreshed">
          Showing the last loaded profile and wallet balance. Refresh again to check for changes.
        </Alert>
      )}
      {agent.status === 'pending' && (
        <Alert tone="info" title="Awaiting approval">
          This agent cannot sign in to the agent portal or sell vouchers until you approve them.
        </Alert>
      )}
      {agent.status === 'suspended' && (
        <Alert tone="warning" title="Suspended">
          The agent is locked out of the portal. Their wallet balance is kept.
        </Alert>
      )}

      <section aria-label="Agent summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile
          label="Wallet balance"
          value={agent.wallet_balance === null ? 'Unavailable' : formatKobo(agent.wallet_balance)}
          detail="Prepaid credit for voucher sales"
        />
        <KpiTile
          label="Commission"
          value={`${formatCommission(agent.commission_rate)}%`}
          detail="Earned on each voucher sold"
        />
        <KpiTile
          label="Portal access"
          value={agent.status === 'active' ? 'Can sell' : 'Blocked'}
          detail={
            agent.status === 'active'
              ? 'Signs in and sells from their wallet'
              : agent.status === 'pending'
                ? 'Approve to let them sign in'
                : 'Re-activate to restore access'
          }
          extra={
            <span
              aria-hidden
              className={cn(
                'block h-1 rounded-full',
                agent.status === 'active'
                  ? 'bg-success-600'
                  : agent.status === 'pending'
                    ? 'bg-warning-600'
                    : 'bg-ink-300',
              )}
            />
          }
        />
        <KpiTile
          label="Member since"
          value={formatDate(agent.created_at)}
          detail={`Joined ${formatRelative(agent.created_at)}`}
        />
      </section>

      <Card padded={false} className="space-y-4 p-4 md:p-5">
        <Tabs
          items={[
            { value: 'overview', label: 'Profile' },
            { value: 'sales', label: 'Vouchers sold' },
            ...(canManageCredit ? [{ value: 'credit' as const, label: 'Credit' }] : []),
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="Agent sections"
        />
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-surface-muted p-4">
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-base font-semibold text-white"
              >
                {initials(agent.shop_name || agent.username)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink-900">
                  {agent.shop_name || agent.username}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5" aria-hidden />
                    <span className="font-mono">{agent.phone || '—'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Store className="size-3.5" aria-hidden />
                    {agent.shop_name ? `@${agent.username}` : 'No shop name yet'}
                  </span>
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Pencil className="size-4" aria-hidden />}
                onClick={() => setEditing(true)}
              >
                Edit profile
              </Button>
            </div>
            <DescriptionList
              columns={2}
              items={[
                { label: 'Username', value: agent.username, mono: true },
                { label: 'Phone', value: agent.phone, mono: true },
                { label: 'Shop name', value: agent.shop_name || null },
                { label: 'Status', value: AGENT_STATUS_LABELS[agent.status] },
                { label: 'Commission rate', value: `${formatCommission(agent.commission_rate)}%` },
                {
                  label: 'Wallet',
                  value:
                    agent.wallet_balance === null
                      ? 'Unavailable'
                      : formatKobo(agent.wallet_balance),
                },
                { label: 'Joined', value: formatDateTime(agent.created_at) },
              ]}
            />
          </div>
        )}
        {tab === 'sales' && <AgentSales agent={agent} />}
        {tab === 'credit' && canManageCredit && <AgentCreditPanel agent={agent} />}
      </Card>

      <EditAgentDialog
        agent={agent}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          toast.success('Agent updated', `${saved.username} saved.`);
        }}
      />
      <ConfirmDialog
        open={
          confirm === 'approve'
            ? canApprove(agent.status)
            : confirm === 'suspend' && canSuspend(agent.status)
        }
        onClose={() => setConfirm(null)}
        tone={confirm === 'suspend' ? 'danger' : 'default'}
        title={
          confirm === 'suspend'
            ? `Suspend ${agent.username}?`
            : `${agent.status === 'suspended' ? 'Re-activate' : 'Approve'} ${agent.username}?`
        }
        description={
          confirm === 'suspend'
            ? 'The agent is signed out of the portal and cannot sell vouchers until re-activated. Wallet funds are kept.'
            : 'Review the phone, shop name and commission shown above before approving. Once approved, the agent can sign in, fund their wallet and sell vouchers.'
        }
        confirmLabel={
          confirm === 'suspend'
            ? 'Suspend agent'
            : agent.status === 'suspended'
              ? 'Re-activate agent'
              : 'Approve agent'
        }
        onConfirm={async () => {
          if (
            !confirm ||
            (confirm === 'approve' && !canApprove(agent.status)) ||
            (confirm === 'suspend' && !canSuspend(agent.status))
          )
            return;
          const result =
            confirm === 'suspend'
              ? await suspend.mutateAsync(agent.id)
              : await approve.mutateAsync(agent.id);
          toast.success(`Agent ${AGENT_STATUS_LABELS[result.status].toLowerCase()}`);
        }}
      />
    </div>
  );
}

/** Server-filtered voucher history for this agent, including accurate page totals. */
function AgentSales({ agent }: { agent: AgentProfile }) {
  const [page, setPage] = useState(1);
  const query = useVouchers({
    agent: agent.id,
    page,
    page_size: 20,
    ordering: '-created_at',
  });
  const columns: Column<Voucher>[] = [
    {
      key: 'code',
      header: 'Voucher',
      primary: true,
      cell: (v) => (
        <Link
          to={`/vouchers/${v.id}`}
          className="dashboard-data-link font-mono text-sm font-semibold break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {v.username}
        </Link>
      ),
    },
    { key: 'plan', header: 'Plan', cell: (v) => v.plan_name },
    { key: 'status', header: 'Status', cell: (v) => <StatusBadge status={v.status} size="sm" /> },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      hideBelow: 'md',
      cell: (v) => <span className="tabular-nums">{v.price_display}</span>,
    },
    {
      key: 'created',
      header: 'Generated',
      hideBelow: 'lg',
      cell: (v) => (
        <time dateTime={v.created_at} title={formatDateTime(v.created_at)}>
          {formatDateTime(v.created_at)}
        </time>
      ),
    },
  ];
  const rows = query.data?.results;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Voucher history</h2>
          <p role="status" className="mt-1 text-sm text-ink-600">
            {query.isPlaceholderData
              ? 'Updating results…'
              : query.data
                ? `${query.data.count} vouchers generated by this agent`
                : query.isError
                  ? 'Voucher count unavailable'
                  : 'Loading vouchers…'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          leadingIcon={<RefreshCw className="size-4" aria-hidden />}
        >
          Refresh vouchers
        </Button>
      </div>
      {query.isError && query.data && (
        <Alert tone="warning" title="Voucher history could not be refreshed">
          Showing the last loaded vouchers. Refresh again to check for changes.
        </Alert>
      )}
      <DataTable
        caption="Vouchers sold"
        columns={columns}
        rows={rows}
        rowKey={(v) => v.id}
        loading={query.isPending}
        refreshing={query.isFetching && !query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        dense
        empty={
          <EmptyState
            compact
            icon={<Ticket className="size-6" aria-hidden />}
            title="No sales yet"
            description="Vouchers the agent generates will be listed here."
          />
        }
      />
      {query.data && query.data.total_pages > 1 && (
        <Pagination
          count={query.data.count}
          page={query.data.current_page}
          totalPages={query.data.total_pages}
          pageSize={20}
          onPageChange={setPage}
          itemLabel="vouchers"
        />
      )}
    </div>
  );
}
