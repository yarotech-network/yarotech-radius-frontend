import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, FormField, Select } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { usePrincipal } from '@/app/auth/useAuth';
import { useDevicePlans } from '../queries';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import { formatDateTime } from '@/lib/formatting/dates';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type { MacDevice, Paginated } from '@/types/api';
import { devicesApi } from '../api';
import { deviceKeys } from '../queries';

type Renewal = {
  id: number;
  previous_expiry: string | null;
  expires_at: string;
  created_at: string;
  terms: { name: string; duration_seconds: number; source: string };
};

export function DeviceLifecycleDialog({
  device,
  onClose,
}: {
  device: MacDevice;
  onClose: () => void;
}) {
  const principal = usePrincipal();
  const scope =
    principal.kind === 'member'
      ? principal.tenantId
      : principal.kind === 'platform_staff'
        ? principal.activeTenantId
        : null;
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('renew');
  const [plan, setPlan] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const key = useRef(newIdempotencyKey('device-lifecycle'));
  const latest = useQuery({
    queryKey: [...deviceKeys.all, 'detail', principal.user.id, scope, device.id],
    queryFn: () => devicesApi.get(device.id),
    enabled: scope !== null,
  });
  const current = latest.data ?? device;
  const plans = useDevicePlans(true);
  const options = (plans.data ?? []).filter(
    (p) => p.plan_type === 'iot_mac' && (!p.public_router || p.public_router === current.router),
  );
  const history = useQuery({
    queryKey: [...deviceKeys.all, 'renewals', principal.user.id, scope, device.id, page],
    queryFn: () =>
      http.get<Paginated<Renewal>>(`/iot-devices/${device.id}/renewals/`, { page, page_size: 10 }),
    enabled: scope !== null,
  });
  const operation = useRef<{ action: string; plan: number; version: number } | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!operation.current) {
        if (!current.version) throw new Error('Reload the device before making changes.');
        operation.current = { action, plan: Number(plan), version: current.version };
      }
      const intent = operation.current;
      return intent.action === 'renew'
        ? devicesApi.renew(device.id, intent.plan, intent.version, key.current)
        : devicesApi.lifecycle(device.id, intent.action, intent.version, key.current);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: deviceKeys.all });
      onClose();
    },
  });
  const terminal = current.status === 'deleted';
  const renewable = !terminal && current.status !== 'revoked' && current.access_type === 'timed';
  return (
    <Dialog open onClose={onClose} size="lg" title={`Manage ${device.device_name}`}>
      <div className="space-y-4">
        <Alert tone="info">
          {current.network_enforcement === 'rest_configured'
            ? 'RADIUS integration is configured. Changes are checked on the next authentication; changing a status does not confirm an immediate disconnection.'
            : 'These controls update the registration only. Network enforcement is not connected; changing a status does not confirm a disconnection.'}
        </Alert>
        <p>
          Status: {current.status ?? (current.is_active ? 'active' : 'suspended')}. Deadline:{' '}
          {current.expires_at ? formatDateTime(current.expires_at) : 'Permanent'}.
        </p>
        {latest.isError && (
          <ErrorState error={latest.error} onRetry={() => void latest.refetch()} />
        )}
        {!terminal && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
              mutation.mutate();
            }}
          >
            <FormField label="Device action">
              <Select
                value={action}
                disabled={submitted}
                onChange={(event) => setAction(event.target.value)}
                options={[
                  { value: 'renew', label: 'Renew timed registration', disabled: !renewable },
                  {
                    value: 'suspend',
                    label: 'Suspend registration',
                    disabled: current.status === 'revoked',
                  },
                  { value: 'reactivate', label: 'Reactivate registration' },
                  { value: 'revoke', label: 'Revoke registration' },
                ]}
              />
            </FormField>
            {action === 'renew' && (
              <>
                <p>
                  Unused time is retained. The selected period is added to the later of the current
                  deadline and now. Suspended devices stay suspended. This is an operator grant; no
                  payment is recorded.
                </p>
                <FormField label="Renewal plan" required>
                  <Select
                    value={plan}
                    onChange={(event) => setPlan(event.target.value)}
                    disabled={submitted || plans.isPending}
                    options={[
                      { value: '', label: 'Choose an IoT plan' },
                      ...options.map((p) => ({
                        value: String(p.id),
                        label: `${p.name} (${p.duration_hours} hours)`,
                      })),
                    ]}
                  />
                </FormField>
                {plans.isError && (
                  <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
                )}
                {!renewable && <p>This device cannot be renewed in its current state.</p>}
              </>
            )}
            {mutation.isError && (
              <Alert tone="danger">
                {errorMessage(mutation.error)} Retry uses the same request. To review a stale
                device, close this dialog and open it again.
              </Alert>
            )}
            <Button
              type="submit"
              loading={mutation.isPending}
              disabled={
                !latest.data ||
                latest.isError ||
                !current.version ||
                (action === 'renew' && (!renewable || !plan))
              }
            >
              {submitted
                ? 'Retry same request'
                : action === 'renew'
                  ? 'Confirm renewal grant'
                  : 'Confirm status change'}
            </Button>
          </form>
        )}
        <section
          aria-label="Device renewal history"
          className="space-y-3 border-t border-border pt-4"
        >
          <h3 className="font-semibold">Renewal history</h3>
          {history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : !history.data ? (
            <p role="status">Loading renewals...</p>
          ) : (
            <>
              {!history.data.results.length && (
                <p>No recorded operator renewals. Older grants may not have renewal records.</p>
              )}
              <ul>
                {history.data.results.map((row) => (
                  <li key={row.id} className="border-b border-border py-3">
                    <p>
                      {row.terms.name}: {row.terms.duration_seconds / 3600} hours granted
                    </p>
                    <p>Previous deadline: {formatDateTime(row.previous_expiry)}</p>
                    <p>New deadline: {formatDateTime(row.expires_at)}</p>
                    <p>Granted: {formatDateTime(row.created_at)}. {row.terms.source === 'paid_purchase' ? 'Verified purchase.' : 'No payment recorded.'}</p>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous renewals
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= history.data.total_pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next renewals
                </Button>
              </div>
            </>
          )}
        </section>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
