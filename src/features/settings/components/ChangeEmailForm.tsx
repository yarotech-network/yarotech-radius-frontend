import { useState } from 'react';
import { useAuth } from '@/app/auth/useAuth';
import { Button, FormField, Input } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';

export function ChangeEmailForm() {
  const { refreshPrincipal } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      className="space-y-3"
      aria-label="Change email"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        setMessage('');
        try {
          if (!sent) {
            await http.post('/auth/email-change/', { email, password }, { tenantId: null });
            setSent(true);
            setPassword('');
            setMessage('Enter the code sent to your new email.');
          } else {
            await http.post('/auth/email-change/confirm/', { code }, { tenantId: null });
            await refreshPrincipal();
            setSent(false);
            setCode('');
            setEmail('');
            setMessage('Your verified email has been updated.');
          }
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {message && <Alert tone="info">{message}</Alert>}
      <fieldset disabled={busy} className="space-y-3">
        {!sent ? (
          <>
            <FormField label="New email" required>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
            <FormField label="Current password" required>
              <Input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
          </>
        ) : (
          <FormField label="Email verification code" required>
            <Input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </FormField>
        )}
        <Button type="submit" disabled={busy}>
          {sent ? 'Confirm new email' : 'Send verification code'}
        </Button>
        {sent && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSent(false);
              setCode('');
            }}
          >
            Request another code
          </Button>
        )}
      </fieldset>
    </form>
  );
}
