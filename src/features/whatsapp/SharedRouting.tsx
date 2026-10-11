import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Link as LinkIcon,
  MessageSquare,
  Radio,
  RefreshCw,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import { Alert, QueryBoundary } from '@/components/feedback';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  CopyButton,
  FormField,
  Input,
  Skeleton,
} from '@/components/ui';
import { SectionCard, StatusBadge } from '@/components/layout';
import { cn } from '@/lib/utilities/cn';

interface Entry {
  exists: boolean;
  version: string | null;
  revoked: boolean;
  shared_number: string;
  preview_url: string | null;
  routing_keys_ready: boolean;
  sales_available: boolean;
}
interface Endpoint {
  sales_available: boolean;
  exists: boolean;
  version: string | null;
  phone_number_id: string;
  display_number: string;
  is_active: boolean;
  token_saved: boolean;
  provider_verified: boolean;
  routing_keys_ready: boolean;
  webhook_enabled: boolean;
  webhook_configured: boolean;
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

  return (
    <SectionCard
      id="whatsapp-business-link"
      icon={<LinkIcon />}
      title="Shared-number business link"
      description="Your own entry link on the platform WhatsApp number. Customers who open it chat with your business."
      actions={
        <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide business link' : 'Manage business link'}
        </Button>
      }
    >
      {open && (
        <QueryBoundary query={query} skeleton={<Skeleton className="h-28 w-full" />}>
          {(entry) => (
            <div className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface-muted p-3">
                  <dt className="text-xs text-ink-500">Link status</dt>
                  <dd className="mt-1">
                    <StatusBadge
                      status={entry.revoked ? 'revoked' : entry.exists ? 'active' : 'inactive'}
                      size="sm"
                    />
                  </dd>
                </div>
                <div className="rounded-lg border border-border bg-surface-muted p-3">
                  <dt className="text-xs text-ink-500">Shared number</dt>
                  <dd className="mt-1 font-mono text-sm text-ink-900">
                    {entry.shared_number || 'Not configured by the platform'}
                  </dd>
                </div>
              </dl>

              <Alert
                tone="warning"
                title={entry.sales_available ? 'Automation configured' : 'Preview only'}
              >
                {entry.sales_available
                  ? 'Confirm a successful customer purchase before sharing this link widely.'
                  : 'Sales are not active yet. Keep this link private until provider verification and customer purchases are enabled.'}
              </Alert>

              {!entry.routing_keys_ready && (
                <p className="text-sm text-warning-700">
                  The platform needs to configure its routing keys before a preview link is
                  available.
                </p>
              )}

              {entry.preview_url && (
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <FormField label="Business link preview">
                      <Input
                        readOnly
                        value={entry.preview_url}
                        onFocus={(event) => event.target.select()}
                        className="font-mono text-xs"
                      />
                    </FormField>
                  </div>
                  <CopyButton value={entry.preview_url} label="Copy link" variant="secondary" />
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button size="sm" onClick={() => setAction(entry.exists ? 'rotate' : 'create')}>
                  {entry.exists ? 'Replace business link' : 'Create business link'}
                </Button>
                {entry.exists && !entry.revoked && (
                  <Button variant="danger" size="sm" onClick={() => setAction('revoke')}>
                    Revoke business link
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                  leadingIcon={<RefreshCw className="size-3.5" aria-hidden />}
                >
                  Reload link
                </Button>
              </div>

              <ConfirmDialog
                open={action !== null}
                onClose={() => setAction(null)}
                tone={action === 'revoke' ? 'danger' : 'default'}
                title={
                  action === 'revoke'
                    ? 'Revoke this link?'
                    : action === 'rotate'
                      ? 'Replace this link?'
                      : 'Create a business link?'
                }
                description={
                  action === 'create'
                    ? 'This creates a preview link. It does not activate sales.'
                    : 'The existing link will stop working. Earlier customer purchases stay recorded.'
                }
                onConfirm={async () => {
                  try {
                    await http.post('/whatsapp/entry-route/', {
                      action,
                      expected_version: entry.version,
                    });
                  } finally {
                    await query.refetch();
                  }
                }}
              />
            </div>
          )}
        </QueryBoundary>
      )}
    </SectionCard>
  );
}

export default function SharedEndpointPage() {
  const principal = usePrincipal();
  const query = useQuery({
    queryKey: ['whatsapp-shared-endpoint', principal.user.id],
    queryFn: () => http.get<Endpoint>('/platform/whatsapp/shared-endpoint/'),
    enabled: principal.kind === 'platform_admin',
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-500">Platform messaging</p>
        <h1 className="text-2xl font-bold text-ink-900">Shared WhatsApp number</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          The platform number that every workspace business link uses.
        </p>
      </header>

      <Alert
        tone="warning"
        title={
          query.data?.sales_available
            ? 'WhatsApp automation configured'
            : 'WhatsApp sales are not active yet'
        }
      >
        Saving these settings does not verify the provider or send messages. The worker must be
        running for customer purchases and delivery. Changing the connection requires verification
        again.
      </Alert>

      <QueryBoundary query={query} skeleton={<Skeleton className="h-64 w-full rounded-card" />}>
        {(endpoint) => (
          <EndpointForm
            key={`${principal.user.id}:${endpoint.version}`}
            endpoint={endpoint}
            reload={() => query.refetch()}
          />
        )}
      </QueryBoundary>
    </div>
  );
}

function StatusItem({
  icon,
  label,
  value,
  ok,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted p-3">
      <span
        aria-hidden
        className={cn('shrink-0 [&>svg]:size-4.5', ok ? 'text-success-600' : 'text-ink-400')}
      >
        {icon}
      </span>
      <span className="text-sm text-ink-700">{`${label}: ${value}`}</span>
    </li>
  );
}

function EndpointForm({
  endpoint,
  reload,
}: {
  endpoint: Endpoint;
  reload: () => Promise<unknown>;
}) {
  const [phoneId, setPhoneId] = useState(endpoint.phone_number_id);
  const [number, setNumber] = useState(endpoint.display_number);
  const [token, setToken] = useState('');
  const [active, setActive] = useState(endpoint.is_active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const saving = useRef(false);
  const unsavedEdits =
    phoneId !== endpoint.phone_number_id ||
    number !== endpoint.display_number ||
    Boolean(token) ||
    active !== endpoint.is_active;

  async function verify() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await http.post('/platform/whatsapp/shared-endpoint/verify/', {
        expected_version: endpoint.version,
      });
      await reload();
      setNotice('Saved phone number and token verified. This did not send a message.');
    } catch (err) {
      setError(errorMessage(err));
      await reload();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await http.put('/platform/whatsapp/shared-endpoint/', {
        expected_version: endpoint.version,
        phone_number_id: phoneId,
        display_number: number,
        is_active: active,
        ...(token ? { access_token: token } : {}),
      });
      setToken('');
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        icon={<ShieldCheck />}
        title="Connection status"
        description="Reception settings do not confirm a live provider connection or activate customer replies."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          <StatusItem
            icon={<ShieldCheck />}
            label="Provider verification"
            ok={endpoint.provider_verified}
            value={endpoint.provider_verified ? 'Verified' : 'Not verified'}
          />
          <StatusItem
            icon={<LinkIcon />}
            label="Routing keys"
            ok={endpoint.routing_keys_ready}
            value={endpoint.routing_keys_ready ? 'Configured' : 'Not configured'}
          />
          <StatusItem
            icon={<Radio />}
            label="Webhook reception"
            ok={endpoint.webhook_enabled}
            value={
              endpoint.webhook_enabled
                ? 'Enabled in server settings'
                : 'Disabled in server settings'
            }
          />
          <StatusItem
            icon={<Webhook />}
            label="Webhook credentials"
            ok={endpoint.webhook_configured}
            value={endpoint.webhook_configured ? 'Configured' : 'Not configured'}
          />
        </ul>
      </SectionCard>

      <SectionCard icon={<MessageSquare />} title="Shared number details">
        <form onSubmit={(event) => void save(event)} className="space-y-5">
          {error && (
            <Alert tone="danger" title="Could not save settings">
              {error} Use Reload settings to review the latest saved version.
            </Alert>
          )}
          {notice && (
            <Alert tone="success" title="Connection checked">
              {notice}
            </Alert>
          )}
          <fieldset disabled={busy} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Shared Meta phone number ID">
                <Input
                  required
                  pattern="[0-9]{1,100}"
                  maxLength={100}
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  placeholder="e.g. 10928374650"
                  className="font-mono"
                />
              </FormField>
              <FormField label="Shared public WhatsApp number">
                <Input
                  required
                  type="tel"
                  pattern="\+?[1-9][0-9]{6,14}"
                  maxLength={16}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="+2348000000000"
                />
              </FormField>
            </div>
            <FormField
              label={
                endpoint.token_saved
                  ? 'Replace shared access token (optional)'
                  : 'Shared access token'
              }
              hint="Leave blank to keep the saved token."
            >
              <Input
                type="password"
                autoComplete="new-password"
                required={!endpoint.token_saved}
                maxLength={500}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAAB…"
              />
            </FormField>
            <Checkbox
              label="Enable business link previews"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => void reload()}>
                Reload settings
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!endpoint.exists || unsavedEdits}
                title={unsavedEdits ? 'Save your changes before verifying' : undefined}
                onClick={() => void verify()}
              >
                Verify saved connection
              </Button>
              <Button type="submit">{busy ? 'Saving…' : 'Save shared number'}</Button>
            </div>
          </fieldset>
        </form>
      </SectionCard>
    </div>
  );
}
