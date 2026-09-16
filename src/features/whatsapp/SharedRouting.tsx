import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, MessageSquare, ShieldCheck, RefreshCw, Link as LinkIcon, Radio } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import { Alert, QueryBoundary, useToast } from '@/components/feedback';
import { Button, Card, Checkbox, ConfirmDialog, FormField, Input, Skeleton } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/layout';

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
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [action, setAction] = useState<'create' | 'rotate' | 'revoke' | null>(null);
  const query = useQuery({
    queryKey: ['whatsapp-entry', principal.user.id, scope],
    queryFn: () => http.get<Entry>('/whatsapp/entry-route/'),
    enabled: open && scope !== null,
  });

  const handleCopyLink = (url: string) => {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied', 'WhatsApp business entry URL copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <MessageSquare className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Shared-Number WhatsApp Link</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Generate a branded WhatsApp entry link on the shared platform number.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(!open)}>
          {open ? 'Hide details' : 'Manage business link'}
        </Button>
      </div>

      {open && (
        <QueryBoundary query={query} skeleton={<Skeleton className="h-28 w-full" />}>
          {(entry) => (
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Status:</span>
                  <StatusBadge status={entry.revoked ? 'revoked' : entry.exists ? 'active' : 'inactive'} size="sm" />
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Shared Number:</span>{' '}
                  <span className="font-mono text-slate-900 dark:text-slate-200">{entry.shared_number || 'Not configured by platform'}</span>
                </div>
              </div>

              <Alert tone="warning" title={entry.sales_available ? 'Automation configured' : 'Preview mode only'}>
                {entry.sales_available 
                  ? 'Confirm a successful customer purchase before distributing this link widely.' 
                  : 'Sales are not active yet. Keep this link private until provider verification and customer purchases are enabled.'}
              </Alert>

              {!entry.routing_keys_ready && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  The platform needs to configure its routing keys before a preview link is available.
                </p>
              )}

              {entry.preview_url && (
                <FormField label="Business Entry Link Preview">
                  <div className="flex items-center gap-2">
                    <Input readOnly value={entry.preview_url} onFocus={(event) => event.target.select()} className="font-mono text-xs" />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopyLink(entry.preview_url!)}
                      leadingIcon={copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </FormField>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={() => setAction(entry.exists ? 'rotate' : 'create')}>
                  {entry.exists ? 'Replace business link' : 'Create business link'}
                </Button>
                {entry.exists && !entry.revoked && (
                  <Button variant="danger" size="sm" onClick={() => setAction('revoke')}>
                    Revoke link
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => void query.refetch()} leadingIcon={<RefreshCw className="size-3.5" />}>
                  Reload
                </Button>
              </div>

              <ConfirmDialog 
                open={action !== null} 
                onClose={() => setAction(null)} 
                title={action === 'revoke' ? 'Revoke this link?' : action === 'rotate' ? 'Replace this link?' : 'Create a business link?'}
                description={action === 'create' ? 'This creates a preview link. It does not immediately activate sales.' : 'The existing link will stop working. Previous customer purchases remain safely recorded.'}
                onConfirm={async () => {
                  try { 
                    await http.post('/whatsapp/entry-route/', { action, expected_version: entry.version }); 
                  } finally { 
                    await query.refetch(); 
                  }
                }} 
              />
            </div>
          )}
        </QueryBoundary>
      )}
    </Card>
  );
}

export default function SharedEndpointPage() {
  const principal = usePrincipal();
  const query = useQuery({ 
    queryKey: ['whatsapp-shared-endpoint', principal.user.id],
    queryFn: () => http.get<Endpoint>('/platform/whatsapp/shared-endpoint/'), 
    enabled: principal.kind === 'platform_admin' 
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Shared WhatsApp Endpoint" description="Configure the global Meta WhatsApp Cloud API credentials used for tenant shared business links." />
      
      <Alert tone="warning" title={query.data?.sales_available ? 'WhatsApp automation active' : 'WhatsApp sales are not active yet'}>
        Saving these settings does not automatically verify the provider or send messages. The background worker must be running for customer purchases and message delivery.
      </Alert>

      <QueryBoundary query={query} skeleton={<Skeleton className="h-64 w-full" />}>
        {(endpoint) => <EndpointForm key={`${principal.user.id}:${endpoint.version}`} endpoint={endpoint} reload={() => query.refetch()} />}
      </QueryBoundary>
    </div>
  );
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
      setNotice('Saved phone number and token verified. Connection established.');
    } catch (err) { setError(errorMessage(err)); await reload(); }
    finally { saving.current = false; setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      await http.put('/platform/whatsapp/shared-endpoint/', { 
        expected_version: endpoint.version,
        phone_number_id: phoneId, 
        display_number: number, 
        is_active: active,
        ...(token ? { access_token: token } : {}) 
      });
      setToken('');
      await reload();
    } catch (err) { setError(errorMessage(err)); }
    finally { saving.current = false; setBusy(false); }
  }

  return (
    <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 flex items-center gap-3">
          <ShieldCheck className={`size-5 ${endpoint.provider_verified ? 'text-emerald-500' : 'text-slate-400'}`} />
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Provider Verification</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{endpoint.provider_verified ? 'Verified' : 'Unverified'}</div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 flex items-center gap-3">
          <LinkIcon className={`size-5 ${endpoint.routing_keys_ready ? 'text-emerald-500' : 'text-slate-400'}`} />
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Routing Keys</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{endpoint.routing_keys_ready ? 'Configured' : 'Missing'}</div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 flex items-center gap-3">
          <Radio className={`size-5 ${endpoint.webhook_enabled ? 'text-emerald-500' : 'text-slate-400'}`} />
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Webhook Reception</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{endpoint.webhook_enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 flex items-center gap-3">
          <MessageSquare className={`size-5 ${endpoint.webhook_configured ? 'text-emerald-500' : 'text-slate-400'}`} />
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Webhook Tokens</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{endpoint.webhook_configured ? 'Ready' : 'Not Set'}</div>
          </div>
        </div>
      </div>

      {error && <Alert tone="danger" title="Could not save settings">{error} Reload settings to review the latest saved version.</Alert>}
      {notice && <Alert tone="success" title="Connection Checked">{notice}</Alert>}

      <form onSubmit={(event) => void save(event)} className="space-y-4 pt-2">
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Shared Meta Phone Number ID">
              <Input required pattern="[0-9]{1,100}" maxLength={100} value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="e.g. 10928374650" />
            </FormField>
            <FormField label="Shared Public WhatsApp Number">
              <Input required type="tel" pattern="\+?[1-9][0-9]{6,14}" maxLength={16} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+2348000000000" />
            </FormField>
          </div>
          <FormField label={endpoint.token_saved ? 'Replace Shared Access Token (Optional)' : 'Shared Access Token'} hint="Leave blank to preserve the saved token.">
            <Input type="password" autoComplete="new-password" required={!endpoint.token_saved} maxLength={500} value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAB..." />
          </FormField>
          <div className="pt-2">
            <Checkbox label="Enable business link previews across tenant portals" checked={active} onChange={(e) => setActive(e.target.checked)} />
          </div>
          <div className="flex flex-wrap gap-3 pt-3">
            <Button type="submit">{busy ? 'Saving...' : 'Save Shared Connection'}</Button>
            <Button type="button" variant="secondary" onClick={() => void reload()}>Reload Settings</Button>
            <Button 
              type="button" 
              variant="secondary" 
              disabled={!endpoint.exists || phoneId !== endpoint.phone_number_id || number !== endpoint.display_number || Boolean(token) || active !== endpoint.is_active} 
              onClick={() => void verify()}
            >
              Verify Connection
            </Button>
          </div>
        </fieldset>
      </form>
    </Card>
  );
}

