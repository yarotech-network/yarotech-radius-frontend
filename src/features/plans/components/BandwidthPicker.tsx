import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button, Input, Select } from '@/components/ui';
import { Alert } from '@/components/feedback';
import {
  bandwidthApi,
  bandwidthKey,
  formatSpeed,
  useBandwidth,
  type BandwidthProfile,
} from '../bandwidth';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';

export function BandwidthPicker({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (profile: BandwidthProfile | null) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const query = useBandwidth({ is_active: true, page_size: 100, search: debounced });
  const selected = useQuery({
    queryKey: [...bandwidthKey, 'detail', value],
    queryFn: () => bandwidthApi.get(value!),
    enabled: !!value,
  });
  const options = [
    ...(selected.data ? [selected.data] : []),
    ...(query.data?.results ?? []).filter((p) => p.id !== selected.data?.id),
  ];
  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">
        Find bandwidth profiles
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search profile name"
        />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Bandwidth profile
        <Select
          aria-label="Bandwidth profile"
          value={value ? String(value) : ''}
          disabled={query.isPending}
          onChange={(e) => onChange(options.find((p) => String(p.id) === e.target.value) ?? null)}
          options={[
            { value: '', label: query.isPending ? 'Loading profiles...' : 'Choose a profile' },
            ...options.map((p) => ({
              value: String(p.id),
              label: `${p.name} - ${formatSpeed(p.upload_kbps)} up / ${formatSpeed(p.download_kbps)} down${p.is_active ? '' : ' (inactive)'}`,
            })),
          ]}
        />
      </label>
      {(query.isError || selected.isError) && (
        <Alert tone="warning" title="Profiles could not be loaded">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void query.refetch();
              if (value) void selected.refetch();
            }}
          >
            Retry profiles
          </Button>
        </Alert>
      )}
      {query.data && query.data.count === 0 && (
        <p className="text-sm text-ink-500">
          No active profiles match.{' '}
          <Link className="text-brand-600 underline" to="/plans/bandwidth">
            Create a bandwidth profile
          </Link>{' '}
          or use a custom speed.
        </p>
      )}
      {query.data && query.data.total_pages > 1 && (
        <p className="text-xs text-ink-500">
          Showing the first 100 matches. Narrow your search to find another profile.
        </p>
      )}
    </div>
  );
}
