import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ArrowUpRight,
  Building2,
  ExternalLink,
  Pencil,
  Power,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { PageHeader, Section, StatusBadge } from '@/components/layout';
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  CopyButton,
  DescriptionList,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { Alert, ErrorState, useToast } from '@/components/feedback';
import { NotFoundPage } from '@/app/shell/NotFoundPage';
import { isApiError } from '@/services/api/errors';
import { formatDateTime } from '@/lib/formatting/dates';
import type { Tenant } from '@/types/api';
import { useDeleteTenant, useTenant, useUpdateTenant } from '../queries';
import { TenantDialog } from '../components/TenantDialog';
import { TenantMembersPanel } from '../components/TenantMembersPanel';

type Tab = 'overview' | 'members';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'members', label: 'Members' },
];

/** `/platform/tenants/:id` — one operator: profile, activation, members and cross-links. */
export default function TenantDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const valid = Number.isInteger(id) && id > 0;
  const query = useTenant(valid ? id : null);
  const tenant = query.data;
  useEffect(() => {
    document.title = `${tenant?.name ?? 'Tenant'} · Platform · Yarotech RADIUS`;
  }, [tenant?.name]);

  if (!valid || (query.isError && isApiError(query.error) && query.error.status === 404)) {
    return (
      <NotFoundPage
        homePath="/platform/tenants"
        title="Tenant not found"
        description="It may have been deleted, or the link is wrong."
      />
    );
  }
  if (query.isError && !tenant) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        title="Could not load this tenant"
      />
    );
  }
  if (!tenant) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-96" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  return (
    <TenantDetail
      key={tenant.id}
      tenant={tenant}
      refreshing={query.isFetching}
      refreshFailed={query.isError}
      onRefresh={() => void query.refetch()}
    />
  );
}

function TenantDetail({
  tenant,
  refreshing,
  refreshFailed,
  onRefresh,
}: {
  tenant: Tenant;
  refreshing: boolean;
  refreshFailed: boolean;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'members' ? 'members' : 'overview';
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const update = useUpdateTenant();
  const remove = useDeleteTenant();

  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  const storefront = `/s/${encodeURIComponent(tenant.slug)}`;
  const storefrontUrl = new URL(storefront, window.location.origin).href;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="break-words">{tenant.name}</span>}
        backTo="/platform/tenants"
        crumbs={[{ label: 'Tenants', to: '/platform/tenants' }, { label: tenant.name }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={tenant.is_active ? 'active' : 'inactive'} size="sm" dot />
            <code className="font-mono text-xs break-all text-ink-500">{storefront}</code>
            {tenant.is_platform_admin && (
              <span className="text-xs text-ink-500">· platform tenant</span>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={refreshing}
              leadingIcon={<RefreshCw className={refreshing ? 'animate-spin' : ''} />}
              onClick={onRefresh}
            >
              Refresh tenant
            </Button>
            <ButtonLink
              to={storefront}
              target="_blank"
              rel="noreferrer"
              variant="secondary"
              trailingIcon={<ExternalLink className="h-4 w-4" aria-hidden />}
            >
              Storefront
            </ButtonLink>
            <Button
              variant="secondary"
              leadingIcon={<Pencil className="h-4 w-4" aria-hidden />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          </div>
        }
      />
      {refreshFailed && (
        <Alert tone="warning" title="Tenant could not be refreshed">
          Showing the last loaded profile. Refresh again to check for changes.
        </Alert>
      )}
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-brand-950">
                {tenant.is_platform_admin ? 'Platform workspace' : 'Operator workspace'}
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                {tenant.is_active
                  ? 'Review this workspace, manage its members and open its operational records.'
                  : 'This workspace is inactive. Review its details before restoring access.'}
              </p>
              <p className="mt-3 text-sm break-all text-brand-700">{storefrontUrl}</p>
              <CopyButton
                key={storefrontUrl}
                value={storefrontUrl}
                label="Copy storefront link"
                variant="secondary"
                className="mt-3"
              />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-6 rounded-xl border border-brand-100 bg-white p-4">
            <div>
              <dt className="text-xs text-ink-500">Members</dt>
              <dd className="mt-1 text-2xl font-semibold text-brand-950 tabular-nums">
                {tenant.member_count.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Vouchers</dt>
              <dd className="mt-1 text-2xl font-semibold text-brand-950 tabular-nums">
                {tenant.voucher_count.toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      </Card>
      <Tabs
        items={TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Tenant sections"
        className="mb-5"
      />
      {tab === 'members' ? (
        <TenantMembersPanel tenantId={tenant.id} tenantName={tenant.name} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
            <Card>
              <CardHeader
                title="Business profile"
                description="Contact details and workspace history."
              />
              <DescriptionList
                columns={2}
                items={[
                  { label: 'Business name', value: tenant.name },
                  { label: 'Slug', value: tenant.slug, mono: true },
                  { label: 'Contact email', value: tenant.email || '—' },
                  { label: 'Phone', value: tenant.phone || '—' },
                  { label: 'Address', value: tenant.address || '—', span: 2 },
                  { label: 'Created', value: formatDateTime(tenant.created_at) },
                  { label: 'Last updated', value: formatDateTime(tenant.updated_at) },
                ]}
              />
            </Card>
            <Section
              title="Activity"
              description="Tenant-scoped views across the platform console."
            >
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CrossLink
                  to={`/platform/routers?tenant=${tenant.id}`}
                  label="Routers"
                  hint="Fleet, onboarding state and health"
                />
                <CrossLink
                  to={`/platform/payments?tenant=${tenant.id}`}
                  label="Payments"
                  hint="Voucher sales, wallet top-ups, subscriptions"
                />
                <CrossLink
                  to={`/platform/staff?tenant=${tenant.id}`}
                  label="Staff access"
                  hint="Support staff assigned to this tenant"
                />
                <CrossLink
                  to={`/platform/audit?tenant=${tenant.id}`}
                  label="Audit log"
                  hint="Every recorded change in this workspace"
                />
              </ul>
            </Section>
          </div>
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader
                title="Workspace members"
                description="Review membership and manage access for this business."
              />
              <Button variant="link" size="sm" className="mt-2" onClick={() => setTab('members')}>
                Manage members
              </Button>
            </Card>
            <Card>
              <CardHeader title={tenant.is_active ? 'Deactivate' : 'Reactivate'} className="mb-2" />
              <p className="text-sm text-ink-600">
                {tenant.is_active
                  ? 'Blocks sign-in, sales and payments for this operator. Data is kept and can be restored any time.'
                  : 'Restores sign-in, sales and the public storefront for this operator.'}
              </p>
              <Button
                className="mt-3"
                variant={tenant.is_active ? 'secondary' : 'primary'}
                leadingIcon={<Power className="h-4 w-4" aria-hidden />}
                onClick={() => setToggling(true)}
                disabled={tenant.is_platform_admin && tenant.is_active}
                title={
                  tenant.is_platform_admin && tenant.is_active
                    ? 'The platform tenant cannot be deactivated from here'
                    : undefined
                }
              >
                {tenant.is_active ? 'Deactivate tenant' : 'Reactivate tenant'}
              </Button>
            </Card>
            <Card className="border-danger-200 bg-danger-50/30">
              <CardHeader title="Danger zone" className="mb-2" />
              <p className="text-sm text-ink-600">
                Deleting removes the tenant and <strong>everything in it</strong> — members,
                routers, plans, vouchers, agents and payment history. This cannot be undone.
              </p>
              {tenant.is_platform_admin ? (
                <Alert tone="warning" className="mt-3">
                  The platform's own tenant cannot be deleted.
                </Alert>
              ) : (
                <Button
                  className="mt-3"
                  variant="danger"
                  leadingIcon={<Trash2 className="h-4 w-4" aria-hidden />}
                  onClick={() => setDeleting(true)}
                >
                  Delete tenant
                </Button>
              )}
            </Card>
          </div>
        </div>
      )}

      <TenantDialog open={editing} onClose={() => setEditing(false)} tenant={tenant} />
      <ConfirmDialog
        open={toggling}
        onClose={() => setToggling(false)}
        tone={tenant.is_active ? 'danger' : 'default'}
        title={tenant.is_active ? `Deactivate ${tenant.name}?` : `Reactivate ${tenant.name}?`}
        description={
          tenant.is_active
            ? 'Members will be signed out on their next request, agents cannot sell, and the storefront will return not found.'
            : 'Members, agents and the storefront will be available again immediately.'
        }
        confirmLabel={tenant.is_active ? 'Deactivate' : 'Reactivate'}
        onConfirm={async () => {
          const next = !tenant.is_active;
          await update.mutateAsync({ id: tenant.id, payload: { is_active: next } });
          toast.success(next ? 'Tenant reactivated' : 'Tenant deactivated');
        }}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        tone="danger"
        title={`Delete ${tenant.name}?`}
        description={
          <>
            This permanently deletes the tenant, its {tenant.member_count} member
            {tenant.member_count === 1 ? '' : 's'} and {tenant.voucher_count.toLocaleString()}{' '}
            vouchers. Type <strong>{tenant.slug}</strong> to confirm.
          </>
        }
        typeToConfirm={tenant.slug}
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          await remove.mutateAsync(tenant.id);
          toast.success(`${tenant.name} deleted`);
          void navigate('/platform/tenants', { replace: true });
        }}
      />
    </div>
  );
}

function CrossLink({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <li className="min-w-0">
      <Link
        to={to}
        className="flex flex-col rounded-control border border-border bg-surface px-4 py-3 hover:border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <span className="flex items-center justify-between gap-3 text-sm font-semibold text-brand-700">
          {label}
          <ArrowUpRight className="size-4 shrink-0" aria-hidden />
        </span>
        <span className="mt-1 text-xs leading-relaxed text-ink-500">{hint}</span>
      </Link>
    </li>
  );
}
