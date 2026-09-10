import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button, Input, Select } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { errorMessage, isApiError } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { pppoeApi, type PPPoEService } from './pppoe';

export function ServicePanel({
  customer,
  archived,
  onBusy,
}: {
  customer: number;
  archived: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const manage = can(usePrincipal(), 'customers.manage');
  const client = useQueryClient();
  const [mode, setMode] = useState<{ action: string; service?: PPPoEService } | null>(null);
  const query = useQuery({
    queryKey: ['pppoe-services', customer],
    queryFn: () => pppoeApi.services(customer),
  });
  const saved = () => {
    setMode(null);
    void client.invalidateQueries({ queryKey: ['pppoe-services'] });
    void client.invalidateQueries({ queryKey: ['customers'] });
  };
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending) return <p role="status">Loading service...</p>;
  const service = query.data.results[0];
  return (
    <section className="space-y-4 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">PPPoE service</h3>
        <Button
          size="sm"
          variant="secondary"
          disabled={!!mode || query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh service
        </Button>
      </div>
      <p className="text-sm text-ink-500">
        PAP authentication requires the dedicated FreeRADIUS integration and an active assigned
        router. Configured does not mean connected. Connections reauthenticate at least hourly.
      </p>
      {service ? (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ['Username', service.username],
              ['Plan', service.plan_name],
              ['Router', service.router_name],
              ['Speed (up/down)', service.rate_limit],
              ['Service status', service.status],
              ['Access expires', new Date(service.expires_at).toLocaleString()],
              ['Session cleanup', service.disconnect_state],
              [
                'Last reconciliation',
                service.last_reconciled_at
                  ? new Date(service.last_reconciled_at).toLocaleString()
                  : 'Not run yet',
              ],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="font-medium text-ink-500">{label}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-ink-500">
            A disconnect acknowledgment still needs a stop-accounting update. Passwords cannot be
            retrieved.
          </p>
          {manage && !mode && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={archived}
                onClick={() => setMode({ action: 'renew', service })}
              >
                Renew service
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={archived && service.suspended}
                onClick={() =>
                  setMode({ action: service.suspended ? 'resume' : 'suspend', service })
                }
              >
                {service.suspended ? 'Resume service' : 'Suspend service'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setMode({ action: 'password', service })}
              >
                Replace password
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-ink-500">No service assigned</p>
          {manage && !archived && !mode && (
            <Button onClick={() => setMode({ action: 'assign' })}>Assign PPPoE service</Button>
          )}
        </>
      )}
      {mode &&
        (mode.action === 'assign' ? (
          <AssignmentForm
            customer={customer}
            onSaved={saved}
            onBusy={onBusy}
            onCancel={() => setMode(null)}
          />
        ) : (
          <ActionForm
            service={mode.service!}
            action={mode.action}
            onSaved={saved}
            onBusy={onBusy}
            onCancel={() => setMode(null)}
          />
        ))}
    </section>
  );
}
function Failure({ error }: { error: unknown }) {
  return (
    <Alert tone="danger" title="Service could not be saved">
      <p>{errorMessage(error)}</p>
      {isApiError(error) && (
        <ul>
          {Object.values(error.fields)
            .flat()
            .map((message, index) => (
              <li key={index}>{message}</li>
            ))}
        </ul>
      )}
    </Alert>
  );
}
function AssignmentForm({
  customer,
  onSaved,
  onBusy,
  onCancel,
}: {
  customer: number;
  onSaved: () => void;
  onBusy: (b: boolean) => void;
  onCancel: () => void;
}) {
  const [plan, setPlan] = useState('');
  const [router, setRouter] = useState('');
  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const debouncedPlan = useDebouncedValue(planSearch);
  const plans = useQuery({
    queryKey: ['pppoe-plans', 'select', debouncedPlan],
    queryFn: () => pppoeApi.plans({ is_active: true, page_size: 100, search: debouncedPlan }),
  });
  const routers = useQuery({
    queryKey: ['routers', 'pppoe-select', debounced],
    queryFn: () => pppoeApi.routers(debounced),
  });
  const [key, setKey] = useState(() => newIdempotencyKey('pppoe-assign'));
  const save = useMutation({
    mutationFn: () => pppoeApi.create({ customer, plan: Number(plan), router, password }, key),
    onSuccess: () => {
      setPassword('');
      onSaved();
    },
    onSettled: () => onBusy(false),
  });
  const changed = () => {
    save.reset();
    setKey(newIdempotencyKey('pppoe-assign'));
  };
  return (
    <form
      className="space-y-4 rounded-xl border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onBusy(true);
        save.mutate();
      }}
    >
      <h4 className="font-semibold">Assign service</h4>
      {save.isError && <Failure error={save.error} />}
      <fieldset disabled={save.isPending} className="min-w-0 space-y-3">
        <label className="block space-y-1 text-sm">
          Find PPPoE plans
          <Input
            value={planSearch}
            onChange={(e) => {
              setPlanSearch(e.target.value);
              setPlan('');
              changed();
            }}
          />
        </label>
        <label className="block space-y-1 text-sm">
          PPPoE plan
          <Select
            aria-label="PPPoE plan"
            required
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              changed();
            }}
            options={[
              { value: '', label: 'Choose a plan' },
              ...(plans.data?.results ?? []).map((p) => ({
                value: String(p.id),
                label: `${p.name} - ${p.duration_hours} hours`,
              })),
            ]}
          />
        </label>
        <Link to="/plans/pppoe" className="text-sm text-brand-600 underline">
          Manage PPPoE plans
        </Link>
        <label className="block space-y-1 text-sm">
          Find routers
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setRouter('');
              changed();
            }}
          />
        </label>
        <label className="block space-y-1 text-sm">
          Assigned router
          <Select
            aria-label="Assigned router"
            required
            value={router}
            onChange={(e) => {
              setRouter(e.target.value);
              changed();
            }}
            options={[
              { value: '', label: 'Choose a router' },
              ...(routers.data?.results ?? [])
                .filter((r) => r.is_active)
                .map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </label>
        {(plans.isError || routers.isError) && (
          <Alert tone="danger" title="Options unavailable">
            <Button
              variant="secondary"
              onClick={() => {
                void plans.refetch();
                void routers.refetch();
              }}
            >
              Retry options
            </Button>
          </Alert>
        )}
        {(plans.data?.total_pages ?? 0) > 1 || (routers.data?.total_pages ?? 0) > 1 ? (
          <p className="text-xs text-ink-500">
            Showing the first 100 matches. Narrow the search to find another option.
          </p>
        ) : null}
        <label className="block space-y-1 text-sm">
          PPPoE password
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              changed();
            }}
          />
        </label>
        <p className="text-xs text-ink-500">
          Save the password securely for the customer device. The access period begins immediately;
          no payment is collected.
        </p>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={save.isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={save.isPending}
          disabled={!plan || !router || plans.isError || routers.isError}
        >
          Assign service
        </Button>
      </div>
    </form>
  );
}
function ActionForm({
  service,
  action,
  onSaved,
  onBusy,
  onCancel,
}: {
  service: PPPoEService;
  action: string;
  onSaved: () => void;
  onBusy: (b: boolean) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [key, setKey] = useState(() => newIdempotencyKey('pppoe-' + action));
  const save = useMutation({
    mutationFn: () => pppoeApi.action(service, action, password, key),
    onSuccess: () => {
      setPassword('');
      onSaved();
    },
    onSettled: () => onBusy(false),
  });
  const message =
    action === 'renew'
      ? `Extend access by ${service.period_hours} hours from the current expiry or now, whichever is later. This records no payment and does not resume a suspension.`
      : action === 'suspend'
        ? 'Block new authentication now. Existing sessions are queued for disconnect.'
        : action === 'resume'
          ? 'Allow authentication again if the subscription is not expired.'
          : 'Replace the device password and queue old sessions for disconnect.';
  return (
    <form
      className="space-y-4 rounded-xl border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onBusy(true);
        save.mutate();
      }}
    >
      <p className="text-sm">{message}</p>
      {save.isError && <Failure error={save.error} />}
      {action === 'password' && (
        <label className="block space-y-1 text-sm">
          New PPPoE password
          <Input
            disabled={save.isPending}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setKey(newIdempotencyKey('pppoe-password'));
              save.reset();
            }}
          />
        </label>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={save.isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          Confirm {action}
        </Button>
      </div>
    </form>
  );
}
