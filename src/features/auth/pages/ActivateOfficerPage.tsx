import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '@/components/feedback';
import { AuthSplitLayout } from '@/app/shell/AuthSplitLayout';
import { Button, FormField, Input } from '@/components/ui';
import { accountApi } from '../api';
import { errorMessage } from '@/services/api/errors';

export default function ActivateOfficerPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'Activate account officer · Yarotech RADIUS'; }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    setBusy(true);
    try {
      await accountApi.activateOfficer({ token, temporary_password: temporaryPassword,
        new_password: newPassword, new_password_confirm: confirmPassword });
      setTemporaryPassword(''); setNewPassword(''); setConfirmPassword(''); setDone(true);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <AuthSplitLayout title={done ? 'Account activated' : 'Activate your account officer account'}
    footer={<Link to="/login" className="font-medium text-brand-600">Go to sign in</Link>}>
    {done ? <Alert tone="success">Your work email is verified and your password is set. Sign in using your new password.</Alert> :
      !token ? <Alert tone="danger">The activation link is missing its token. Ask your platform administrator to resend setup.</Alert> :
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="text-sm text-ink-600">Use the temporary password in your setup email, then choose a different password.</p>
        <FormField label="Temporary password" required><Input type="password" autoComplete="off" required value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} /></FormField>
        <FormField label="New password" required><Input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></FormField>
        <FormField label="Confirm new password" required><Input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></FormField>
        <Button type="submit" loading={busy}>Activate account</Button>
      </form>}
  </AuthSplitLayout>;
}
