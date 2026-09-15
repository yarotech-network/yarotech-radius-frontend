import { useState } from 'react';
import { Button } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';

export function OwnerSetupNotice({ tenantId }: { tenantId: number }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  return (
    <Alert tone="warning" title="Owner setup pending">
      <p>The owner must use their email setup link to choose a password before signing in.</p>
      <Button
        className="mt-2"
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setSent(false);
          setError('');
          try {
            await http.post(`/tenants/${tenantId}/resend-owner-setup/`);
            setSent(true);
          } catch (cause) {
            setError(errorMessage(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        Resend setup email
      </Button>
      {sent && <p role="status">Setup email sent. Ask the owner to check their inbox.</p>}
      {error && <p role="alert">{error}</p>}
    </Alert>
  );
}
