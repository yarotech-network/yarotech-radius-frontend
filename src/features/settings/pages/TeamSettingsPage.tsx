import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, ErrorState, useToast } from '@/components/feedback';
import { Button, Card, FormField, Input, Skeleton } from '@/components/ui';
import { usePrincipal } from '@/app/auth/useAuth';
import { errorMessage } from '@/services/api/errors';
import { settingsApi } from '../api';

export default function TeamSettingsPage() {
  const principal = usePrincipal();
  const tenantId = principal.kind === 'member' ? principal.tenantId : null;
  const client = useQueryClient();
  const toast = useToast();
  const officer = useQuery({ queryKey: ['officer', tenantId], queryFn: settingsApi.officer, enabled: tenantId !== null });
  const requests = useQuery({ queryKey: ['officer-requests', tenantId], queryFn: settingsApi.officerRequests, enabled: tenantId !== null });
  const change = useMutation({ mutationFn: settingsApi.requestOfficerChange,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['officer-requests', tenantId] }); toast.success('Request sent to platform administration'); } });
  const transfer = useMutation({ mutationFn: ({ email, password }: { email: string; password: string }) => settingsApi.startOwnerTransfer(email, password),
    onSuccess: () => toast.success('Ownership invitation sent') });
  const [reason, setReason] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [changeError, setChangeError] = useState('');
  const [transferError, setTransferError] = useState('');

  async function requestChange(event: FormEvent) {
    event.preventDefault(); setChangeError('');
    try { await change.mutateAsync(reason.trim()); setReason(''); }
    catch (cause) { setChangeError(errorMessage(cause)); }
  }
  async function requestTransfer(event: FormEvent) {
    event.preventDefault(); setTransferError('');
    try { await transfer.mutateAsync({ email: email.trim(), password }); setEmail(''); setPassword(''); }
    catch (cause) { setTransferError(errorMessage(cause)); }
  }

  return <div className="space-y-6">
    <Card className="space-y-4 p-5">
      <div><h2 className="text-lg font-semibold">Your account officer</h2><p className="text-sm text-ink-500">Contact this person for help with your workspace.</p></div>
      {officer.isPending ? <Skeleton className="h-20 w-full" /> : officer.isError ?
        <ErrorState error={officer.error} onRetry={() => void officer.refetch()} compact /> :
        <div className="rounded-control border border-border bg-surface-muted p-4">
          <p className="font-semibold">{officer.data?.name}</p>
          <a href={`mailto:${officer.data?.email}`} className="dashboard-data-link">{officer.data?.email}</a>
          {officer.data?.phone && <p><a href={`tel:${officer.data.phone}`} className="dashboard-data-link">{officer.data.phone}</a></p>}
          {!officer.data?.assigned && <p className="mt-2 text-sm text-ink-500">A primary officer has not been assigned yet. General support is available.</p>}
        </div>}
      <form onSubmit={(event) => void requestChange(event)} className="space-y-3">
        <FormField label="Request a different account officer" required>
          <Input value={reason} minLength={10} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Tell us why you need a change" />
        </FormField>
        {changeError && <Alert tone="danger">{changeError}</Alert>}
        <Button type="submit" disabled={reason.trim().length < 10} loading={change.isPending}>Send request</Button>
      </form>
      {requests.data?.some((item) => item.status === 'pending') && <p role="status" className="text-sm text-ink-500">Your officer-change request is awaiting platform review.</p>}
    </Card>
    <Card className="space-y-4 p-5">
      <div><h2 className="text-lg font-semibold">Workspace owner</h2><p className="text-sm text-ink-500">Only one owner can control this workspace. Agents have separate selling accounts.</p></div>
      <Link className="dashboard-data-link" to="/agents">Manage agents</Link>
      <form onSubmit={(event) => void requestTransfer(event)} className="space-y-3">
        <p className="text-sm font-medium">Transfer ownership</p>
        <p className="text-sm text-ink-500">The invited person must accept within 72 hours. Your workspace access ends when they accept.</p>
        <FormField label="New owner email" required><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
        <FormField label="Your current password" required><Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></FormField>
        {transferError && <Alert tone="danger">{transferError}</Alert>}
        <Button type="submit" disabled={!email || !password} loading={transfer.isPending}>Send ownership invitation</Button>
      </form>
    </Card>
  </div>;
}
