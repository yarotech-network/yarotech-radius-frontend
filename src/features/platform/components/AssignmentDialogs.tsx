import { useState, type FormEvent } from 'react';
import { Alert, useToast } from '@/components/feedback';
import { Button, Dialog, FormField, Input } from '@/components/ui';
import { errorMessage } from '@/services/api/errors';
import type { StaffAssignment } from '@/types/api';
import { useCreateAssignment, useUpdateAssignment, useTenantName, useStaffAccounts } from '../queries';
import { TenantSelect } from './TenantSelect';

export function NewAssignmentDialog({ open, onClose, defaultTenant }: {
  open: boolean; onClose: () => void; defaultTenant?: number | undefined;
}) {
  const create = useCreateAssignment();
  const toast = useToast();
  const [user, setUser] = useState('');
  const [search, setSearch] = useState('');
  const officers = useStaffAccounts({ status: 'ready', search, page_size: 100 }, open);
  const [tenant, setTenant] = useState(String(defaultTenant ?? ''));
  const [primary, setPrimary] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!Number.isSafeInteger(Number(user)) || Number(user) <= 0 || !Number(tenant)) {
      setError('Choose a staff account and tenant.'); return;
    }
    try {
      await create.mutateAsync({ payload: { user: Number(user), tenant: Number(tenant),
        is_primary: primary }, idempotencyKey: crypto.randomUUID() });
      toast.success('Account officer assigned'); onClose();
    } catch (cause) { setError(errorMessage(cause)); }
  }
  return <Dialog open={open} onClose={onClose} title="Assign account officer"
    description="The same support role applies to every assigned tenant. Only the platform admin can change assignments.">
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <FormField label="Find account officer" hint="Search by username or verified work email.">
        <Input value={search} onChange={(event) => { setSearch(event.target.value); setUser(''); }} />
      </FormField>
      <FormField label="Ready account officer" required>
        <select className="w-full rounded-control border border-border bg-surface p-2 text-ink-900"
          value={user} onChange={(event) => setUser(event.target.value)} disabled={officers.isFetching || officers.isError}>
          <option value="">Choose an officer</option>
          {officers.data?.results.map((account) => <option key={account.id} value={account.user_id}>
            {account.username} ({account.email})
          </option>)}
        </select>
      </FormField>
      {officers.isPending && <p role="status">Loading ready officers…</p>}
      {officers.isError && <p role="alert">Could not load officers. <button type="button" onClick={() => void officers.refetch()}>Retry</button></p>}
      {officers.data?.count === 0 && <p>No ready officers match. Create an officer and complete activation first.</p>}
      {(officers.data?.count ?? 0) > (officers.data?.results.length ?? 0) && <p className="text-sm text-ink-500">Search to find officers beyond the first page.</p>}
      <FormField label="Tenant" required><TenantSelect value={tenant} onChange={setTenant} /></FormField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={primary} onChange={(event) => setPrimary(event.target.checked)} /> Make primary tenant contact</label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={create.isPending}>Assign</Button></div>
    </form>
  </Dialog>;
}

export function EditGrantsDialog({ assignment, onClose }: { assignment: StaffAssignment | null; onClose: () => void }) {
  const tenantName = useTenantName();
  return <Dialog open={assignment !== null} onClose={onClose} title="Edit account officer"
    description={assignment ? `${assignment.user_display || 'Account officer'} · ${tenantName(assignment.tenant)}` : undefined}>
    {assignment && <AssignmentEditor key={assignment.id} assignment={assignment} onClose={onClose} />}
  </Dialog>;
}

function AssignmentEditor({ assignment, onClose }: { assignment: StaffAssignment; onClose: () => void }) {
  const update = useUpdateAssignment();
  const toast = useToast();
  const [active, setActive] = useState(assignment.is_active);
  const [primary, setPrimary] = useState(Boolean(assignment.is_primary));
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      await update.mutateAsync({ id: assignment.id, payload: {
        is_active: active, is_primary: primary && active,
      } });
      toast.success('Account officer updated'); onClose();
    } catch (cause) { setError(errorMessage(cause)); }
  }
  return <form onSubmit={(event) => void submit(event)} className="space-y-4">
    {error && <Alert tone="danger">{error}</Alert>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active assignment</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={primary} disabled={!active} onChange={(event) => setPrimary(event.target.checked)} /> Primary tenant contact</label>
    <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={update.isPending}>Save</Button></div>
  </form>;
}
