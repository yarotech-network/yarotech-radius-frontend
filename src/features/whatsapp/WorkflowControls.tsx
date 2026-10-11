import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Bell, CheckCircle2, RefreshCw, ShoppingBag } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import { Alert, EmptyState, QueryBoundary } from '@/components/feedback';
import { Button, Checkbox, ConfirmDialog, FormField, Input, Skeleton } from '@/components/ui';
import { SectionCard, StatusBadge } from '@/components/layout';
import { formatDateTime } from '@/lib/formatting/dates';
import type { Paginated } from '@/types/api';

interface ReminderSettings {
  version: string | null;
  enabled: boolean;
  unused_enabled: boolean;
  expiry_enabled: boolean;
  unused_hours: number;
  short_lead_hours: number;
  medium_lead_hours: number;
  long_lead_hours: number;
  unused_template: string;
  expiry_template: string;
  language: string;
}
interface Order {
  id: number;
  state: string;
  payment_status: string;
  fulfilled: boolean;
  error_code: string;
  delivery_state: string | null;
  created_at: string;
}

const words = (value: string) => value.replaceAll('_', ' ');

export function WorkflowControls({ scope }: { scope: number | null }) {
  const principal = usePrincipal();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{
    id: number;
    type: 'recheck' | 'resend';
    requestId: string;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const reminderQuery = useQuery({
    queryKey: ['whatsapp-reminders', principal.user.id, scope],
    queryFn: () => http.get<ReminderSettings>('/whatsapp/reminders/'),
    enabled: open && scope !== null,
  });
  const orderQuery = useQuery({
    queryKey: ['whatsapp-orders', principal.user.id, scope, page],
    queryFn: () => http.get<Paginated<Order>>(`/whatsapp/orders/?page=${page}`),
    enabled: open && scope !== null,
  });

  return (
    <>
      <SectionCard
        id="whatsapp-workflow"
        icon={<ShoppingBag />}
        title="Orders and reminders"
        description="Vouchers bought over WhatsApp, their delivery, and reminders sent to customers."
        actions={
          <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide orders & reminders' : 'Manage orders & reminders'}
          </Button>
        }
      >
        {open && (
          <div className="space-y-6">
            {notice && (
              <Alert tone="success" title="Request recorded">
                {notice}
              </Alert>
            )}

            <QueryBoundary query={reminderQuery} skeleton={<Skeleton className="h-40 w-full" />}>
              {(data) => (
                <ReminderForm
                  key={`${scope}:${data.version}`}
                  data={data}
                  reload={() => reminderQuery.refetch()}
                />
              )}
            </QueryBoundary>

            <QueryBoundary query={orderQuery} skeleton={<Skeleton className="h-48 w-full" />}>
              {(data) => (
                <section
                  aria-labelledby="whatsapp-orders"
                  className="space-y-3 border-t border-border pt-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 id="whatsapp-orders" className="text-sm font-semibold text-ink-900">
                        WhatsApp purchases
                      </h3>
                      <p className="text-xs text-ink-500">
                        {data.count === 1 ? '1 order' : `${data.count} orders`}, newest first.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={orderQuery.isFetching}
                      onClick={() => void orderQuery.refetch()}
                      leadingIcon={<RefreshCw className="size-3.5" aria-hidden />}
                    >
                      Refresh orders
                    </Button>
                  </div>

                  {!data.results.length ? (
                    <EmptyState
                      compact
                      icon={<ShoppingBag className="size-6" aria-hidden />}
                      title="No WhatsApp orders yet"
                      description="Orders appear here once customers buy through your business link."
                    />
                  ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {data.results.map((order) => (
                        <li
                          key={order.id}
                          className="flex flex-wrap items-start justify-between gap-3 p-4"
                        >
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-ink-900">
                                Order #{order.id}
                              </span>
                              <StatusBadge status={order.payment_status} size="sm" />
                              {order.fulfilled ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700">
                                  <CheckCircle2 className="size-3.5" aria-hidden /> Voucher issued
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-warning-700">
                                  Voucher not issued
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-ink-500">
                              {formatDateTime(order.created_at)} · Processing: {words(order.state)}{' '}
                              · Delivery:{' '}
                              {order.delivery_state ? words(order.delivery_state) : 'not queued'}
                            </p>
                            {order.error_code && (
                              <p className="inline-flex items-center gap-1.5 text-xs text-warning-700">
                                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                                Needs review: {words(order.error_code)}
                              </p>
                            )}
                          </div>
                          {order.fulfilled ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setAction({
                                  id: order.id,
                                  type: 'resend',
                                  requestId: crypto.randomUUID(),
                                })
                              }
                            >
                              Resend voucher
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setAction({
                                  id: order.id,
                                  type: 'recheck',
                                  requestId: crypto.randomUUID(),
                                })
                              }
                            >
                              Recheck payment
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {data.total_pages > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={data.current_page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous orders
                      </Button>
                      <span className="text-xs text-ink-500">
                        Page {data.current_page} of {data.total_pages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={data.current_page >= data.total_pages}
                        onClick={() => setPage(page + 1)}
                      >
                        Next orders
                      </Button>
                    </div>
                  )}
                </section>
              )}
            </QueryBoundary>
          </div>
        )}
      </SectionCard>
      <ConfirmDialog
        open={action !== null}
        onClose={() => setAction(null)}
        title={action?.type === 'resend' ? 'Send the voucher code again?' : 'Recheck this payment?'}
        description={
          action?.type === 'resend'
            ? 'The customer may receive another copy if an earlier delivery succeeded.'
            : 'This checks the existing payment reference with the gateway. The customer is not charged again.'
        }
        confirmLabel={action?.type === 'resend' ? 'Resend voucher code' : 'Recheck now'}
        onConfirm={async () => {
          if (!action) return;
          await http.post(`/whatsapp/orders/${action.id}/recover/`, {
            action: action.type,
            request_id: action.requestId,
            acknowledge_duplicate_risk: action.type === 'resend',
          });
          setNotice('The worker will process the request. Refresh orders to check the outcome.');
          await orderQuery.refetch();
        }}
      />
    </>
  );
}

function ReminderForm({
  data,
  reload,
}: {
  data: ReminderSettings;
  reload: () => Promise<unknown>;
}) {
  const [form, setForm] = useState(data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);

  if (!data.version) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface-muted p-4 text-sm text-ink-600">
        Create your shared-number business link above before configuring customer reminders.
      </p>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const { version, ...values } = form;
      await http.put('/whatsapp/reminders/', { ...values, expected_version: version });
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const hours = (
    key: 'unused_hours' | 'short_lead_hours' | 'medium_lead_hours' | 'long_lead_hours',
  ) => ({
    value: form[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: Number(event.target.value) }),
  });

  return (
    <form
      onSubmit={(event) => void save(event)}
      aria-labelledby="whatsapp-reminders"
      className="space-y-4"
    >
      <div>
        <h3
          id="whatsapp-reminders"
          className="flex items-center gap-2 text-sm font-semibold text-ink-900"
        >
          <Bell className="size-4 text-brand-600" aria-hidden /> Customer reminders
        </h3>
        <p className="mt-1 text-xs text-ink-500">
          Customers opt in by sending <strong>REMINDERS ON</strong> and opt out with{' '}
          <strong>REMINDERS OFF</strong>. Use template names Meta has approved.
        </p>
      </div>

      {error && (
        <Alert tone="danger" title="Could not save reminders">
          {error}
        </Alert>
      )}

      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:grid-cols-3">
          <Checkbox
            label="Send reminders"
            checked={form.enabled}
            onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
          />
          <Checkbox
            label="Unused voucher reminders"
            checked={form.unused_enabled}
            onChange={(event) => setForm({ ...form, unused_enabled: event.target.checked })}
          />
          <Checkbox
            label="Plan expiry reminders"
            checked={form.expiry_enabled}
            onChange={(event) => setForm({ ...form, expiry_enabled: event.target.checked })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Unused voucher delay (hours)" hint="After purchase, 1–720">
            <Input type="number" min={1} max={720} required {...hours('unused_hours')} />
          </FormField>
          <FormField label="Short plans: notice (hours)" hint="Before expiry, 1–24">
            <Input type="number" min={1} max={24} required {...hours('short_lead_hours')} />
          </FormField>
          <FormField label="Medium plans: notice (hours)" hint="Before expiry, 1–168">
            <Input type="number" min={1} max={168} required {...hours('medium_lead_hours')} />
          </FormField>
          <FormField label="Long plans: notice (hours)" hint="Before expiry, 1–720">
            <Input type="number" min={1} max={720} required {...hours('long_lead_hours')} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Unused voucher template">
            <Input
              maxLength={80}
              value={form.unused_template}
              className="font-mono"
              onChange={(event) => setForm({ ...form, unused_template: event.target.value })}
              placeholder="e.g. unused_voucher_notice"
            />
          </FormField>
          <FormField label="Plan expiry template">
            <Input
              maxLength={80}
              value={form.expiry_template}
              className="font-mono"
              onChange={(event) => setForm({ ...form, expiry_template: event.target.value })}
              placeholder="e.g. plan_expiring_notice"
            />
          </FormField>
          <FormField label="Template language code">
            <Input
              maxLength={10}
              value={form.language}
              className="font-mono"
              onChange={(event) => setForm({ ...form, language: event.target.value })}
              placeholder="en_US"
            />
          </FormField>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => void reload()}>
            Reload reminder settings
          </Button>
          <Button type="submit">{busy ? 'Saving…' : 'Save reminder settings'}</Button>
        </div>
      </fieldset>
    </form>
  );
}
