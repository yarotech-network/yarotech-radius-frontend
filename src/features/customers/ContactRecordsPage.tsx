import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Users, Plus, Upload, ArrowRight } from 'lucide-react';
import { Button, Card, Dialog, ConfirmDialog, Select } from '@/components/ui';
import { ErrorState, useToast } from '@/components/feedback';
import { Pagination, SearchInput } from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { customersApi, customersKey, customerLabel, type Customer } from './api';
import { CustomerForm } from './CustomerForm';
import { CustomerImport } from './CustomerImport';
import { CustomerPurchases } from './CustomerPurchases';

export default function ContactRecordsPage() {
  const principal = usePrincipal();
  const scope =
    principal.kind === 'member'
      ? principal.tenantId
      : principal.kind === 'platform_staff'
        ? principal.activeTenantId
        : null;
  return (
    <ContactWorkspace
      key={`${principal.user.id}:${scope}`}
      scope={scope}
      actorId={principal.user.id}
    />
  );
}

function ContactWorkspace({ scope, actorId }: { scope: number | null; actorId: number }) {
  const manage = can(usePrincipal(), 'customers.manage');
  const client = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('current');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ customer?: Customer } | null>(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [lifecycle, setLifecycle] = useState<Customer | null>(null);
  const debounced = useDebouncedValue(search);
  const scopedKey = [...customersKey, actorId, scope];
  const params = { search: debounced, status, page, page_size: 12 };
  const query = useQuery({
    queryKey: [...scopedKey, 'list', params],
    queryFn: () => customersApi.list(params),
    enabled: scope !== null,
  });
  const detail = useQuery({
    queryKey: [...scopedKey, 'detail', selected],
    queryFn: () => customersApi.get(selected!),
    enabled: selected !== null && scope !== null,
  });
  const refresh = () => void client.invalidateQueries({ queryKey: scopedKey });
  const saved = () => {
    setEditor(null);
    setImporting(false);
    refresh();
    toast.success('Customer records saved');
  };
  return (
    <div className="space-y-6">
      {/* Premium Hero Header */}
      <div className="router-page-hero">
        <div className="router-page-hero-inner">
          <div className="router-page-hero-text">
            <span className="router-page-hero-eyebrow">
              <Users className="size-3" aria-hidden /> Customer Management
            </span>
            <h1 className="router-page-hero-title">Customer Directory</h1>
            <p className="router-page-hero-desc">
              Your subscriber directory with contact details, identity records, and purchase history.
            </p>
          </div>
          <div className="router-page-hero-actions">
            <Link
              to="/sessions"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm transition"
            >
              Live sessions <ArrowRight className="size-4" />
            </Link>
            {manage && (
              <>
                <Button
                  variant="secondary"
                  leadingIcon={<Upload className="size-4" aria-hidden />}
                  onClick={() => setImporting(true)}
                >
                  Import CSV
                </Button>
                <Button leadingIcon={<Plus className="size-4" aria-hidden />} onClick={() => setEditor({})}>
                  Add customer
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hero Stats Strip */}
        <div className="router-page-hero-strip">
          <div className="router-page-hero-stat">
            <Users className="size-4" aria-hidden />
            <span>
              {query.data
                ? `${query.data.count} registered customer${query.data.count !== 1 ? 's' : ''}`
                : 'Loading Directory...'}
            </span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-links">
            <Link to="/customers" className="router-page-hero-link">
              <Users className="size-3.5" aria-hidden /> Observed devices
            </Link>
          </div>
        </div>
      </div>
      <Card className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_12rem_auto] lg:items-center">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search name, reference, email or phone"
          />
        </div>
        <Select
          aria-label="Customer status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: 'current', label: 'Current records' },
            { value: 'archived', label: 'Archived records' },
            { value: '', label: 'All records' },
          ]}
        />
        <p className="shrink-0 text-sm text-ink-500" role="status">
          {query.data ? `${query.data.count} matching customers` : 'Loading customers?'}
        </p>
      </Card>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Card className="p-8 text-sm text-ink-500">Loading customer directory?</Card>
      ) : query.data.results.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <Users className="mx-auto mb-4 size-10 text-brand-600" />
          <h2 className="text-xl font-semibold">No customers found</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Add your first customer or adjust your filters. Existing voucher purchasers are not
            automatically added to this directory.
          </p>
          {manage && (
            <Button className="mt-5" onClick={() => setEditor({})}>
              Create customer
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.results.map((customer) => (
            <Card key={customer.id} className="flex min-w-0 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide break-all text-ink-500">
                    {customer.reference}
                  </p>
                  <button
                    className="mt-2 text-left text-lg font-semibold break-words text-brand-950 hover:underline"
                    onClick={() => setSelected(customer.id)}
                  >
                    {customerLabel(customer)}
                  </button>
                </div>
                <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-xs text-ink-600">
                  {customer.archived_at ? 'Archived' : 'Current'}
                </span>
              </div>
              <div className="mt-4 flex-1 space-y-1 text-sm break-words text-ink-500">
                <p>{customer.email || 'No email address'}</p>
                <p>{customer.phone || 'No phone number'}</p>
                <p className="pt-3 text-xs">
                  {customer.has_service ? 'PPPoE service assigned' : 'No service assigned'}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="secondary" size="sm" onClick={() => setSelected(customer.id)}>
                  View details
                </Button>
                {manage && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!customer.archived_at}
                      onClick={() => setEditor({ customer })}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setLifecycle(customer)}>
                      {customer.archived_at ? 'Restore' : 'Archive'}
                    </Button>
                  </>
                )}
              </div>
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
          itemLabel="customers"
        />
      )}
      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        dismissible={!busy}
        title={editor?.customer ? 'Edit customer' : 'Add customer'}
        size="lg"
      >
        {editor && (
          <CustomerForm
            {...(editor.customer ? { customer: editor.customer } : {})}
            onSaved={saved}
            onBusy={setBusy}
            onCancel={() => setEditor(null)}
          />
        )}
      </Dialog>
      <Dialog
        open={importing}
        onClose={() => setImporting(false)}
        dismissible={!busy}
        title="Import customers"
        size="lg"
      >
        {importing && <CustomerImport onSaved={saved} onBusy={setBusy} />}
      </Dialog>
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Customer details"
        dismissible={!busy}
        size="lg"
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        ) : detail.data ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold break-words">{customerLabel(detail.data)}</h2>
            <dl className="space-y-3 text-sm">
              {[
                ['Reference', detail.data.reference],
                ['Record status', detail.data.archived_at ? 'Archived' : 'Current'],
                ['Email', detail.data.email],
                ['Phone', detail.data.phone],
                ['Contact MAC (not verified device ownership)', detail.data.mac_address],
                ['Address', detail.data.address],
                ['Internal notes', detail.data.notes],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-medium text-ink-500">{label}</dt>
                  <dd className="break-words whitespace-pre-wrap">{value || 'Not provided'}</dd>
                </div>
              ))}
            </dl>
            {manage && (
              <CustomerPurchases
                key={detail.data.id}
                customerId={detail.data.id}
                scope={scope}
                actorId={actorId}
              />
            )}
            <p className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
              Manage equipment access from{' '}
              <a href="/devices" className="font-semibold text-brand-700 underline">
                IoT / MAC Devices
              </a>
              .
            </p>
          </div>
        ) : (
          <p role="status">Loading customer details...</p>
        )}
      </Dialog>
      <ConfirmDialog
        open={lifecycle !== null}
        onClose={() => setLifecycle(null)}
        title={`${lifecycle?.archived_at ? 'Restore' : 'Archive'} customer?`}
        description={
          lifecycle?.archived_at
            ? 'Return this record to the current directory. This does not activate internet service.'
            : 'Retain this customer and their reference in the archive. This does not disconnect a network session.'
        }
        confirmLabel={lifecycle?.archived_at ? 'Restore customer' : 'Archive customer'}
        onConfirm={async () => {
          if (lifecycle) {
            await (lifecycle.archived_at
              ? customersApi.restore(lifecycle.id)
              : customersApi.archive(lifecycle.id));
            setPage(1);
            refresh();
            toast.success('Customer record updated');
          }
        }}
      />
    </div>
  );
}
