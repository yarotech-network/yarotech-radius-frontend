import { useRef, useState, type FormEvent } from 'react';
import { Alert, useToast } from '@/components/feedback';
import { Button, Dialog, FormField, Input } from '@/components/ui';
import { errorMessage, isApiError } from '@/services/api/errors';
import { useCreateStaffAccount } from '../queries';

/** Kept at the old module path to avoid disrupting platform page imports. */
type OfficerField = 'username' | 'email' | 'phone' | 'temporary_password';
const officerFields: OfficerField[] = ['username', 'email', 'phone', 'temporary_password'];

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void; defaultTenant?: number }) {
  const create = useCreateStaffAccount();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<OfficerField, string>>>({});
  const fieldRefs = useRef<Partial<Record<OfficerField, HTMLInputElement | null>>>({});
  const clearFieldError = (field: OfficerField) =>
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  const close = () => { setUsername(''); setEmail(''); setPhone(''); setTemporaryPassword(''); setError(''); setFieldErrors({}); onClose(); };
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setFieldErrors({});
    try {
      const account = await create.mutateAsync({ username: username.trim(), email: email.trim(), phone: phone.trim(), temporary_password: temporaryPassword });
      toast.success('Account officer created', account.delivery_status === 'accepted'
        ? 'Setup email accepted by the provider. The officer must activate before assignment.'
        : 'Setup email could not be sent. Use Resend setup after checking email delivery.');
      close();
    } catch (cause) {
      if (isApiError(cause) && cause.hasFieldErrors) {
        const next: Partial<Record<OfficerField, string>> = {};
        const unmatched: string[] = [];
        for (const [field, messages] of Object.entries(cause.fields)) {
          if (officerFields.includes(field as OfficerField)) {
            next[field as OfficerField] = messages.join(' ');
          } else {
            unmatched.push(...messages);
          }
        }
        setFieldErrors(next);
        setError(unmatched.join(' ') || (Object.keys(next).length ? '' : errorMessage(cause)));
        const firstInvalid = officerFields.find((field) => next[field]);
        if (firstInvalid) fieldRefs.current[firstInvalid]?.focus();
      } else {
        setError(errorMessage(cause));
      }
    }
  }
  return <Dialog open={open} onClose={close} title="Create account officer"
    description="This creates a platform staff account only. Tenant access is assigned after activation.">
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <FormField label="Username" required error={fieldErrors.username}><Input ref={(input) => { fieldRefs.current.username = input; }} autoFocus autoComplete="off" minLength={3} maxLength={150} required value={username} onChange={(e) => { setUsername(e.target.value); clearFieldError('username'); }} /></FormField>
      <FormField label="Work email" required error={fieldErrors.email}><Input ref={(input) => { fieldRefs.current.email = input; }} type="email" autoComplete="off" required value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }} /></FormField>
      <FormField label="Phone number" required error={fieldErrors.phone}><Input ref={(input) => { fieldRefs.current.phone = input; }} type="tel" autoComplete="off" minLength={10} maxLength={30} required value={phone} onChange={(e) => { setPhone(e.target.value); clearFieldError('phone'); }} /></FormField>
      <FormField label="Temporary password" required error={fieldErrors.temporary_password} hint="Use a unique password with letters, numbers and a symbol. The officer must replace it during setup.">
        <Input ref={(input) => { fieldRefs.current.temporary_password = input; }} type="password" autoComplete="new-password" required minLength={8} value={temporaryPassword} onChange={(e) => { setTemporaryPassword(e.target.value); clearFieldError('temporary_password'); }} />
      </FormField>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" loading={create.isPending}>Create officer</Button></div>
    </form>
  </Dialog>;
}
