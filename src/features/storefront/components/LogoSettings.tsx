import { useEffect, useRef, useState } from 'react';
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
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const mutation = useMutation({
    mutationFn: async (upload: File | null) => {
      if (!upload) { await http.delete(path); return { logo_url: null }; }
      const data = new FormData(); data.append('logo', upload);
      return http.put<Logo>(path, data);
    },
    onSuccess: (data) => {
      client.setQueryData(key, data);
      void client.invalidateQueries({ queryKey: ['storefront', 'tenant'] });
      setFile(null);
      if (input.current) input.current.value = '';
    },
  });
  function save(upload: File | null) {
    if (lock.current) return;
    lock.current = true;
    setError('');
    void mutation.mutateAsync(upload).catch(() => undefined).finally(() => { lock.current = false; });
  }
  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-lg font-semibold">Storefront logo</h2>
      <p className="text-sm text-ink-600">Upload a PNG, JPEG or WebP image up to 2 MB. Static images only, up to 4096 pixels per side.</p>
      {query.isPending ? <p role="status">Loading logo…</p> : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : <>
        <TenantLogo url={preview ?? query.data.logo_url} name="Your business" />
        <label className="block space-y-2">
          <span>Choose logo</span>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={mutation.isPending}
            className="block w-full text-sm" onChange={(event) => {
              mutation.reset(); setError(''); setFile(null);
              const selected = event.target.files?.[0];
              if (!selected) return;
              if (selected.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(selected.type)) {
                setError('Choose a PNG, JPEG or WebP file no larger than 2 MB.');
                event.target.value = ''; return;
              }
              setFile(selected);
            }} />
        </label>
        {error && <Alert tone="danger">{error}</Alert>}
        {mutation.isError && <ErrorState error={mutation.error} title="Logo could not be saved" />}
        {mutation.isSuccess && <Alert tone="success">Storefront logo updated.</Alert>}
        <div className="flex flex-wrap gap-3">
          <Button disabled={!file || mutation.isPending} onClick={() => { if (file) save(file); }}>Save logo</Button>
          <Button variant="secondary" disabled={!query.data.logo_url || mutation.isPending} onClick={() => save(null)}>Remove logo</Button>
        </div>
      </>}
    </Card>
  );
}
