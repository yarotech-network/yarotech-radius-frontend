import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { Button, FormField, Input } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { SettingsCard } from './SettingsCard';

type Portal = { captive_portal_url: string };
const path = '/tenants/portal/';

export function PortalSettings() {
  const principal = usePrincipal();
  if (principal.kind !== 'member' || principal.role !== 'owner') return null;
  return <PortalForm key={principal.tenantId} tenantId={principal.tenantId} />;
}

function PortalForm({ tenantId }: { tenantId: number }) {
  const client = useQueryClient();
  const queryKey = ['settings', 'portal', tenantId];
  const query = useQuery({ queryKey, queryFn: () => http.get<Portal>(path), retry: false });
  const [draft, setDraft] = useState<string | null>(null);
  const lock = useRef(false);
  const save = useMutation({
    mutationFn: (data: Portal) => http.patch<Portal>(path, data),
    onSuccess: (data) => { client.setQueryData(queryKey, data); setDraft(null); },
  });
  return (
    <SettingsCard title="Customer connection" description="Choose the login page customers open after purchasing an access code.">
      {query.isPending ? <p role="status">Loading connection settings…</p> : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Connection settings could not be loaded" />
      ) : (
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (lock.current) return;
          lock.current = true;
          void save.mutateAsync({ captive_portal_url: (draft ?? query.data.captive_portal_url).trim() })
            .catch(() => undefined).finally(() => { lock.current = false; });
        }}>
          <FormField label="Captive portal login URL" hint="For example http://10.40.0.1/login. Use a plain HTTP/HTTPS address without credentials or query parameters. Leave blank to hide Connect now.">
            <Input value={draft ?? query.data.captive_portal_url} maxLength={500}
              onChange={(event) => { setDraft(event.target.value); save.reset(); }} disabled={save.isPending} />
          </FormField>
          <p className="text-sm text-ink-600">Customers must join your Wi-Fi first. This opens the login page; it does not sign them in automatically.</p>
          {save.isError && <ErrorState error={save.error} title="Connection settings could not be saved" />}
          {save.isSuccess && <Alert tone="success">Connection settings saved.</Alert>}
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save connection settings'}</Button>
        </form>
      )}
    </SettingsCard>
  );
}
