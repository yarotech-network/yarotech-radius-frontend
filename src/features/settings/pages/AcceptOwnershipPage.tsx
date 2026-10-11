import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@/components/feedback';
import { Button, Card, FormField, Input } from '@/components/ui';
import { errorMessage } from '@/services/api/errors';
import { settingsApi } from '../api';

export default function AcceptOwnershipPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await settingsApi.acceptOwnerTransfer({ token,
        ...(username && password ? { username, password } : {}) });
      setDone(result.tenant_name);
      navigate('/accept-ownership', { replace: true });
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-lg px-4 py-12"><Card className="space-y-5 p-6">
    <h1 className="text-2xl font-bold">Accept workspace ownership</h1>
    {done ? <><Alert tone="success">You now own {done}. Sign in to open the workspace.</Alert><Link className="dashboard-data-link" to="/login">Go to sign in</Link></> :
      !token ? <Alert tone="danger">Open the complete link sent to your email.</Alert> :
      <><p className="text-sm text-ink-600">If you already have a verified Yarotech account for the invited email, sign in first, then return to this link. Otherwise, create your login below.</p>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <FormField label="New username (new accounts only)"><Input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></FormField>
          <FormField label="New password (new accounts only)"><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></FormField>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" loading={busy}>Accept ownership</Button>
        </form></>}
  </Card></div>;
}
