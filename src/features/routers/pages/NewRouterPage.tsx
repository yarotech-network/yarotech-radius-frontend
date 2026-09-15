import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, FormField, Input, PasswordInput } from '@/components/ui';
import { Alert, useToast } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { cn } from '@/lib/utilities/cn';
import { useCreateRouter } from '../queries';
import {
  CREATE_DEFAULTS,
  createFormToPayload,
  routerCreateSchema,
  type RouterCreateInput,
  type RouterCreateOutput,
} from '../routerSchemas';
import {
  RouterBasicsFields,
  RouterOsUsernameField,
  RouterWireGuardFields,
} from '../components/RouterFields';

const FIELDS = [
  'model',
  'routeros_version',
  'name',
  'ip_address',
  'location',
  'wireguard_ip',
  'wireguard_public_key',
  'wireguard_port',
  'routeros_username',
  'is_active',
  'nas_secret',
  'routeros_password',
] as const;
const ALIASES = { routeros_password_encrypted: 'routeros_password' };

const STEPS = [
  {
    key: 'basics',
    title: 'Basics',
    fields: ['name', 'ip_address', 'location', 'is_active', 'model', 'routeros_version'] as const,
  },
  { key: 'radius', title: 'RADIUS secret', fields: ['nas_secret'] as const },
  {
    key: 'vpn',
    title: 'WireGuard',
    fields: ['wireguard_ip', 'wireguard_public_key', 'wireguard_port'] as const,
    optional: true,
  },
  {
    key: 'routeros',
    title: 'RouterOS access',
    fields: ['routeros_username', 'routeros_password'] as const,
    optional: true,
  },
] as const;

export default function NewRouterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateRouter();
  const [idempotencyKey] = useState(() => newIdempotencyKey('router'));
  const [step, setStep] = useState(0);
  const [hotspotSetup, setHotspotSetup] = useState(false);
  const form = useForm<RouterCreateInput, unknown, RouterCreateOutput>({
    resolver: zodResolver(routerCreateSchema),
    defaultValues: CREATE_DEFAULTS,
    mode: 'onTouched',
  });
  const {
    message,
    reset: resetErrors,
    captureError,
  } = useFormSubmit(form.setError, FIELDS, ALIASES);
  const [name, address, location] = useWatch({
    control: form.control,
    name: ['name', 'ip_address', 'location'],
  });
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  async function next() {
    if (step === 0 && hotspotSetup) {
      let missing = false;
      for (const field of ['model', 'routeros_version'] as const) {
        if (!form.getValues(field)?.trim()) {
          form.setError(
            field,
            { type: 'required', message: 'Required for Hotspot configuration review' },
            { shouldFocus: !missing },
          );
          missing = true;
        }
      }
      if (missing) return;
    }
    const valid = await form.trigger([...current.fields], { shouldFocus: true });
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  const submit = form.handleSubmit(
    async (values) => {
      resetErrors();
      if (hotspotSetup && (!values.model || !values.routeros_version)) {
        if (!values.model)
          form.setError('model', { message: 'Required for Hotspot configuration review' });
        if (!values.routeros_version)
          form.setError('routeros_version', {
            message: 'Required for Hotspot configuration review',
          });
        setStep(0);
        return;
      }
      try {
        const router = await create.mutateAsync({
          payload: createFormToPayload(values),
          idempotencyKey,
        });
        toast.success('Router registered', `${router.name} is pending review.`);
        navigate(`/routers/${router.id}${hotspotSetup ? '?tab=setup' : ''}`, { replace: true });
      } catch (error) {
        captureError(error);
        // Jump to the first step that has an error so the user sees it.
        const idx = STEPS.findIndex((s) => s.fields.some((f) => form.getFieldState(f).error));
        if (idx >= 0) setStep(idx);
      }
    },
    (errors) => {
      const idx = STEPS.findIndex((s) => s.fields.some((f) => f in errors));
      if (idx >= 0) setStep(idx);
    },
  );

  const errors = form.formState.errors;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add router"
        description="Register a MikroTik as a RADIUS client. You can fill in VPN and RouterOS details later."
        backTo="/routers"
        crumbs={[{ label: 'Routers', to: '/routers' }, { label: 'Add router' }]}
      />
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Radio className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-950">Connect a new hotspot</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Start with the router identity and RADIUS secret. Add optional VPN and RouterOS access
              details now, or complete them later from the router page.
            </p>
            <p className="mt-3 text-xs font-medium text-brand-700">
              Registration creates the device record. Review its onboarding and connection checks
              after saving.
            </p>
          </div>
        </div>
      </Card>
      <label className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm">
        <input
          type="checkbox"
          checked={hotspotSetup}
          onChange={(event) => setHotspotSetup(event.target.checked)}
          className="mt-1"
        />
        <span>
          <strong className="block">Continue to Hotspot configuration review</strong>
          <span className="mt-1 block text-ink-600">
            After registration, select actual interfaces and review a saved setup plan. On the setup
            page, choose local LAN or WireGuard discovery. Local LAN requires server approval;
            executable scripts require hardware validation.
          </span>
        </span>
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (last) void submit(e);
          else void next();
        }}
        noValidate
        className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]"
      >
        <div className="min-w-0">
          <p className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Registration progress
          </p>
          <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col" aria-label="Steps">
            {STEPS.map((s, i) => {
              const state = i === step ? 'current' : i < step ? 'done' : 'todo';
              return (
                <li key={s.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => i < step && setStep(i)}
                    disabled={i > step || form.formState.isSubmitting}
                    aria-current={state === 'current' ? 'step' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed',
                      state === 'current'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-ink-600 hover:bg-surface-muted disabled:hover:bg-transparent',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                        state === 'done'
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : state === 'current'
                            ? 'border-white/60 text-white'
                            : 'border-border-strong text-ink-400',
                      )}
                    >
                      {state === 'done' ? <Check className="size-3.5" aria-hidden /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.title}</span>
                      {'optional' in s && s.optional && (
                        <span
                          className={
                            state === 'current'
                              ? 'block text-xs text-white/80'
                              : 'block text-xs text-ink-400'
                          }
                        >
                          Optional
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <Card className="flex min-w-0 flex-col gap-5">
          {message && <Alert tone="danger">{message}</Alert>}
          <div>
            <h2 className="text-lg font-semibold text-brand-950">
              Step {step + 1} of {STEPS.length}: {current.title}
            </h2>
            {current.key === 'basics' && (
              <p className="mt-1 text-sm text-ink-600">
                Choose a recognizable name and the address used for RADIUS requests.
              </p>
            )}
            {current.key === 'radius' && (
              <p className="mt-1 text-sm text-ink-600">
                The shared secret configured under RADIUS on the router. It is stored encrypted and
                can only be rotated, never displayed.
              </p>
            )}
            {current.key === 'vpn' && (
              <p className="mt-1 text-sm text-ink-600">
                Needed for remote provisioning over the management VPN. Skip if the router is on a
                directly reachable network.
              </p>
            )}
            {current.key === 'routeros' && (
              <p className="mt-1 text-sm text-ink-600">
                Lets the provisioning agent push configuration to the router. Stored encrypted.
              </p>
            )}
          </div>

          {current.key === 'basics' && (
            <>
              <RouterBasicsFields register={form.register} errors={errors} control={form.control} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="MikroTik model"
                  required={hotspotSetup}
                  error={errors.model?.message}
                  hint="Enter the exact model from System Resources."
                >
                  <Input
                    placeholder="Your router model"
                    maxLength={80}
                    {...form.register('model')}
                  />
                </FormField>
                <FormField
                  label="RouterOS version"
                  required={hotspotSetup}
                  error={errors.routeros_version?.message}
                  hint="The installed version; different routers can use different versions."
                >
                  <Input
                    placeholder="For example 7.20.1"
                    maxLength={40}
                    {...form.register('routeros_version')}
                  />
                </FormField>
              </div>
            </>
          )}
          {current.key === 'radius' && (
            <FormField
              label="RADIUS shared secret"
              required
              hint="At least 8 characters. Must match the router's RADIUS client configuration."
              error={errors.nas_secret?.message}
            >
              <PasswordInput
                autoComplete="new-password"
                autoFocus
                spellCheck={false}
                className="font-mono"
                {...form.register('nas_secret')}
              />
            </FormField>
          )}
          {current.key === 'vpn' && (
            <RouterWireGuardFields register={form.register} errors={errors} />
          )}
          {current.key === 'routeros' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RouterOsUsernameField register={form.register} errors={errors} />
              <FormField
                label="RouterOS password"
                optionalLabel
                error={errors.routeros_password?.message}
              >
                <PasswordInput
                  autoComplete="new-password"
                  {...form.register('routeros_password')}
                />
              </FormField>
            </div>
          )}

          {last && (
            <section
              aria-labelledby="router-review-title"
              className="rounded-xl border border-brand-100 bg-brand-50/50 p-4"
            >
              <h3 id="router-review-title" className="text-sm font-semibold text-brand-950">
                Review before registering
              </h3>
              <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs text-ink-500">Router name</dt>
                  <dd className="mt-1 font-medium break-words">{String(name || 'Not provided')}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink-500">NAS IP address</dt>
                  <dd className="mt-1 font-mono break-all">{String(address || 'Not provided')}</dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-ink-500">Location</dt>
                  <dd className="mt-1 break-words">{String(location || 'Not provided')}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-ink-500">
                Use Back to revise earlier details. Secrets are omitted from this review.
              </p>
            </section>
          )}
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              leadingIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || form.formState.isSubmitting}
            >
              Back
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                disabled={form.formState.isSubmitting}
                onClick={() => navigate('/routers')}
              >
                Cancel
              </Button>
              {last ? (
                <Button type="submit" loading={form.formState.isSubmitting}>
                  Register router
                </Button>
              ) : (
                <Button
                  type="submit"
                  trailingIcon={<ChevronRight className="h-4 w-4" aria-hidden />}
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
