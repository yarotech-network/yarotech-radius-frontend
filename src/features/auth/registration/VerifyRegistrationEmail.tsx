import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MailCheck } from 'lucide-react';
import { Button, FormField, Input } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { emailSchema } from '@/lib/validation/schemas';
import { errorMessage, isApiError } from '@/services/api/errors';
import { registrationApi, type EmailProof } from './api';

export function VerifyRegistrationEmail({
  initialEmail,
  onVerified,
}: {
  initialEmail: string;
  onVerified: (proof: EmailProof) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (cooldown > 0) {
      const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => window.clearTimeout(timer);
    }
  }, [cooldown]);
  useEffect(() => {
    if (sent) codeInput.current?.focus();
  }, [sent]);
  const send = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message);
      return;
    }
    setBusy('send');
    setEmailError(undefined);
    setMessage(null);
    try {
      const result = await registrationApi.sendEmail(parsed.data);
      setEmail(parsed.data);
      setSent(true);
      setCode('');
      setCodeError(undefined);
      setCooldown(result.resend_after);
    } catch (error) {
      setMessage(errorMessage(error));
      if (isApiError(error) && error.retryAfterSeconds) setCooldown(error.retryAfterSeconds);
    } finally {
      setBusy(null);
    }
  };
  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Enter the six-digit code from your email.');
      codeInput.current?.focus();
      return;
    }
    setBusy('verify');
    setMessage(null);
    setCodeError(undefined);
    try {
      const result = await registrationApi.verifyEmail(email, code);
      onVerified({ email, token: result.registration_token });
    } catch (error) {
      setMessage(errorMessage(error));
      setBusy(null);
    }
  };
  return (
    <section aria-labelledby="registration-title">
      <header className="registration-heading">
        <h1 id="registration-title">Verify your email</h1>
        <p>
          Start with your email address. We will send a six-digit code to confirm it belongs to you.
        </p>
      </header>
      {message && (
        <Alert tone="danger" className="mb-5">
          {message}
        </Alert>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !cooldown) void send();
        }}
        className="space-y-5"
      >
        <FormField label="Email address" required error={emailError}>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={email}
            readOnly={sent}
            disabled={busy !== null}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        {!sent && (
          <Button
            type="submit"
            block
            size="lg"
            loading={busy === 'send'}
            disabled={busy !== null || cooldown > 0}
          >
            Send email verification code <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </form>
      {sent && (
        <div className="registration-code-panel">
          <p className="flex items-start gap-2 text-sm text-ink-600">
            <MailCheck className="size-5 shrink-0 text-brand-600" aria-hidden />
            <span>
              If this email can be registered, a code is on its way to <strong>{email}</strong>.
              Check your inbox and spam folder. Already registered? Sign in below.
            </span>
          </p>
          <form
            className="mt-5 space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) void verify();
            }}
          >
            <FormField
              label="Verification code"
              required
              error={codeError}
              hint="The code expires after 10 minutes."
            >
              <Input
                ref={codeInput}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={busy !== null}
                className="text-center font-mono tracking-[.5em]"
              />
            </FormField>
            <Button
              type="submit"
              block
              size="lg"
              loading={busy === 'verify'}
              disabled={busy !== null}
            >
              Verify email &amp; continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="link"
              disabled={busy !== null || cooldown > 0}
              onClick={() => void send()}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </Button>
            <Button
              variant="link"
              disabled={busy !== null}
              onClick={() => {
                setSent(false);
                setCode('');
                setMessage(null);
                setCooldown(0);
              }}
            >
              Change email
            </Button>
          </div>
        </div>
      )}
      <p className="mt-6 text-sm text-ink-500">
        Your workspace is created in the next step, after your email is verified.
      </p>
    </section>
  );
}
