import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import { Alert, QueryBoundary } from '@/components/feedback';
import { Button, Card, Checkbox, ConfirmDialog, FormField, Input, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/layout';

interface Entry {
  exists: boolean; version: string | null; revoked: boolean; shared_number: string;
  preview_url: string | null; routing_keys_ready: boolean; sales_available: boolean;
}
interface Endpoint {
  sales_available: boolean;
  exists: boolean; version: string | null; phone_number_id: string; display_number: string;
  is_active: boolean; token_saved: boolean; provider_verified: boolean; routing_keys_ready: boolean;
  webhook_enabled: boolean; webhook_configured: boolean;
}

export function TenantEntryLink({ scope }: { scope: number | null }) {
  const principal = usePrincipal();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<'create' | 'rotate' | 'revoke' | null>(null);
  const query = useQuery({
    queryKey: ['whatsapp-entry', principal.user.id, scope],
    queryFn: () => http.get<Entry>('/whatsapp/entry-route/'),
    enabled: open && scope !== null,
  });
  return <Card className="space-y-4 p-5">
    <h2 className="text-lg font-semibold">Shared-number business link</h2>
    <p>Your business can have its own entry link on the platform WhatsApp number.</p>
    <Button variant="secondary" onClick={() => setOpen(!open)}>{open ? 'Hide business link' : 'Manage business link'}</Button>
    {open && <QueryBoundary query={query} skeleton={<Skeleton className="h-24" />}>
      {(entry) => <div className="space-y-4">
        <p>{entry.revoked ? 'Link revoked' : entry.exists ? 'Link created' : 'No link created yet'}</p>
        <p>Shared number: {entry.shared_number || 'Not configured by the platform'}</p>
        <Alert tone="warning" title={entry.sales_available ? 'Automation configured' : 'Preview only'}>{entry.sales_available ? 'Confirm a successful customer purchase before distributing this link widely.' : 'Sales are not active. Keep this link private until provider verification and customer purchases are enabled.'}</Alert>
        {!entry.routing_keys_ready && <p>The platform needs to configure its routing keys before a preview is available.</p>}
        {entry.preview_url && <FormField label="Business link preview"><Input readOnly value={entry.preview_url} onFocus={(event) => event.target.select()} /></FormField>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setAction(entry.exists ? 'rotate' : 'create')}>{entry.exists ? 'Replace business link' : 'Create business link'}</Button>
          {entry.exists && !entry.revoked && <Button variant="danger" onClick={() => setAction('revoke')}>Revoke business link</Button>}
          <Button variant="secondary" onClick={() => void query.refetch()}>Reload link</Button>
        </div>
        <ConfirmDialog open={action !== null} onClose={() => setAction(null)} title={action === 'revoke' ? 'Revoke this link?' : action === 'rotate' ? 'Replace this link?' : 'Create a business link?'}
          description={action === 'create' ? 'This creates a preview. It does not activate sales.' : 'The existing link will stop working. Existing purchases remain recorded.'}
          onConfirm={async () => {
            try { await http.post('/whatsapp/entry-route/', { action, expected_version: entry.version }); }
            finally { await query.refetch(); }
          }} />
      </div>}
    </QueryBoundary>}
  </Card>;
}

export default function SharedEndpointPage() {
  const principal = usePrincipal();
  const query = useQuery({ queryKey: ['whatsapp-shared-endpoint', principal.user.id],
    queryFn: () => http.get<Endpoint>('/platform/whatsapp/shared-endpoint/'), enabled: principal.kind === 'platform_admin' });
  return <div className="space-y-6">
    <PageHeader title="Shared WhatsApp number" description="Configure the platform number used by tenant business links." />
    <Alert tone="warning" title={query.data?.sales_available ? 'WhatsApp automation configured' : 'WhatsApp sales are not active yet'}>Saving these settings does not verify the provider or send messages. The worker must be running for customer purchases and delivery. Changing the connection requires verification again.</Alert>
    <QueryBoundary query={query} skeleton={<Skeleton className="h-48" />}>
      {(endpoint) => <EndpointForm key={`${principal.user.id}:${endpoint.version}`} endpoint={endpoint} reload={() => query.refetch()} />}
    </QueryBoundary>
  </div>;
}

function EndpointForm({ endpoint, reload }: { endpoint: Endpoint; reload: () => Promise<unknown> }) {
  const [phoneId, setPhoneId] = useState(endpoint.phone_number_id);
  const [number, setNumber] = useState(endpoint.display_number);
  const [token, setToken] = useState('');
  const [active, setActive] = useState(endpoint.is_active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const saving = useRef(false);
  async function verify() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await http.post('/platform/whatsapp/shared-endpoint/verify/', { expected_version: endpoint.version });
      await reload();
      setNotice('Saved phone number and token verified. This did not send a message.');
    } catch (err) { setError(errorMessage(err)); await reload(); }
    finally { saving.current = false; setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      await http.put('/platform/whatsapp/shared-endpoint/', { expected_version: endpoint.version,
        phone_number_id: phoneId, display_number: number, is_active: active,
        ...(token ? { access_token: token } : {}) });
      setToken('');
      await reload();
    } catch (err) { setError(errorMessage(err)); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Card className="space-y-4 p-5">
    <p>Provider verification: {endpoint.provider_verified ? 'Verified' : 'Not verified'}</p>
    <p>Routing keys: {endpoint.routing_keys_ready ? 'Configured' : 'Not configured'}</p>
    <p>Webhook reception: {endpoint.webhook_enabled ? 'Enabled in server settings' : 'Disabled in server settings'}</p>
    <p>Webhook credentials: {endpoint.webhook_configured ? 'Configured' : 'Not configured'}</p>
    <p className="text-sm">Reception settings do not confirm a live provider connection or activate customer replies.</p>
    {error && <Alert tone="danger" title="Could not save settings">{error} Use Reload settings to review the latest saved version.</Alert>}
    {notice && <Alert tone="success" title="Connection checked">{notice}</Alert>}
    <form onSubmit={(event) => void save(event)} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <FormField label="Shared Meta phone number ID"><Input required pattern="[0-9]{1,100}" maxLength={100} value={phoneId} onChange={(e) => setPhoneId(e.target.value)} /></FormField>
        <FormField label="Shared public WhatsApp number"><Input required type="tel" pattern="\+?[1-9][0-9]{6,14}" maxLength={16} value={number} onChange={(e) => setNumber(e.target.value)} /></FormField>
        <FormField label={endpoint.token_saved ? 'Replace shared access token (optional)' : 'Shared access token'} hint="Leave blank to preserve the saved token."><Input type="password" autoComplete="new-password" required={!endpoint.token_saved} maxLength={500} value={token} onChange={(e) => setToken(e.target.value)} /></FormField>
        <Checkbox label="Enable business link previews" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <Button type="submit">{busy ? 'Saving...' : 'Save shared number'}</Button>
        <Button type="button" variant="secondary" onClick={() => void reload()}>Reload settings</Button>
        <Button type="button" variant="secondary" disabled={!endpoint.exists || phoneId !== endpoint.phone_number_id || number !== endpoint.display_number || Boolean(token) || active !== endpoint.is_active} onClick={() => void verify()}>Verify saved connection</Button>
      </fieldset>
    </form>
  </Card>;
}
