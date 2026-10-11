import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, KeyRound, MessageSquare, RefreshCw } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { http } from '@/services/api/http';
import { Alert, QueryBoundary } from '@/components/feedback';
import { KpiTile, SectionCard } from '@/components/layout';
import { Button, Checkbox, FormField, Input, Skeleton } from '@/components/ui';
import { formatDate } from '@/lib/formatting/dates';
import { cn } from '@/lib/utilities/cn';
import type { Paginated } from '@/types/api';
import { TenantEntryLink } from './SharedRouting';
import { WorkflowControls } from './WorkflowControls';

export interface WhatsAppConnection {
  id: number;
  tenant: number;
  phone_number_id: string;
  display_number: string;
  token_saved: boolean;
  is_active: boolean;
  created_at: string;
}

export default function WhatsAppPage() {
  useEffect(() => {
    document.title = 'WhatsApp · Yarotech RADIUS';
  }, []);
  const principal = usePrincipal();
  const scope =
    principal.kind === 'member'
      ? principal.tenantId
      : principal.kind === 'platform_staff'
        ? principal.activeTenantId
        : null;
  const canManage = can(principal, 'whatsapp.manage');
  const query = useQuery({
    queryKey: ['whatsapp-connections', scope],
    queryFn: () => http.get<Paginated<WhatsAppConnection>>('/whatsapp/routes/'),
    enabled: scope !== null && can(principal, 'whatsapp.view'),
  });
  const connection = query.data?.results[0];
  const loading = query.isPending && query.fetchStatus !== 'idle';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Messaging</p>
          <h1 className="text-2xl font-bold text-ink-900">WhatsApp</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Connect your WhatsApp Business number, share a business link and manage voucher orders
            and reminders sent over WhatsApp.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Refresh WhatsApp settings"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          leadingIcon={
            <RefreshCw
              className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
              aria-hidden
            />
          }
        >
          {query.isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </header>

      {!query.isError && (
        <section aria-label="Connection summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiTile
            label="Business number"
            value={connection?.display_number || 'Not set'}
            detail={
              connection?.phone_number_id
                ? `Meta phone number ID ${connection.phone_number_id}`
                : 'Add your connection details below'
            }
            loading={loading}
          />
          <KpiTile
            label="Access token"
            value={connection?.token_saved ? 'Saved' : 'Not saved'}
            detail={
              connection?.token_saved
                ? 'Stored encrypted and never shown again'
                : 'Needed before messages can be sent'
            }
            extra={<StatusLine on={Boolean(connection?.token_saved)} />}
            loading={loading}
          />
          <KpiTile
            label="Routing record"
            value={connection?.is_active ? 'Allowed' : 'Off'}
            detail="Does not by itself start WhatsApp sales"
            extra={<StatusLine on={Boolean(connection?.is_active)} />}
            loading={loading}
          />
          <KpiTile
            label="First saved"
            value={connection ? formatDate(connection.created_at) : 'Not yet'}
            detail="No provider check is made when saving"
            loading={loading}
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <QueryBoundary
            query={query}
            skeleton={<Skeleton className="h-80 w-full rounded-card" />}
            errorTitle="Could not load WhatsApp settings"
          >
            {(data) => (
              <ConnectionForm
                key={`${principal.user.id}:${scope}:${data.results[0]?.id ?? 'new'}`}
                connection={data.results[0] ?? null}
                canManage={canManage}
                scope={scope}
              />
            )}
          </QueryBoundary>
        </div>
        <ActivationChecklist connection={connection} />
      </div>

      {canManage && <TenantEntryLink key={`${principal.user.id}:${scope}`} scope={scope} />}
      {canManage && (
        <WorkflowControls key={`workflow:${principal.user.id}:${scope}`} scope={scope} />
      )}
    </div>
  );
}

function StatusLine({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('block h-1 rounded-full', on ? 'bg-success-600' : 'bg-fill-strong')}
    />
  );
}

/** What has to be true before customers can buy over WhatsApp; only the first step is known here. */
function ActivationChecklist({ connection }: { connection: WhatsAppConnection | undefined }) {
  const steps = [
    {
      title: 'Save your connection details',
      detail: 'Your Meta phone number ID, public number and access token.',
      done: Boolean(connection?.token_saved),
    },
    {
      title: 'Create a business link',
      detail: 'Customers start a chat on the shared platform number from your link.',
    },
    {
      title: 'Platform verification',
      detail: 'Yarotech verifies the shared number and runs the message worker.',
    },
    {
      title: 'Customers opt in to reminders',
      detail: 'Reminders start switched off and need each customer’s consent.',
    },
  ];
  return (
    <aside
      aria-labelledby="whatsapp-activation"
      className="rounded-card border border-border bg-surface-muted p-5"
    >
      <h2 id="whatsapp-activation" className="text-base font-semibold text-ink-900">
        WhatsApp activation
      </h2>
      <p className="mt-1 text-sm text-ink-500">
        Saving connection details does not start WhatsApp sales. Sales go live once every step below
        is in place.
      </p>
      <ol className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.title} className="flex gap-3">
            {step.done ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-600" aria-label="Done" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-ink-300" aria-hidden />
            )}
            <div>
              <p className="text-sm font-medium text-ink-900">{step.title}</p>
              <p className="text-xs text-ink-500">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function ConnectionForm({
  connection,
  canManage,
  scope,
}: {
  connection: WhatsAppConnection | null;
  canManage: boolean;
  scope: number | null;
}) {
  const client = useQueryClient();
  const [phoneId, setPhoneId] = useState(connection?.phone_number_id ?? '');
  const [displayNumber, setDisplayNumber] = useState(connection?.display_number ?? '');
  const [token, setToken] = useState('');
  const [active, setActive] = useState(connection?.is_active ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current || !canManage) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const payload = {
        phone_number_id: phoneId,
        display_number: displayNumber,
        is_active: active,
        ...(token ? { access_token_encrypted: token } : {}),
      };
      const result = connection
        ? await http.patch<WhatsAppConnection>(`/whatsapp/routes/${connection.id}/`, payload)
        : await http.post<WhatsAppConnection>('/whatsapp/routes/', payload);
      setToken('');
      setSaved(true);
      client.setQueryData(['whatsapp-connections', scope], {
        count: 1,
        current_page: 1,
        total_pages: 1,
        results: [result],
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save connection details.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <SectionCard
      id="whatsapp-connection"
      icon={<MessageSquare />}
      title="Business connection"
      description={
        connection
          ? 'Details saved. The provider connection has not been checked.'
          : 'No connection details saved yet.'
      }
    >
      <form onSubmit={(event) => void save(event)} className="space-y-5">
        {!canManage && (
          <Alert tone="warning">Only a workspace administrator can change these settings.</Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {saved && (
          <Alert tone="success">
            Connection details saved. No provider check or message was sent.
          </Alert>
        )}

        <fieldset disabled={!canManage || busy} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Meta phone number ID"
              hint="From your Meta app settings. This is not your public number."
            >
              <Input
                value={phoneId}
                onChange={(event) => setPhoneId(event.target.value)}
                required
                inputMode="numeric"
                pattern="[0-9]{1,100}"
                maxLength={100}
                placeholder="e.g. 104829384029"
                className="font-mono"
              />
            </FormField>
            <FormField
              label="Public WhatsApp number"
              hint="Include the country code, for example +2348012345678."
            >
              <Input
                value={displayNumber}
                onChange={(event) => setDisplayNumber(event.target.value)}
                type="tel"
                pattern="\+?[1-9][0-9]{6,14}"
                maxLength={16}
                placeholder="+2348012345678"
              />
            </FormField>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm">
            <KeyRound
              className={cn(
                'size-4 shrink-0',
                connection?.token_saved ? 'text-success-600' : 'text-ink-400',
              )}
              aria-hidden
            />
            <span className="text-ink-600">
              Access token:{' '}
              <span className="font-medium text-ink-900">
                {connection?.token_saved ? 'Saved securely' : 'Not saved'}
              </span>
            </span>
          </div>

          {canManage && (
            <FormField
              label={connection ? 'Replace access token (optional)' : 'Access token'}
              hint={
                connection
                  ? 'Saved tokens are never displayed. Leave blank to keep the saved token.'
                  : 'From Meta. It is stored encrypted and never displayed again.'
              }
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required={!connection}
                maxLength={500}
                placeholder="EAAG…"
              />
            </FormField>
          )}
          <Checkbox
            label="Allow this routing record"
            description="This does not activate WhatsApp sales or verify the connection."
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          {canManage && (
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" loading={busy} disabled={busy}>
                {busy ? 'Saving…' : 'Save connection details'}
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </SectionCard>
  );
}
