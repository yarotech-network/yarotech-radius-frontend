import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CheckCircle2, PauseCircle, Pencil, RefreshCw, Store, Ticket } from 'lucide-react';
import { PageHeader, StatusBadge } from '@/components/layout';
import {
  Button,
  Card,
  ConfirmDialog,
  DescriptionList,
  Skeleton,
  Stat,
  Tabs,
} from '@/components/ui';
import { Alert, EmptyState, QueryBoundary, useToast } from '@/components/feedback';
import { DataTable, Pagination, type Column } from '@/components/data';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { formatKobo } from '@/lib/formatting/money';
import type { AgentProfile, Voucher } from '@/types/api';
import { useVouchers } from '@/features/vouchers/queries';
import { useAgent, useApproveAgent, useSuspendAgent } from '../queries';
import { AGENT_STATUS_LABELS, canApprove, canSuspend } from '../agentRules';
import { formatCommission } from '../agentSchemas';
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
                <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
              }
            >
              Refresh agent
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<Pencil className="h-4 w-4" aria-hidden />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            {canApprove(agent.status) && (
              <Button
                leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                onClick={() => setConfirm('approve')}
              >
                {agent.status === 'suspended' ? 'Re-activate' : 'Approve'}
              </Button>
            )}
            {canSuspend(agent.status) && (
              <Button
                variant="danger"
                leadingIcon={<PauseCircle className="h-4 w-4" aria-hidden />}
                onClick={() => setConfirm('suspend')}
              >
                Suspend
              </Button>
            )}
          </div>
        }
      />

      <Card className="router-page-hero border-brand-100 dark:border-slate-800 bg-gradient-to-br from-brand-50 via-white to-sky-50 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/40 p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 dark:bg-brand-500 text-white shadow-md shadow-brand-500/20">
            <Store className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-brand-950 dark:text-slate-100">Reseller Account Overview</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-slate-400">
              Review this agent's profile, prepaid wallet balance, and commission rate. Monitor real-time voucher sales and credit transaction history below.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-100/60 dark:bg-slate-800/80 px-3 py-1 text-xs font-medium text-brand-800 dark:text-brand-300">
              <span>Member since {formatDateTime(agent.created_at)}</span>
              <span>•</span>
              <span>Status updates directly affect agent portal access</span>
            </div>
          </div>
        </div>
      </Card>
      {refreshFailed && (
        <Alert tone="warning" title="Agent could not be refreshed">
          Showing the last loaded profile and wallet balance. Refresh again to check for changes.
        </Alert>
      )}
      {agent.status === 'pending' && (
        <Alert tone="info" className="mb-4" title="Awaiting approval">
          This agent cannot sign in to the agent portal until you approve them.
        </Alert>
      )}
      {agent.status === 'suspended' && (
        <Alert tone="warning" className="mb-4" title="Suspended">
          The agent is locked out of the portal. Their wallet balance is preserved.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all hover:shadow-md">
          <Stat
            label="Wallet Balance"
            value={agent.wallet_balance === null ? 'Unavailable' : formatKobo(agent.wallet_balance)}
            hint="Prepaid credit for voucher sales"
          />
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all hover:shadow-md">
          <Stat
            label="Commission Rate"
            value={`${formatCommission(agent.commission_rate)}%`}
            hint="Percentage earned per voucher sold"
          />
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all hover:shadow-md">
          <Stat
            label="Account Status"
            value={AGENT_STATUS_LABELS[agent.status]}
            hint={`Joined ${formatRelative(agent.created_at)}`}
          />
        </div>
      </div>

      <div className="overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2">
        <Tabs
          items={[
            { value: 'overview', label: 'Profile Details' },
            { value: 'sales', label: 'Vouchers Sold' },
            ...(canManageCredit ? [{ value: 'credit' as const, label: 'Credit Management' }] : []),
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="Agent sections"
        />
      </div>
      <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        {tab === 'overview' && (
          <DescriptionList
            columns={2}
            items={[
              { label: 'Username', value: agent.username, mono: true },
              { label: 'Phone', value: agent.phone, mono: true },
              { label: 'Shop name', value: agent.shop_name || null },
              { label: 'Commission rate', value: `${formatCommission(agent.commission_rate)}%` },
              { label: 'Joined', value: formatDateTime(agent.created_at) },
              {
                label: 'Wallet',
                value:
                  agent.wallet_balance === null ? 'Unavailable' : formatKobo(agent.wallet_balance),
              },
            ]}
          />
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
            : 'The agent can sign in to the agent portal, fund their wallet and sell vouchers.'
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
          className="font-mono text-sm font-semibold break-all text-brand-700 hover:underline"
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
          {formatRelative(v.created_at)}
        </time>
      ),
    },
  ];
  const rows = query.data?.results;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-950">Voucher history</h2>
          <p role="status" className="mt-1 text-sm text-ink-600">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} vouchers generated by this agent`
                : query.isError
                  ? 'Voucher count unavailable'
                  : 'Loading vouchers...'}
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
            icon={<Ticket className="h-6 w-6" aria-hidden />}
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
