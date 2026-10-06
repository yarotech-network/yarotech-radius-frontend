import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { Button, Card } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { TenantLogo } from './TenantLogo';

type Logo = { logo_url: string | null };
const path = '/tenants/logo/';

export function LogoSettings() {
  const principal = usePrincipal();
  if (principal.kind !== 'member' || principal.role !== 'owner') return null;
  return <LogoForm key={principal.tenantId} tenantId={principal.tenantId} />;
}

function LogoForm({ tenantId }: { tenantId: number }) {
  const client = useQueryClient();
  const key = ['tenant-logo', tenantId];
  const query = useQuery({ queryKey: key, queryFn: () => http.get<Logo>(path), retry: false });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrl = useRef<string | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const lock = useRef(false);
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  function clearPreview() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPreview(null);
    setFile(null);
  }
  const mutation = useMutation({
    mutationFn: async (upload: File | null) => {
      if (!upload) {
        await http.delete(path);
        return { logo_url: null };
      }
      const data = new FormData();
      data.append('logo', upload);
      return http.put<Logo>(path, data);
    },
    onSuccess: (data) => {
      client.setQueryData(key, data);
      void client.invalidateQueries({ queryKey: ['storefront', 'tenant'] });
      clearPreview();
      if (input.current) input.current.value = '';
    },
  });
  function save(upload: File | null) {
    if (lock.current) return;
    lock.current = true;
    setError('');
    void mutation
      .mutateAsync(upload)
      .catch(() => undefined)
      .finally(() => {
        lock.current = false;
      });
  }
  return (
    <Card className="min-w-0">
      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
        <div>
          <h2 className="text-base font-semibold text-brand-950">Storefront logo</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Shown at the top of your storefront. PNG, JPEG or WebP up to 2 MB, static images only,
            up to 4096 pixels per side.
          </p>
        </div>
        {query.isPending ? (
          <p role="status" className="text-sm text-ink-500">
            Loading logo…
          </p>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <TenantLogo url={preview ?? query.data.logo_url} name="Your business" />
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  ref={input}
                  id={inputId}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={mutation.isPending}
                  className="peer sr-only"
                  onChange={(event) => {
                    mutation.reset();
                    setError('');
                    clearPreview();
                    const selected = event.target.files?.[0];
                    if (!selected) return;
                    if (
                      selected.size > 2 * 1024 * 1024 ||
                      !['image/png', 'image/jpeg', 'image/webp'].includes(selected.type)
                    ) {
                      setError('Choose a PNG, JPEG or WebP file no larger than 2 MB.');
                      event.target.value = '';
                      return;
                    }
                    const url = URL.createObjectURL(selected);
                    previewUrl.current = url;
                    setPreview(url);
                    setFile(selected);
                  }}
                />
                <label
                  htmlFor={inputId}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-xs font-medium text-ink-900 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 hover:border-border-strong hover:bg-surface-muted"
                >
                  Choose logo
                </label>
                <p className="truncate text-xs text-ink-500" title={file?.name}>
                  {file
                    ? `Selected: ${file.name}`
                    : query.data.logo_url
                      ? 'Your current logo is shown.'
                      : 'No logo yet. A Wi-Fi icon is shown instead.'}
                </p>
              </div>
            </div>
            {error && <Alert tone="danger">{error}</Alert>}
            {mutation.isError && (
              <ErrorState error={mutation.error} title="Logo could not be saved" />
            )}
            {mutation.isSuccess && <Alert tone="success">Storefront logo updated.</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!file || mutation.isPending}
                onClick={() => {
                  if (file) save(file);
                }}
              >
                Save logo
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!query.data.logo_url || mutation.isPending}
                onClick={() => save(null)}
              >
                Remove logo
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
