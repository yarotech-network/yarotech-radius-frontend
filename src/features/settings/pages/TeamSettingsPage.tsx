import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  FormField,
  Input,
  Select,
} from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import { DataTable, FilterBar, Pagination, useListParams, type Column } from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { formatDate, formatDateTime } from '@/lib/formatting/dates';
import { errorMessage } from '@/services/api/errors';
import { can } from '@/services/auth/principal';
import type { MembershipRole, TenantMembership } from '@/types/api';
import type { MembershipListParams } from '../api';
import { useAddMember, useChangeRole, useMemberships, useRemoveMember } from '../queries';
import {
  ROLE_OPTIONS,
  addMemberSchema,
  addMemberToPayload,
  type AddMemberInput,
  type AddMemberOutput,
} from '../settingsSchemas';

const FILTERS = ['role'] as const;

function initialsOf(display: string): string {
  const parts = display
    .replace(/[<>()]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (
    (
      (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
    ).toUpperCase() || '?'
  );
}
const ROLE_TONE: Record<MembershipRole, 'brand' | 'info' | 'neutral'> = {
  owner: 'brand',
  manager: 'info',
  staff: 'neutral',
};

export default function TeamSettingsPage() {
  useEffect(() => {
    document.title = 'Team settings | Yarotech RADIUS';
  }, []);
  const principal = usePrincipal();
  const canManage = can(principal, 'team.manage');
  const toast = useToast();
  const list = useListParams(FILTERS);
  const params = useMemo<MembershipListParams>(() => {
    const p: MembershipListParams = { page: list.state.page, page_size: list.state.page_size };
    if (list.state.filters.role) p.role = list.state.filters.role as MembershipRole;
    return p;
  }, [list.state]);
  const query = useMemberships(params);
  const changeRole = useChangeRole();
  const remove = useRemoveMember();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<TenantMembership | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const owners = query.data?.results.filter((m) => m.role === 'owner').length ?? 0;

  async function onRoleChange(member: TenantMembership, role: MembershipRole) {
    if (!canManage || changeRole.isPending || remove.isPending) return;
    setActionError(null);
    try {
      await changeRole.mutateAsync({ id: member.id, role });
      toast.success(`${member.user_display} is now ${role}`);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  async function onRemove() {
    if (!removing || !canManage) return;
    // ConfirmDialog surfaces thrown errors inline (e.g. "The final tenant owner cannot be removed.").
    await remove.mutateAsync(removing.id);
    toast.success(`${removing.user_display} removed from the team`);
  }

  const columns: Column<TenantMembership>[] = [
    {
      key: 'user',
      header: 'Member',
      primary: true,
      cell: (m) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar initials={initialsOf(m.user_display)} size="sm" />
          <div className="min-w-0">
            <div className="font-medium break-all text-ink-900">
              {m.user_display}
              {m.user === principal?.user.id && (
                <span className="ml-2 text-xs font-normal text-ink-500">(you)</span>
              )}
            </div>
            <div className="text-xs text-ink-500">User #{m.user}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (m) =>
        canManage ? (
          <Select
            aria-label={`Role for ${m.user_display}`}
            size="sm"
            className="max-w-36"
            value={m.role}
            disabled={
              changeRole.isPending ||
              remove.isPending ||
              query.isPlaceholderData ||
              (m.role === 'owner' && owners <= 1)
            }
            title={
              m.role === 'owner' && owners <= 1 ? 'A workspace needs at least one owner' : undefined
            }
            onChange={(e) => void onRoleChange(m, e.target.value as MembershipRole)}
            options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
          />
        ) : (
          <Badge tone={ROLE_TONE[m.role]} size="sm" className="capitalize">
            {m.role}
          </Badge>
        ),
    },
    {
      key: 'since',
      header: 'Member since',
      hideBelow: 'md',
      cell: (m) => (
        <time dateTime={m.created_at} title={formatDateTime(m.created_at)} className="text-ink-600">
          {formatDate(m.created_at)}
        </time>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Users className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-950">
              The people behind your business
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              {canManage
                ? 'Give each person the access they need. Review memberships, assign roles and remove access when responsibilities change.'
                : 'Review the people in your workspace and what each role can do. Ask a workspace owner to make membership changes.'}
            </p>
          </div>
        </div>
        <details className="mt-5 border-t border-brand-100 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-800">
            Understand team roles
          </summary>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            {ROLE_OPTIONS.map((role) => (
              <div key={role.value} className="rounded-xl border border-brand-100 bg-white p-3">
                <dt className="font-semibold text-brand-950">{role.label}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-ink-600">{role.description}</dd>
              </div>
            ))}
          </dl>
        </details>
      </Card>
      <section aria-labelledby="team-directory-title" className="space-y-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="team-directory-title" className="text-lg font-semibold text-brand-950">
              Team members
            </h2>
            <p className="text-sm text-ink-500">
              {canManage
                ? 'Owners manage the team; managers run day-to-day operations; staff sell and print vouchers.'
                : 'People with access to this workspace. Ask an owner to change roles.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
              leadingIcon={
                <RefreshCw
                  className={query.isFetching ? 'size-4 animate-spin' : 'size-4'}
                  aria-hidden
                />
              }
            >
              Refresh team
            </Button>
            {canManage && (
              <Button
                leadingIcon={<UserPlus className="h-4 w-4" aria-hidden />}
                onClick={() => setAdding(true)}
              >
                Add member
              </Button>
            )}
          </div>
        </div>
        <p role="status" className="text-sm text-ink-500">
          {query.isPlaceholderData
            ? 'Updating members...'
            : query.data
              ? `${query.data.count} matching ${query.data.count === 1 ? 'member' : 'members'}`
              : 'Team directory'}
        </p>
        {actionError && (
          <Alert tone="danger" className="mb-4" onDismiss={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}
        <FilterBar
          inline
          filters={
            <Select
              aria-label="Role"
              size="sm"
              value={list.state.filters.role ?? ''}
              onChange={(e) => list.setFilter('role', e.target.value || undefined)}
              options={[
                { value: '', label: 'All roles' },
                ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label })),
              ]}
            />
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
        {query.isError && query.data && (
          <Alert tone="warning" title="Team could not be refreshed">
            Showing the last loaded members. Refresh to try again.
          </Alert>
        )}
        <DataTable
          caption="Team members"
          columns={columns}
          rows={query.data?.results}
          rowKey={(m) => m.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.data ? null : query.error}
          onRetry={() => void query.refetch()}
          {...(canManage
            ? {
                rowActions: (m: TenantMembership) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${m.user_display}`}
                    title={
                      m.role === 'owner' && owners <= 1
                        ? 'The last owner cannot be removed'
                        : 'Remove from team'
                    }
                    disabled={
                      remove.isPending ||
                      changeRole.isPending ||
                      query.isPlaceholderData ||
                      (m.role === 'owner' && owners <= 1)
                    }
                    onClick={() => setRemoving(m)}
                    leadingIcon={<Trash2 className="h-4 w-4" aria-hidden />}
                  />
                ),
              }
            : {})}
          empty={
            list.activeFilterCount > 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6" aria-hidden />}
                title="No members with this role"
                action={
                  <Button variant="secondary" onClick={list.clearFilters}>
                    Show everyone
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users className="h-6 w-6" aria-hidden />}
                title="No team members"
              />
            )
          }
        />
        {query.data && query.data.count > 0 && (
          <Pagination
            count={query.data.count}
            page={list.state.page}
            totalPages={query.data.total_pages}
            pageSize={list.state.page_size}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            itemLabel="members"
          />
        )}
      </section>
      {canManage && principal?.kind === 'member' && (
        <AddMemberDialog
          open={adding}
          onClose={() => setAdding(false)}
          tenantId={principal.tenantId}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={onRemove}
        tone="danger"
        title={`Remove ${removing?.user_display ?? 'member'}?`}
        description="They lose access to this workspace immediately. Their account is not deleted and they can be added again later."
        confirmLabel="Remove"
      />
    </div>
  );
}

const ADD_FIELDS = ['user', 'role'] as const;

/** The API reports both "already a member somewhere" and "no such user" as `user` field errors. */
function friendlyMemberError(message: string | undefined): string | undefined {
  if (!message) return undefined;
  if (message.includes('already exists'))
    return 'That user already belongs to a workspace. Each account can be in one workspace at a time.';
  if (message.includes('does not exist')) return 'No account with that user ID.';
  return message;
}

function AddMemberDialog({
  open,
  onClose,
  tenantId,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: number;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add team member"
      description="Ask the person for the user ID shown under Settings → General → Your account. They need an existing account that is not already in a workspace."
    >
      {open && <AddMemberForm key={tenantId} onClose={onClose} tenantId={tenantId} />}
    </Dialog>
  );
}

function AddMemberForm({ onClose, tenantId }: { onClose: () => void; tenantId: number }) {
  const toast = useToast();
  const add = useAddMember();
  const form = useForm<AddMemberInput, unknown, AddMemberOutput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { user: '' as unknown as number, role: 'staff' },
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, ADD_FIELDS);
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    try {
      const member = await add.mutateAsync(addMemberToPayload(values, tenantId));
      toast.success(`${member.user_display} added as ${member.role}`);
      onClose();
    } catch (error) {
      captureError(error);
    }
  });
  const role = useWatch({ control: form.control, name: 'role' });
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      {message && <Alert tone="danger">{friendlyMemberError(message)}</Alert>}
      <fieldset disabled={add.isPending} className="flex min-w-0 flex-col gap-4">
        <legend className="sr-only">Member identity and permissions</legend>
        <FormField
          label="User ID"
          hint="Use the numeric ID from their account settings, not their email address."
          required
          error={friendlyMemberError(errors.user?.message)}
        >
          <Input
            autoFocus
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="e.g. 42"
            {...form.register('user')}
          />
        </FormField>
        <FormField
          label="Role"
          required
          error={errors.role?.message}
          hint={ROLE_OPTIONS.find((r) => r.value === role)?.description}
        >
          <Select
            {...form.register('role')}
            options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
          />
        </FormField>
      </fieldset>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={add.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={add.isPending}>
          Add member
        </Button>
      </div>
    </form>
  );
}
