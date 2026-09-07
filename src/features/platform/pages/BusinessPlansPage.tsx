import { PlanLimits } from '@/features/settings/components/PlanLimits';
import { errorMessage } from '@/services/api/errors';
import { priceInKobo } from '../businessPlanRules';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { PageHeader, StatusBadge } from '@/components/layout';
import { Button, ButtonLink, Card, Dialog, FormField, Input, Textarea } from '@/components/ui';
import { Alert, useToast } from '@/components/feedback';
import { DataTable, Pagination } from '@/components/data';
import { http } from '@/services/api/http';
import { formatKobo } from '@/lib/formatting/money';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { settingsKeys } from '@/features/settings/queries';
import { storefrontKeys } from '@/features/storefront/queries';
import type { Paginated, SubscriptionPlan } from '@/types/api';

const endpoint = '/platform/business-plans/';
const queryKey = ['platform', 'business-plans'] as const;
const options = { tenantId: null } as const;
type Values = {
  name: string;
  price: string;
  duration_days: string;
  features: string;
  max_routers: string;
  daily_voucher_print_limit: string;
  whatsapp_enabled: boolean;
  is_active: boolean;
};
const fields = [
  'name',
  'price',
  'duration_days',
  'features',
  'max_routers',
  'daily_voucher_print_limit',
  'whatsapp_enabled',
  'is_active',
] as const;

export default function BusinessPlansPage() {
  const cache = useQueryClient();
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [deleting, setDeleting] = useState<SubscriptionPlan | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => http.delete(`${endpoint}${id}/`, options),
    onSuccess: () => {
      setDeleting(null);
      setPage(1);
      void cache.invalidateQueries({ queryKey });
      void cache.invalidateQueries({ queryKey: settingsKeys.pricing() });
      void cache.invalidateQueries({ queryKey: storefrontKeys.pricing() });
    },
  });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const query = useQuery({
    queryKey: [...queryKey, page],
    queryFn: () =>
      http.get<Paginated<SubscriptionPlan>>(endpoint, { page, page_size: 20 }, options),
  });
  useEffect(() => {
    document.title = 'Business plans - Yarotech RADIUS';
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Business plans"
        description="Subscription packages for businesses using your platform."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
              leadingIcon={<RefreshCw className="size-4" aria-hidden />}
            >
              Refresh plans
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setCreating(true);
              }}
              leadingIcon={<Plus className="size-4" aria-hidden />}
            >
              Create business plan
            </Button>
          </div>
        }
      />
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <h2 className="text-lg font-semibold text-brand-950">
          One catalogue for visitors and tenants
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          New plans appear on public pricing and in tenant Settings under Subscription. Prices,
          duration and limits come from the same saved plan. Changes apply to future purchases; paid
          terms remain protected until renewal.
        </p>
        <ButtonLink to="/pricing" variant="secondary" className="mt-4">
          View public pricing
        </ButtonLink>
      </Card>
      {query.isError && query.data && (
        <Alert tone="warning" title="Plans could not be refreshed">
          Showing the last loaded plans.
        </Alert>
      )}
      <DataTable
        caption="Business plans"
        rows={query.data?.results}
        rowKey={(plan) => plan.id}
        loading={query.isPending}
        refreshing={query.isFetching && !query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowActions={(plan) => (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(plan);
                setCreating(true);
              }}
              aria-label={`Edit ${plan.name}`}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                remove.reset();
                setDeleting(plan);
              }}
              aria-label={`Delete ${plan.name}`}
            >
              Delete
            </Button>
          </div>
        )}
        columns={[
          {
            key: 'name',
            header: 'Plan',
            primary: true,
            cell: (plan) => <span className="font-semibold break-words">{plan.name}</span>,
          },
          { key: 'price', header: 'Price', cell: (plan) => formatKobo(plan.price) },
          { key: 'duration', header: 'Duration', cell: (plan) => `${plan.duration_days} days` },
          { key: 'limits', header: 'Allowances', cell: (plan) => <PlanLimits plan={plan} /> },
          {
            key: 'features',
            header: 'Features',
            cell: (plan) => (
              <ul className="list-inside list-disc text-sm">
                {plan.features.map((feature, index) => (
                  <li key={index}>
                    {typeof feature === 'string' ? feature : JSON.stringify(feature)}
                  </li>
                ))}
              </ul>
            ),
          },
          {
            key: 'status',
            header: 'Visibility',
            cell: (plan) => <StatusBadge status={plan.is_active ? 'active' : 'inactive'} />,
          },
        ]}
      />
      {query.data && query.data.count > 0 && (
        <Pagination
          count={query.data.count}
          page={page}
          totalPages={query.data.total_pages}
          pageSize={20}
          onPageChange={setPage}
          itemLabel="plans"
        />
      )}
      <Dialog
        open={creating}
        dismissible={!publishing}
        onClose={() => setCreating(false)}
        title={editing ? `Edit ${editing.name}` : 'Create business plan'}
        description="Active plans are available to visitors and tenants. Existing purchases keep their agreed terms."
        variant="drawer"
        size="md"
      >
        {creating && (
          <BusinessPlanForm
            key={editing?.id ?? 'new'}
            plan={editing}
            onPublishing={setPublishing}
            onCreated={() => {
              setCreating(false);
              setPage(1);
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        dismissible={!remove.isPending}
        title="Delete business plan"
        description="Plans with payment or subscription history must be deactivated instead."
      >
        <p className="mb-4 text-sm">Delete {deleting?.name}? This cannot be undone.</p>
        {remove.isError && <Alert tone="danger">{errorMessage(remove.error)}</Alert>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" disabled={remove.isPending} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => deleting && remove.mutate(deleting.id)}
          >
            Delete plan
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function BusinessPlanForm({
  plan,
  onCreated,
  onPublishing,
}: {
  plan: SubscriptionPlan | null;
  onCreated: () => void;
  onPublishing: (value: boolean) => void;
}) {
  const cache = useQueryClient();
  const toast = useToast();
  const form = useForm<Values>({
    defaultValues: {
      name: plan?.name ?? '',
      price: plan ? (plan.price / 100).toFixed(2) : '',
      duration_days: String(plan?.duration_days ?? 30),
      features:
        plan?.features
          .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
          .join('\n') ?? '',
      max_routers: plan?.max_routers == null ? '' : String(plan.max_routers),
      daily_voucher_print_limit:
        plan?.daily_voucher_print_limit == null ? '' : String(plan.daily_voucher_print_limit),
      whatsapp_enabled: plan?.whatsapp_enabled ?? false,
      is_active: plan?.is_active ?? true,
    },
  });
  const feedback = useFormSubmit(form.setError, fields);
  const attempt = useRef({ body: '', key: '' });
  const create = useMutation({
    mutationFn: (payload: {
      name: string;
      price: number;
      duration_days: number;
      features: string[];
      max_routers: number | null;
      daily_voucher_print_limit: number | null;
      whatsapp_enabled: boolean;
      is_active: boolean;
    }) => {
      const body = JSON.stringify(payload);
      if (attempt.current.body !== body)
        attempt.current = { body, key: newIdempotencyKey('business-plan') };
      if (plan)
        return http.patch<SubscriptionPlan>(
          `${endpoint}${plan.id}/`,
          { ...payload, expected_version: plan.version },
          options,
        );
      return http.post<SubscriptionPlan>(endpoint, payload, {
        ...options,
        idempotencyKey: attempt.current.key,
      });
    },
  });
  const submit = form.handleSubmit(async (values) => {
    feedback.reset();
    const price = priceInKobo(values.price);
    if (price === null) {
      form.setError('price', { message: 'Enter a positive price with up to two decimal places.' });
      return;
    }
    onPublishing(true);
    try {
      await create.mutateAsync({
        max_routers: values.max_routers.trim() === '' ? null : Number(values.max_routers),
        daily_voucher_print_limit:
          values.daily_voucher_print_limit.trim() === ''
            ? null
            : Number(values.daily_voucher_print_limit),
        whatsapp_enabled: values.whatsapp_enabled,
        is_active: values.is_active,
        name: values.name.trim(),
        price,
        duration_days: Number(values.duration_days),
        features: values.features
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      });
      void cache.invalidateQueries({ queryKey });
      void cache.invalidateQueries({ queryKey: settingsKeys.pricing() });
      void cache.invalidateQueries({ queryKey: storefrontKeys.pricing() });
      toast.success(
        plan
          ? 'Business plan updated'
          : values.is_active
            ? 'Business plan published'
            : 'Business plan created',
        values.is_active
          ? 'Available on public pricing and tenant subscriptions.'
          : 'Inactive plans are hidden from purchase choices.',
      );
      onCreated();
    } catch (error) {
      feedback.captureError(error);
    } finally {
      onPublishing(false);
    }
  });
  const errors = form.formState.errors;
  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      {feedback.message && <Alert tone="danger">{feedback.message}</Alert>}
      {feedback.retryAfter && (
        <Alert tone="warning">
          Too many requests. Please wait {feedback.retryAfter} seconds before trying again.
        </Alert>
      )}
      <FormField label="Plan name" required error={errors.name?.message}>
        <Input
          autoFocus
          maxLength={100}
          {...form.register('name', {
            validate: (value) => Boolean(value.trim()) || 'Enter a plan name.',
          })}
        />
      </FormField>
      <FormField
        label="Price (NGN)"
        required
        hint="Enter naira, for example 5000 or 5000.50."
        error={errors.price?.message}
      >
        <Input inputMode="decimal" {...form.register('price')} />
      </FormField>
      <FormField label="Duration (days)" required error={errors.duration_days?.message}>
        <Input
          inputMode="numeric"
          {...form.register('duration_days', {
            validate: (value) =>
              (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 36500) ||
              'Enter 1 to 36500 whole days.',
          })}
        />
      </FormField>
      <fieldset className="space-y-4 rounded-xl border border-border p-4">
        <legend className="px-1 font-semibold text-brand-950">Plan allowances</legend>
        {(['max_routers', 'daily_voucher_print_limit'] as const).map((field) => (
          <FormField
            key={field}
            label={field === 'max_routers' ? 'Maximum routers' : 'Daily voucher printing limit'}
            hint="Leave blank for unlimited. Zero disables this allowance."
            error={errors[field]?.message}
          >
            <Input
              inputMode="numeric"
              placeholder="Unlimited"
              {...form.register(field, {
                validate: (value) =>
                  value.trim() === '' ||
                  (/^\d+$/.test(value) && Number(value) <= 2147483647) ||
                  'Enter a non-negative whole number, or leave blank.',
              })}
            />
          </FormField>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('whatsapp_enabled')} /> WhatsApp enabled
        </label>
        <p className="text-xs text-ink-500">
          Printing counts distinct vouchers prepared each Lagos day. Same-day reprints are free.
        </p>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register('is_active')} /> Active: show on public pricing and
        tenant subscriptions
      </label>
      <FormField
        label="Features"
        optionalLabel
        hint="One feature per line. Up to 30 features, 300 characters each."
        error={errors.features?.message}
      >
        <Textarea
          rows={6}
          {...form.register('features', {
            validate: (value) => {
              const lines = value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);
              return (
                (lines.length <= 30 && lines.every((line) => line.length <= 300)) ||
                'Use up to 30 features with at most 300 characters each.'
              );
            },
          })}
        />
      </FormField>
      <p className="text-sm text-ink-500">
        Check the price and duration before publishing. Creating a new plan does not change existing
        subscriptions.
      </p>
      <Button type="submit" loading={form.formState.isSubmitting}>
        {plan ? 'Save changes' : 'Publish business plan'}
      </Button>
    </form>
  );
}
