import { useState } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { errorMessage, isApiError } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { customersApi, type Preview } from './api';

export function CustomerImport({
  onSaved,
  onBusy,
}: {
  onSaved: () => void;
  onBusy: (value: boolean) => void;
}) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => newIdempotencyKey('customer-import'));
  const update = (value: string) => {
    setCsv(value);
    setPreview(null);
    setError(null);
    setKey(newIdempotencyKey('customer-import'));
  };
  const run = async (confirm: boolean) => {
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      if (confirm && preview) {
        await customersApi.confirm(csv, preview.preview_token, key);
        onSaved();
      } else {
        setPreview(await customersApi.preview(csv));
        setKey(newIdempotencyKey('customer-import'));
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">
        Import up to 200 customer records. Every row must be valid; duplicates, including archived
        references, stop the entire import. No service is activated.
      </p>
      {error != null && (
        <Alert tone="danger" title="Import could not continue">
          <p>{errorMessage(error)}</p>
          {isApiError(error) && (
            <ul className="mt-2 space-y-1">
              {Object.entries(error.fields).flatMap(([field, messages]) =>
                messages.map((message, index) => <li key={`${field}-${index}`}>{message}</li>),
              )}
            </ul>
          )}
        </Alert>
      )}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <label className="block space-y-1 text-sm font-medium">
          Choose CSV file
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setPreview(null);
              setError(null);
              if (file.size > 262144) {
                setError(new Error('CSV must be at most 256 KiB.'));
                return;
              }
              setBusy(true);
              onBusy(true);
              try {
                update(await file.text());
              } catch {
                setError(new Error('Could not read this file.'));
              } finally {
                setBusy(false);
                onBusy(false);
              }
            }}
          />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          CSV content
          <Textarea
            rows={6}
            maxLength={262144}
            value={csv}
            onChange={(event) => update(event.target.value)}
            placeholder={
              'reference,name,email,phone,address,notes\nCUST-001,Ada Obi,ada@example.com,,,'
            }
          />
        </label>
        <p className="text-xs text-ink-500">
          Required headers: reference,name. Name values may be blank. Optional:
          email,phone,address,notes,mac_address. Quote values that contain commas.
        </p>
      </fieldset>
      {preview && (
        <section aria-label="Import preview" className="rounded-xl border border-border p-4">
          <h3 className="font-semibold">{preview.count} customers ready to import</h3>
          <p className="mt-1 text-xs text-ink-500">
            Preview expires after 15 minutes. References are checked again when you confirm.
          </p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {preview.rows.map((row) => (
              <li
                key={row.reference}
                className="rounded-lg bg-surface-muted p-3 text-sm break-words"
              >
                <strong>{row.name || row.phone || row.email || row.reference}</strong>
                <div className="text-ink-500">
                  {row.reference} ? {row.email || 'No email'}
                </div>
                {row.phone && <div>{row.phone}</div>}
                {row.address && <div>{row.address}</div>}
                {row.notes && <div>{row.notes}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={!csv || busy} onClick={() => void run(false)}>
          Preview import
        </Button>
        <Button disabled={!preview || busy} loading={busy} onClick={() => void run(true)}>
          Confirm import
        </Button>
      </div>
    </div>
  );
}
