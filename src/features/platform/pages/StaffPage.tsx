import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Plus, RefreshCw, ShieldOff, Users } from 'lucide-react';
import { DataTable, Pagination, type Column } from '@/components/data';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import { Button, ConfirmDialog, Dialog, FormField, Input, Tabs } from '@/components/ui';
import { errorMessage } from '@/services/api/errors';
import type { StaffAccount, StaffAssignment } from '@/types/api';
import { platformApi } from '../api';
import { useAssignments, useRevokeAssignment, useResendStaffSetup, useStaffAccounts,
  useSuspendStaffAccount, useTenantName } from '../queries';
import { InviteDialog } from '../components/InviteDialog';
import { NewAssignmentDialog, EditGrantsDialog } from '../components/AssignmentDialogs';
import { TenantSelect } from '../components/TenantSelect';
import '../staff-access.css';

type View = 'officers' | 'assignments';
const VIEWS = [{ value: 'officers', label: 'Account officers' }, { value: 'assignments', label: 'Tenant assignments' }] as const;

export default function StaffPage() {
  const [view, setView] = useState<View>('officers');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tenant, setTenant] = useState('');
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState<StaffAssignment | null>(null);
  const [revoking, setRevoking] = useState<StaffAssignment | null>(null);
  const [resending, setResending] = useState<StaffAccount | null>(null);
  const [suspending, setSuspending] = useState<StaffAccount | null>(null);
  const toast = useToast();
  const tenantName = useTenantName();
  const revoke = useRevokeAssignment();
  const suspend = useSuspendStaffAccount();
  const officers = useStaffAccounts({ search, status, page, page_size: pageSize }, view === 'officers');
  const assignments = useAssignments({ page, page_size: pageSize, ...(tenant ? { tenant: Number(tenant) } : {}) });
  const active = view === 'officers' ? officers : assignments;
  const requests = useQuery({ queryKey: ['platform', 'officer-change-requests'], queryFn: platformApi.officerChangeRequests });
  useEffect(() => { document.title = 'Account officers · Platform · Yarotech RADIUS'; }, []);
  const officerColumns: Column<StaffAccount>[] = [
    { key: 'name', header: 'Account officer', primary: true, cell: (row) => <div><strong>{row.username}</strong><div className="text-sm text-ink-500">{row.email}</div></div> },
    { key: 'phone', header: 'Phone', cell: (row) => row.phone },
    { key: 'status', header: 'Status', cell: (row) => row.status === 'active' ? 'Ready' : row.status === 'pending' ? 'Pending setup' : 'Suspended' },
    { key: 'delivery', header: 'Setup email', cell: (row) => row.delivery_status === 'accepted' ? 'Accepted by provider' : row.delivery_status === 'failed' ? 'Failed' : row.delivery_status === 'historical' ? 'Existing account' : 'Pending' },
  ];
  const assignmentColumns: Column<StaffAssignment>[] = [
    { key: 'officer', header: 'Account officer', primary: true, cell: (row) => row.user_display || 'Account officer' },
    { key: 'tenant', header: 'Tenant', cell: (row) => <Link className="dashboard-data-link" to={`/platform/tenants/${row.tenant}`}>{tenantName(row.tenant)}</Link> },
    { key: 'primary', header: 'Contact', cell: (row) => row.is_primary ? 'Primary officer' : 'Account officer' },
    { key: 'status', header: 'Status', cell: (row) => row.is_active ? 'Active' : 'Paused' },
  ];
  return <div className="staff-access min-w-0 space-y-6">
    <header className="staff-access-header"><div><p className="staff-access-eyebrow">Platform administration</p><h1>Account officers</h1>
      <p className="staff-access-subtitle">Create a support account, wait for activation, then assign tenants.</p></div>
      <div className="staff-access-actions"><Button variant="secondary" onClick={() => setAssigning(true)}>Assign tenant</Button>
        <Button leadingIcon={<Plus size={16} />} onClick={() => setCreating(true)}>Create account officer</Button></div></header>
    <section className="staff-access-panel space-y-3 p-5" aria-label="Account officer change requests">
      <h2 className="text-lg font-semibold">Officer change requests</h2>
      {requests.isPending ? <p>Loading requests…</p> : requests.isError ? <Button variant="secondary" onClick={() => void requests.refetch()}>Retry requests</Button> :
        requests.data?.filter((row) => row.status === 'pending').length ? requests.data.filter((row) => row.status === 'pending').map((row) => <OfficerRequestRow key={row.id} row={row} />) :
        <p className="text-sm text-ink-500">No requests awaiting review.</p>}
    </section>
    <section className="staff-access-panel p-5 space-y-4" aria-label="Staff directory">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Staff directory</h2>
        <Button variant="secondary" size="sm" onClick={() => void active.refetch()} leadingIcon={<RefreshCw size={16} />}>Refresh</Button></div>
      <Tabs items={[...VIEWS]} value={view} onChange={(next) => { setView(next); setPage(1); }} ariaLabel="Staff views" />
      {view === 'officers' ? <div className="staff-access-filters">
        <FormField label="Search officers"><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Username or email" /></FormField>
        <FormField label="Status"><select className="rounded-control border border-border bg-surface p-2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option><option value="ready">Ready</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></FormField>
      </div> : <div className="staff-access-filters"><TenantSelect value={tenant} onChange={(value) => { setTenant(value); setPage(1); }} /></div>}
      {view === 'officers' ? <DataTable caption="Account officers" columns={officerColumns} rows={officers.data?.results}
        rowKey={(row) => row.id} loading={officers.isPending} error={officers.error} onRetry={() => void officers.refetch()}
        rowActions={(row) => row.status === 'active' ? <Button size="sm" variant="ghost" onClick={() => setSuspending(row)}>Suspend</Button> :
          <Button size="sm" variant="ghost" onClick={() => setResending(row)}>Resend setup</Button>}
        empty={<EmptyState icon={<Users />} title="No account officers found" action={<Button onClick={() => setCreating(true)}>Create account officer</Button>} />} /> :
        <DataTable caption="Tenant assignments" columns={assignmentColumns} rows={assignments.data?.results} rowKey={(row) => row.id}
          loading={assignments.isPending} error={assignments.error} onRetry={() => void assignments.refetch()}
          rowActions={(row) => <span className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(row)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => setRevoking(row)}>Revoke</Button></span>}
          empty={<EmptyState icon={<ShieldOff />} title="No tenant assignments found" action={<Button onClick={() => setAssigning(true)}>Assign tenant</Button>} />} />}
      {(active.data?.count ?? 0) > 0 && <Pagination count={active.data!.count} page={page} totalPages={active.data!.total_pages}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} itemLabel={view} />}
    </section>
    <InviteDialog open={creating} onClose={() => setCreating(false)} />
    <NewAssignmentDialog open={assigning} onClose={() => setAssigning(false)} defaultTenant={tenant ? Number(tenant) : undefined} />
    <EditGrantsDialog assignment={editing} onClose={() => setEditing(null)} />
    <ResendDialog account={resending} onClose={() => setResending(null)} />
    <ConfirmDialog open={suspending !== null} onClose={() => setSuspending(null)} tone="danger" title={`Suspend ${suspending?.username || 'this officer'}?`}
      description="The officer loses access to every assigned tenant immediately. Their assignments and history remain."
      confirmLabel="Suspend officer" onConfirm={async () => { if (suspending) { await suspend.mutateAsync(suspending.id); toast.success('Officer suspended'); } }} />
    <ConfirmDialog open={revoking !== null} onClose={() => setRevoking(null)} tone="danger" title="Revoke tenant assignment?"
      description="This officer will lose access to the selected tenant. Other assignments remain."
      confirmLabel="Revoke" onConfirm={async () => { if (revoking) { await revoke.mutateAsync(revoking.id); toast.success('Assignment revoked'); } }} />
  </div>;
}

function ResendDialog({ account, onClose }: { account: StaffAccount | null; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const resend = useResendStaffSetup();
  const toast = useToast();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!account) return; setError('');
    try { const result = await resend.mutateAsync({ id: account.id, temporary_password: password });
      toast.success(result.delivery_status === 'accepted' ? 'New setup email accepted by provider' : 'Email delivery failed; check settings and retry');
      setPassword(''); onClose();
    } catch (cause) { setError(errorMessage(cause)); }
  }
  return <Dialog open={account !== null} onClose={onClose} title={`Resend setup to ${account?.username || 'officer'}`}
    description="A new temporary password and link replace the previous setup credentials.">
    <form onSubmit={(e) => void submit(e)} className="space-y-4">{error && <Alert tone="danger">{error}</Alert>}
      <FormField label="New temporary password" required><Input type="password" autoComplete="new-password" required minLength={8}
        value={password} onChange={(e) => setPassword(e.target.value)} /></FormField>
      <Button type="submit" loading={resend.isPending}>Send new setup email</Button></form>
  </Dialog>;
}

function OfficerRequestRow({ row }: { row: { id: number; tenant: number; tenant_name: string; reason: string } }) {
  const client = useQueryClient();
  const toast = useToast();
  const assignments = useAssignments({ tenant: row.tenant, page_size: 100 });
  const [assignment, setAssignment] = useState('');
  const [error, setError] = useState('');
  const review = useMutation({ mutationFn: ({ status, id }: { status: 'approved' | 'declined'; id?: number }) =>
    platformApi.reviewOfficerChange(row.id, status, id),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['platform', 'officer-change-requests'] }); toast.success('Request reviewed'); },
    onError: (cause) => setError(errorMessage(cause)),
  });
  return <div className="rounded-control border border-border p-4 space-y-2">
    <p className="font-medium">{row.tenant_name}</p><p className="text-sm">{row.reason}</p>
    <label className="block text-sm" htmlFor={`officer-request-${row.id}`}>New primary officer</label>
    <select id={`officer-request-${row.id}`} className="rounded-control border border-border bg-surface p-2" value={assignment} onChange={(event) => setAssignment(event.target.value)}>
      <option value="">Choose an assigned officer</option>
      {assignments.data?.results.filter((item) => item.is_active).map((item) =>
        <option key={item.id} value={item.id}>{item.user_display || 'Account officer'}</option>)}
    </select>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="flex gap-2"><Button size="sm" disabled={!assignment} loading={review.isPending} onClick={() => review.mutate({ status: 'approved', id: Number(assignment) })}>Approve change</Button>
      <Button size="sm" variant="secondary" loading={review.isPending} onClick={() => review.mutate({ status: 'declined' })}>Decline</Button></div>
  </div>;
}
