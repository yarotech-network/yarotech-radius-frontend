import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, Input } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { Pagination, SearchInput } from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { errorMessage, isApiError } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { pppoeApi } from '@/features/customers/pppoe';
import { BandwidthPicker } from '../components/BandwidthPicker';
import { ServicePlansNav } from '../components/ServicePlansNav';
import { Layers, Network, Plus, RefreshCw } from 'lucide-react';

export default function PPPoEPlansPage() {
  const manage = can(usePrincipal(), 'pppoe.manage');
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const query = useQuery({
    queryKey: ['pppoe-plans', 'list', debounced, page],
    queryFn: () => pppoeApi.plans({ search: debounced, page, page_size: 12 }),
  });
  const refresh = () => void client.invalidateQueries({ queryKey: ['pppoe-plans'] });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      pppoeApi.updatePlan(id, active),
    onSuccess: refresh,
  });
  return (
    <div className="space-y-5">
      {/* Premium Hero Header */}
      <div className="router-page-hero">
        <div className="router-page-hero-inner">
          <div className="router-page-hero-text">
            <span className="router-page-hero-eyebrow">
              <Network className="size-3" aria-hidden /> Fixed Subscriber Services
            </span>
            <h1 className="router-page-hero-title">PPPoE Plans</h1>
            <p className="router-page-hero-desc">
              Fixed subscriber access periods and bandwidth profiles for wired and wireless subscribers.
            </p>
          </div>
          <div className="router-page-hero-actions">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
            {manage && (
              <Button leadingIcon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
                New PPPoE plan
              </Button>
            )}
          </div>
        </div>

        {/* Hero Stats Strip */}
        <div className="router-page-hero-strip">
          <div className="router-page-hero-stat">
            <Layers className="size-4" aria-hidden />
            <span>
              {query.data
                ? `${query.data.count} PPPoE plan${query.data.count !== 1 ? 's' : ''}`
                : 'Loading PPPoE plans...'}
            </span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-stat">
            <Network className="size-4" aria-hidden />
            <span>Broadband & PPPoE Access</span>
          </div>
        </div>
      </div>
      <ServicePlansNav />
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search PPPoE plans"
      />
      {toggle.isError && (
        <Alert tone="danger" title="Plan could not be updated">
          {errorMessage(toggle.error)}
        </Alert>
      )}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <p role="status">Loading plans...</p>
      ) : query.data.count === 0 ? (
        <Card className="p-8 text-center">
          No PPPoE plans found. Create a plan using an active bandwidth profile.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.results.map((plan) => (
            <Card key={plan.id} className="space-y-3 p-5">
              <h2 className="text-lg font-semibold break-words">{plan.name}</h2>
              <p className="text-sm text-ink-500">
                {plan.is_active ? 'Available for new services' : 'Inactive'} - {plan.duration_hours}{' '}
                hours
              </p>
              <p className="text-2xl font-semibold">
                {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
                  plan.price / 100,
                )}
              </p>
              <p className="text-sm">
                {plan.bandwidth_profile_name} - {plan.rate_limit} up/down
              </p>
              {manage && (
                <Button
                  variant="secondary"
                  loading={toggle.isPending && toggle.variables?.id === plan.id}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: plan.id, active: !plan.is_active })}
                >
                  {plan.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
      {query.data && query.data.count > 0 && (
        <Pagination
          count={query.data.count}
          page={page}
          totalPages={query.data.total_pages}
          pageSize={12}
          onPageChange={setPage}
          itemLabel="plans"
        />
      )}
      <Dialog open={open} onClose={() => setOpen(false)} dismissible={!busy} title="New PPPoE plan">
        {open && (
          <PlanForm
            onBusy={setBusy}
            onSaved={() => {
              setOpen(false);
              refresh();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
function PlanForm({ onBusy, onSaved }: { onBusy: (b: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<number | null>(null);
  const [hours, setHours] = useState('720');
  const [price, setPrice] = useState('0');
  const [key, setKey] = useState(() => newIdempotencyKey('pppoe-plan'));
  const changed = () => setKey(newIdempotencyKey('pppoe-plan'));
  const save = useMutation({
    mutationFn: () => {
      if (!/^\d+(?:\.\d{1,2})?$/.test(price))
        throw new Error('Enter NGN with at most two decimal places.');
      const [whole, fraction = ''] = price.split('.');
      const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
      return pppoeApi.createPlan(
        { name, bandwidth_profile: profile!, duration_hours: Number(hours), price: minor },
        key,
      );
    },
    onSuccess: onSaved,
    onSettled: () => onBusy(false),
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onBusy(true);
        save.mutate();
      }}
    >
      {save.isError && (
        <Alert tone="danger" title="Plan could not be saved">
          {errorMessage(save.error)}
          {isApiError(save.error) && (
            <ul>
              {Object.values(save.error.fields)
                .flat()
                .map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
            </ul>
          )}
        </Alert>
      )}
      <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
        <label className="block space-y-1 text-sm">
          Plan name
          <Input
            required
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              changed();
            }}
          />
        </label>
        <BandwidthPicker
          value={profile}
          onChange={(p) => {
            setProfile(p?.id ?? null);
            changed();
          }}
        />
        <label className="block space-y-1 text-sm">
          Duration (hours)
          <Input
            type="number"
            min={1}
            max={8760}
            step={1}
            required
            value={hours}
            onChange={(e) => {
              setHours(e.target.value);
              changed();
            }}
          />
        </label>
        <label className="block space-y-1 text-sm">
          Price (NGN)
          <Input
            type="number"
            min={0}
            max={21474836.47}
            step="0.01"
            required
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              changed();
            }}
          />
        </label>
        <p className="text-xs text-ink-500">
          Duration, price and bandwidth are fixed after creation. Create another plan to offer
          different terms.
        </p>
      </fieldset>
      <Button type="submit" disabled={!profile} loading={save.isPending}>
        Create PPPoE plan
      </Button>
    </form>
  );
}
