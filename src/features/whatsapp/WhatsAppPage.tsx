import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { http } from '@/services/api/http';
import { Alert, QueryBoundary } from '@/components/feedback';
import { Button, Card, Checkbox, FormField, Input, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/layout';
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
  const principal = usePrincipal();
  const scope = principal.kind === 'member' ? principal.tenantId : principal.kind === 'platform_staff' ? principal.activeTenantId : null;
  const query = useQuery({
    queryKey: ['whatsapp-connections', scope],
    queryFn: () => http.get<Paginated<WhatsAppConnection>>('/whatsapp/routes/'),
    enabled: scope !== null && can(principal, 'whatsapp.view'),
  });
  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp" description="Manage your business connection details." />
      <Alert tone="info" title="WhatsApp activation">
        Shared-number purchases require a verified platform connection, an active business link
        and a running worker. Reminders start disabled and require customer consent.
        Saving your individual connection details does not activate shared-number sales.
      </Alert>
      {can(principal, 'whatsapp.manage') && <TenantEntryLink key={`${principal.user.id}:${scope}`} scope={scope} />}
      {can(principal, 'whatsapp.manage') && <WorkflowControls key={`workflow:${principal.user.id}:${scope}`} scope={scope} />}
      <QueryBoundary
        query={query}
        skeleton={<Skeleton className="h-48 w-full" />}
        errorTitle="Could not load WhatsApp settings"
      >
        {(data) => (
          <ConnectionForm
            key={`${principal.user.id}:${scope}:${data.results[0]?.id ?? 'new'}`}
            connection={data.results[0] ?? null}
            canManage={can(principal, 'whatsapp.manage')}
            scope={scope}
          />
        )}
      </QueryBoundary>
    </div>
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
    <Card className="max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">Business connection</h2>
      <p>
        {connection
          ? 'Connection details saved. Provider connection has not been verified.'
          : 'No connection details saved yet.'}
      </p>
      <p>Access token: {connection?.token_saved ? 'Saved securely' : 'Not saved'}</p>
      {!canManage && <Alert>Only a workspace administrator can change these settings.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && (
        <Alert tone="success">
          Connection details saved. No provider check or message was sent.
        </Alert>
      )}
      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <fieldset disabled={!canManage || busy} className="space-y-4">
          <FormField
            label="Meta phone number ID"
            hint="The identifier from your Meta configuration. This is different from your public WhatsApp number."
          >
            <Input
              value={phoneId}
              onChange={(event) => setPhoneId(event.target.value)}
              required
              inputMode="numeric"
              pattern="[0-9]{1,100}"
              maxLength={100}
            />
          </FormField>
          <FormField
            label="Public WhatsApp number"
            hint="Include the country code, for example +2348012345678. Existing records are not guessed from Meta IDs."
          >
            <Input
              value={displayNumber}
              onChange={(event) => setDisplayNumber(event.target.value)}
              type="tel"
              pattern="\+?[1-9][0-9]{6,14}"
              maxLength={16}
            />
          </FormField>
          {canManage && (
            <FormField
              label={connection ? 'Replace access token (optional)' : 'Access token'}
              hint="Saved tokens are never displayed. Leave blank to keep the existing token."
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required={!connection}
                maxLength={500}
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
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Save connection details'}
            </Button>
          )}
        </fieldset>
      </form>
    </Card>
  );
}
