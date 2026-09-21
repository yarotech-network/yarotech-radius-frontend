import { useState } from 'react';
import { Wifi } from 'lucide-react';

export function TenantLogo({ url, name }: { url?: string | null | undefined; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2">
      {url && url !== failedUrl ? (
        <img src={url} alt={`${name} logo`} className="max-h-full max-w-full object-contain"
          referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
      ) : <Wifi className="size-8 text-brand-600" aria-label={`${name} storefront`} />}
    </div>
  );
}
