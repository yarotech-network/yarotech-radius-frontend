import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Gauge, Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, Dialog, Input, Select, ConfirmDialog, Checkbox } from '@/components/ui';
import { Alert, EmptyState, ErrorState, useToast } from '@/components/feedback';
import { Pagination, SearchInput } from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { errorMessage } from '@/services/api/errors';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import {
  bandwidthApi,
  bandwidthKey,
  formatSpeed,
  toKbps,
  useBandwidth,
  type BandwidthProfile,
} from '../bandwidth';
import { ServicePlansNav } from '../components/ServicePlansNav';

export default function BandwidthPage() {
  const manage = can(usePrincipal(), 'plans.manage');
  const client = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<{ profile?: BandwidthProfile } | null>(null);
  const [deleting, setDeleting] = useState<BandwidthProfile | null>(null);
  const debounced = useDebouncedValue(search);
  const query = useBandwidth({
    page,
    page_size: 12,
    search: debounced,
    ...(status ? { is_active: status === 'true' } : {}),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: bandwidthKey });
    void client.invalidateQueries({ queryKey: ['plans'] });
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bandwidth Control"
        description="Reusable upload and download speeds for your Hotspot packages."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              leadingIcon={<RefreshCw />}
              onClick={() => void query.refetch()}
            >
              Refresh profiles
            </Button>
            {manage && (
              <Button leadingIcon={<Plus />} onClick={() => setEditor({})}>
                New profile
              </Button>
            )}
          </div>
        }
      />
      <ServicePlansNav />
      <Card className="border-brand-100 bg-brand-50">
        <div className="flex items-start gap-4">
          <Gauge className="mt-1 size-7 shrink-0 text-brand-600" />
          <div>
            <h2 className="text-lg font-semibold text-brand-950">
              One speed profile. Multiple packages.
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-600">
              Choose speeds once, then reuse them across daily, weekly and monthly plans. Profile
              speeds stay fixed so editing a name or deactivating a profile cannot change an issued
              voucher's speed.
            </p>
          </div>
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            ariaLabel="Search bandwidth profiles"
            placeholder="Search profiles"
          />
        </div>
        <div className="w-44">
          <Select
            aria-label="Profile status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All profiles' },
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
          />
        </div>
        <span className="text-sm text-ink-500" role="status">
          {query.data ? `${query.data.count} matching profiles` : 'Loading profiles...'}
        </span>
      </div>
      {query.isPending && <p role="status">Loading bandwidth profiles...</p>}
      {query.isError && (
        <ErrorState
          title="Bandwidth profiles unavailable"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.data && query.data.count === 0 && (
        <EmptyState
          icon={<Gauge />}
          title="No bandwidth profiles"
          description="Create a reusable speed, or keep using custom speeds on existing plans."
          action={
            manage ? <Button onClick={() => setEditor({})}>Create first profile</Button> : undefined
          }
        />
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {query.data?.results.map((profile) => (
          <Card key={profile.id} className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 text-lg font-bold break-words text-brand-950">
                {profile.name}
              </h2>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${profile.is_active ? 'bg-success-50 text-success-700' : 'bg-surface-muted text-ink-600'}`}
              >
                {profile.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-brand-50 p-3">
                <span className="flex items-center gap-1 text-xs text-ink-600">
                  <ArrowUp className="size-3" />
                  Upload
                </span>
                <strong className="mt-1 block text-lg text-brand-800">
                  {formatSpeed(profile.upload_kbps)}
                </strong>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <span className="flex items-center gap-1 text-xs text-ink-600">
                  <ArrowDown className="size-3" />
                  Download
                </span>
                <strong className="mt-1 block text-lg">{formatSpeed(profile.download_kbps)}</strong>
              </div>
            </div>
            <p className="text-xs text-ink-500">
              {typeof profile.plan_count === 'number'
                ? `${profile.plan_count} linked plans`
                : 'Plan usage unavailable'}
            </p>
            {manage && (
              <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                <Button variant="secondary" size="sm" onClick={() => setEditor({ profile })}>
                  Edit {profile.name}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(profile)}>
                  Delete
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      {query.data && query.data.count > 0 && (
        <Pagination
          count={query.data.count}
          page={page}
          totalPages={query.data.total_pages}
          pageSize={12}
          onPageChange={setPage}
          itemLabel="profiles"
        />
      )}
      <Dialog
        open={editor !== null}
        dismissible={!saving}
        onClose={() => setEditor(null)}
        title={editor?.profile ? 'Edit bandwidth profile' : 'New bandwidth profile'}
        description="Speeds are fixed after creation. Create another profile when you need different speeds."
      >
        {editor && (
          <ProfileForm
            onBusy={setSaving}
            {...(editor.profile ? { profile: editor.profile } : {})}
            onSaved={() => {
              setEditor(null);
              refresh();
              toast.success('Bandwidth profile saved');
            }}
            onCancel={() => setEditor(null)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'profile'}?`}
        description="Profiles linked to plans cannot be deleted. Deactivate them instead to stop new assignments."
        confirmLabel="Delete profile"
        tone="danger"
        onConfirm={async () => {
          if (deleting) await bandwidthApi.remove(deleting.id);
          refresh();
          toast.success('Profile deleted');
        }}
      />
    </div>
  );
}

function ProfileForm({
  profile,
  onSaved,
  onCancel,
  onBusy,
}: {
  onBusy: (busy: boolean) => void;
  profile?: BandwidthProfile;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(profile?.name ?? '');
  const [upload, setUpload] = useState(profile ? String(profile.upload_kbps) : '5');
  const [download, setDownload] = useState(profile ? String(profile.download_kbps) : '10');
  const [upUnit, setUpUnit] = useState(profile ? 'kbps' : 'Mbps');
  const [downUnit, setDownUnit] = useState(profile ? 'kbps' : 'Mbps');
  const [active, setActive] = useState(profile?.is_active ?? true);
  const [key] = useState(() => newIdempotencyKey('bandwidth'));
  const save = useMutation({
    mutationFn: async () =>
      profile
        ? bandwidthApi.update(profile.id, { name, is_active: active })
        : bandwidthApi.create(
            {
              name,
              upload_kbps: toKbps(upload, upUnit),
              download_kbps: toKbps(download, downUnit),
              is_active: active,
            },
            key,
          ),
    onSuccess: onSaved,
    onSettled: () => onBusy(false),
  });
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onBusy(true);
        save.mutate();
      }}
    >
      {save.isError && (
        <Alert tone="danger" title="Profile could not be saved">
          {errorMessage(save.error)}
        </Alert>
      )}
      <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
        <label className="block space-y-1 text-sm font-medium">
          Profile name
          <Input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Home standard"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: 'Upload', value: upload, set: setUpload, unit: upUnit, setUnit: setUpUnit },
            {
              label: 'Download',
              value: download,
              set: setDownload,
              unit: downUnit,
              setUnit: setDownUnit,
            },
          ].map((f) => (
            <div key={f.label} className="space-y-2">
              <label className="block space-y-1 text-sm font-medium">
                {f.label} speed
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  value={f.value}
                  readOnly={!!profile}
                  onChange={(e) => f.set(e.target.value)}
                />
              </label>
              <Select
                aria-label={`${f.label} unit`}
                value={f.unit}
                disabled={!!profile}
                onChange={(e) => f.setUnit(e.target.value)}
                options={[
                  { value: 'Mbps', label: 'Mbps' },
                  { value: 'kbps', label: 'kbps' },
                ]}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-500">
          1 Mbps = 1,000 kbps. Limits are from the customer's perspective.
        </p>
        <Checkbox
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          label="Active profile"
          description="Inactive profiles keep working for linked plans; they cannot be assigned to another plan."
        />
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" disabled={save.isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {profile ? 'Save profile' : 'Create profile'}
        </Button>
      </div>
    </form>
  );
}
