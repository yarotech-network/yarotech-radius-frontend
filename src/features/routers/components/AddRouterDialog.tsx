import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { Button, ConfirmDialog, Dialog } from '@/components/ui';
import { Alert } from '@/components/feedback/Alert';
import { http } from '@/services/api/http';
import { errorMessage, isApiError } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { cn } from '@/lib/utilities/cn';
import type { NasDevice } from '@/types/api';
import { routerKeys } from '../queries';
import {
  ADD_ROUTER_DEFAULTS,
  STEP_FIELDS,
  buildRegisterPayload,
  stepOf,
  validateAddRouter,
  type AddRouterField,
  type AddRouterValues,
} from './addRouter/model';
import { StepNetwork, StepReview, StepRouter } from './addRouter/AddRouterSteps';

const STEPS = ['Router', 'Network', 'Review'] as const;
const STEP_TITLES = [
  'Name the router and its customer port',
  'Choose how the HotSpot is set up',
  'Check the details',
] as const;

/** One rule set (validateAddRouter) drives every step; trigger(fields) limits it to the current step. */
const resolver: Resolver<AddRouterValues> = (values) => {
  const problems = validateAddRouter(values);
  const errors: FieldErrors<AddRouterValues> = {};
  for (const [field, message] of Object.entries(problems)) {
    errors[field as AddRouterField] = { type: 'validate', message };
  }
  return Object.keys(errors).length > 0 ? { values: {}, errors } : { values, errors: {} };
};

/** Server field errors that belong to an input; everything else is shown above the form. */
const KNOWN_FIELDS = new Set<string>(STEP_FIELDS.flat());

export function AddRouterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queries = useQueryClient();
  const form = useForm<AddRouterValues>({
    defaultValues: ADD_ROUTER_DEFAULTS,
    resolver,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const request = useRef({ payload: '', key: '' });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirty = form.formState.isDirty || step !== 0;

  // The dialog remounts for every /routers/new visit, so each open starts a fresh draft.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => form.setFocus('name'), 60);
    return () => window.clearTimeout(timer);
  }, [open, form]);

  function goTo(next: number, focusField?: AddRouterField) {
    setStep(next);
    window.setTimeout(() => {
      if (focusField) form.setFocus(focusField);
      else headingRef.current?.focus();
    }, 60);
  }

  /** Move to the earliest step with an error and focus that field. */
  function showFirstError(fields: string[]) {
    const first = [...fields].sort((a, b) => stepOf(a) - stepOf(b))[0];
    if (first) goTo(stepOf(first), first as AddRouterField);
  }

  async function next() {
    const valid = await form.trigger([...STEP_FIELDS[step]!], { shouldFocus: true });
    if (!valid) return;
    setFormError('');
    goTo(step + 1);
  }

  function back() {
    setFormError('');
    goTo(step - 1);
  }

  function requestClose() {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  async function register(values: AddRouterValues) {
    const payload = buildRegisterPayload(values);
    const serialized = JSON.stringify(payload);
    if (request.current.payload !== serialized)
      request.current = { payload: serialized, key: newIdempotencyKey('router') };
    setBusy(true);
    setFormError('');
    try {
      const router = await http.post<NasDevice>('/routers/register/', payload, {
        idempotencyKey: request.current.key,
      });
      await queries.invalidateQueries({ queryKey: routerKeys.all });
      queries.setQueryData(routerKeys.detail(router.id), router);
      navigate(`/routers/${router.id}?tab=setup`);
    } catch (failure) {
      if (!isApiError(failure) || !failure.hasFieldErrors) {
        setFormError(errorMessage(failure));
        return;
      }
      const mapped: string[] = [];
      const leftovers: string[] = [];
      for (const [field, messages] of Object.entries(failure.fields)) {
        const text = messages.join(' ');
        if (KNOWN_FIELDS.has(field)) {
          form.setError(field as AddRouterField, { type: 'server', message: text });
          mapped.push(field);
        } else {
          // The backend groups HotSpot network checks under `network`.
          leftovers.push(field === 'network' ? text : `${field}: ${text}`);
        }
      }
      setFormError(leftovers.length > 0 ? leftovers.join(' ') : '');
      showFirstError(mapped);
    } finally {
      setBusy(false);
    }
  }

  /** handleSubmit runs inside the event, so refs are only read while handling it. */
  function submit() {
    if (busy || form.formState.isSubmitting) return; // one request per click burst
    return form.handleSubmit(register, (errors) => showFirstError(Object.keys(errors)))();
  }

  const last = step === STEPS.length - 1;

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title="Add router"
        description="Register a MikroTik router in three short steps. Yarotech generates its VPN keys and RADIUS secret for you."
        size="lg"
        dismissible={!busy}
        className="rv-add-dialog"
        footer={
          <>
            {step === 0 ? (
              <Button variant="secondary" onClick={requestClose} disabled={busy}>
                Cancel
              </Button>
            ) : (
              <Button variant="secondary" onClick={back} disabled={busy}>
                Back
              </Button>
            )}
            {last ? (
              <Button loading={busy} onClick={() => void submit()}>
                Create router
              </Button>
            ) : (
              <Button onClick={() => void next()}>Next</Button>
            )}
          </>
        }
      >
        <div className="space-y-5">
          <ol aria-label="Add router progress" className="grid grid-cols-3 gap-2">
            {STEPS.map((label, index) => (
              <li key={label} aria-current={step === index ? 'step' : undefined}>
                <span
                  className={cn(
                    'block h-1.5 rounded-full',
                    index <= step ? 'bg-brand-600' : 'bg-fill-strong',
                  )}
                />
                <span
                  className={cn(
                    'mt-1.5 block text-xs font-medium',
                    index === step ? 'text-brand-700' : 'text-ink-500',
                  )}
                >
                  {index + 1}. {label}
                </span>
              </li>
            ))}
          </ol>
          <p role="status" className="sr-only">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold text-ink-900 outline-none"
          >
            {STEP_TITLES[step]}
          </h3>

          {formError && (
            <Alert tone="danger" title="Router could not be created">
              {formError}
            </Alert>
          )}

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (last) void submit();
              else void next();
            }}
          >
            {step === 0 && <StepRouter form={form} busy={busy} />}
            {step === 1 && <StepNetwork form={form} busy={busy} />}
            {step === 2 && <StepReview form={form} busy={busy} />}
            {/* Enter submits the current step (Next, or Create on the last step). */}
            <button type="submit" className="hidden" tabIndex={-1} aria-hidden>
              Continue
            </button>
          </form>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard new router?"
        description="Your entered details will be lost. This cannot be undone."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
