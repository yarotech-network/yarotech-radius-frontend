import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2 } from 'lucide-react';
import { Button, FormField, Input } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { applyApiErrors } from '@/lib/validation/applyApiErrors';
import {
  passwordPairShape,
  passwordPairRefinement,
  phoneSchema,
  slugSchema,
  usernameSchema,
} from '@/lib/validation/schemas';
import { isApiError } from '@/services/api/errors';
import { registrationApi, type EmailProof, type WorkspaceReady } from './api';

const schema = z
  .object({
    tenant_name: z.string().trim().min(2, 'Enter your business name').max(200),
    workspace_id: slugSchema.min(3, 'Use at least 3 characters'),
    username: usernameSchema,
    first_name: z.string().trim().min(1, 'Enter your first name').max(150),
    last_name: z.string().trim().min(1, 'Enter your last name').max(150),
    phone: phoneSchema,
    ...passwordPairShape,
  })
  .refine(passwordPairRefinement.check, passwordPairRefinement.options);
type Details = z.infer<typeof schema>;
const FIELDS = [
  'tenant_name',
  'workspace_id',
  'username',
  'first_name',
  'last_name',
  'phone',
  'password',
  'password_confirm',
] as const;
const slugFor = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-$/, '');

export function CreateWorkspace({
  proof,
  onReady,
  onBack,
}: {
  proof: EmailProof;
  onReady: (result: WorkspaceReady) => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const form = useForm<Details>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenant_name: '',
      workspace_id: '',
      username: '',
      first_name: '',
      last_name: '',
      phone: '',
      password: '',
      password_confirm: '',
    },
  });
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const submit = form.handleSubmit(async (values) => {
    setMessage(null);
    try {
      const result = await registrationApi.create({ ...values, email: proof.email }, proof.token);
      form.reset();
      onReady(result);
    } catch (error) {
      if (
        isApiError(error) &&
        (error.body as { code?: string } | null)?.code === 'verification_required'
      )
        setExpired(true);
      const leftover = applyApiErrors(error, form.setError, FIELDS);
      if (leftover) setMessage(leftover);
    }
  });
  const workspaceId = useWatch({ control: form.control, name: 'workspace_id' });
  const errors = form.formState.errors;
  const nameField = form.register('tenant_name');
  const slugField = form.register('workspace_id');
  return (
    <section aria-labelledby="registration-title">
      <header className="registration-heading">
        <h1 id="registration-title" ref={heading} tabIndex={-1}>
          Create your account
        </h1>
        <p>Tell us about your business and choose its workspace ID.</p>
      </header>
      <p className="registration-verified">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        <span>Email verified: {proof.email}</span>
      </p>
      <form onSubmit={(event) => void submit(event)} noValidate className="space-y-5">
        {message && <Alert tone="danger">{message}</Alert>}
        {expired && (
          <Button variant="secondary" onClick={onBack}>
            Verify email again
          </Button>
        )}
        <fieldset disabled={form.formState.isSubmitting || expired} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Business name" required error={errors.tenant_name?.message}>
              <Input
                autoComplete="organization"
                {...nameField}
                onChange={(event) => {
                  void nameField.onChange(event);
                  if (!slugEdited) form.setValue('workspace_id', slugFor(event.target.value));
                }}
              />
            </FormField>
            <FormField
              label="Workspace ID"
              required
              error={errors.workspace_id?.message}
              hint={`Your storefront: /s/${workspaceId || 'your-workspace-id'}`}
            >
              <Input
                autoCapitalize="none"
                spellCheck={false}
                {...slugField}
                onChange={(event) => {
                  setSlugEdited(true);
                  void slugField.onChange(event);
                }}
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" required error={errors.first_name?.message}>
              <Input autoComplete="given-name" {...form.register('first_name')} />
            </FormField>
            <FormField label="Last name" required error={errors.last_name?.message}>
              <Input autoComplete="family-name" {...form.register('last_name')} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Username"
              required
              error={errors.username?.message}
              hint="Use this to sign in."
            >
              <Input
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                {...form.register('username')}
              />
            </FormField>
            <FormField
              label="Contact phone"
              required
              error={errors.phone?.message}
              hint="Business contact only. No verification needed."
            >
              <Input autoComplete="tel" type="tel" {...form.register('phone')} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Password"
              required
              error={errors.password?.message}
              hint="At least 8 characters; avoid common passwords."
            >
              <PasswordInput autoComplete="new-password" {...form.register('password')} />
            </FormField>
            <FormField label="Confirm password" required error={errors.password_confirm?.message}>
              <PasswordInput autoComplete="new-password" {...form.register('password_confirm')} />
            </FormField>
          </div>
          <Button type="submit" block size="lg" loading={form.formState.isSubmitting}>
            Create workspace
          </Button>
        </fieldset>
        <Button variant="link" disabled={form.formState.isSubmitting} onClick={onBack}>
          Use a different email
        </Button>
      </form>
    </section>
  );
}
