import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, ShoppingBag, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import { Alert, QueryBoundary } from '@/components/feedback';
import { Button, Card, Checkbox, ConfirmDialog, FormField, Input, Skeleton } from '@/components/ui';
import { StatusBadge } from '@/components/layout';
import type { Paginated } from '@/types/api';

interface ReminderSettings {
  version: string | null;
  enabled: boolean; unused_enabled: boolean; expiry_enabled: boolean;
  unused_hours: number; short_lead_hours: number; medium_lead_hours: number; long_lead_hours: number;
  unused_template: string; expiry_template: string; language: string;
}
interface Order {
  id: number; state: string; payment_status: string; fulfilled: boolean;
  error_code: string; delivery_state: string | null; created_at: string;
}

export function WorkflowControls({ scope }: { scope: number | null }) {
  const principal = usePrincipal();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ id: number; type: 'recheck' | 'resend'; requestId: string } | null>(null);
  const [notice, setNotice] = useState('');
  const reminderQuery = useQuery({ 
    queryKey: ['whatsapp-reminders', principal.user.id, scope],
    queryFn: () => http.get<ReminderSettings>('/whatsapp/reminders/'), 
    enabled: open && scope !== null 
  });
  const orderQuery = useQuery({ 
    queryKey: ['whatsapp-orders', principal.user.id, scope, page],
    queryFn: () => http.get<Paginated<Order>>(`/whatsapp/orders/?page=${page}`), 
    enabled: open && scope !== null 
  });

  return (
    <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
            <ShoppingBag className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">WhatsApp Orders & Voucher Reminders</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Track automated customer orders, voucher deliveries, and expiry reminders.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(!open)}>
          {open ? 'Hide details' : 'Manage orders & reminders'}
        </Button>
      </div>

      {open && (
        <div className="space-y-6 pt-2 border-t border-slate-100 dark:border-slate-800">
          {notice && <Alert tone="success" title="Request recorded">{notice}</Alert>}

          <QueryBoundary query={reminderQuery} skeleton={<Skeleton className="h-40 w-full" />}>
            {(data) => <ReminderForm key={`${scope}:${data.version}`} data={data} reload={() => reminderQuery.refetch()} />}
          </QueryBoundary>

          <QueryBoundary query={orderQuery} skeleton={<Skeleton className="h-48 w-full" />}>
            {(data) => (
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="size-4 text-slate-500 dark:text-slate-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">WhatsApp Automated Purchases</h3>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void orderQuery.refetch()} leadingIcon={<RefreshCw className="size-3.5" />}>
                    Refresh orders
                  </Button>
                </div>

                {!data.results.length ? (
                  <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    No WhatsApp orders recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.results.map((order) => (
                      <div key={order.id} className="space-y-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">Order #{order.id}</span>
                            <StatusBadge status={order.payment_status} size="sm" />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="size-3.5" />
                            <span>{order.created_at}</span>
                          </div>
                        </div>

                        <div className="grid gap-2 text-xs sm:grid-cols-2 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-500 dark:text-slate-400">Processing:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{order.state}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-500 dark:text-slate-400">Voucher:</span>
                            {order.fulfilled ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="size-3.5" /> Issued
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">Not issued</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 sm:col-span-2">
                            <span className="font-medium text-slate-500 dark:text-slate-400">Delivery State:</span>
                            <span className="font-mono">{order.delivery_state || 'Not queued'}</span>
                          </div>
                        </div>

                        {order.error_code && (
                          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                            <AlertCircle className="size-4 shrink-0" />
                            <span>Needs review: <strong>{order.error_code.replaceAll('_', ' ')}</strong></span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                          {!order.fulfilled && (
                            <Button size="sm" variant="secondary" onClick={() => setAction({ id: order.id, type: 'recheck', requestId: crypto.randomUUID() })}>
                              Recheck payment #{order.id}
                            </Button>
                          )}
                          {order.fulfilled && (
                            <Button size="sm" variant="secondary" onClick={() => setAction({ id: order.id, type: 'resend', requestId: crypto.randomUUID() })}>
                              Resend voucher #{order.id}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {data.total_pages > 1 && (
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <Button variant="secondary" size="sm" disabled={data.current_page <= 1} onClick={() => setPage(page - 1)}>
                      Previous orders
                    </Button>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Page {data.current_page} of {data.total_pages}</span>
                    <Button variant="secondary" size="sm" disabled={data.current_page >= data.total_pages} onClick={() => setPage(page + 1)}>
                      Next orders
                    </Button>
                  </div>
                )}
              </div>
            )}
          </QueryBoundary>
        </div>
      )}

      <ConfirmDialog 
        open={action !== null} 
        onClose={() => setAction(null)}
        title={action?.type === 'resend' ? 'Send voucher code again?' : 'Recheck existing payment reference?'}
        description={action?.type === 'resend' ? 'The customer may receive another copy if a previous delivery succeeded.' : 'This verifies the payment gateway reference without double-charging.'}
        confirmLabel={action?.type === 'resend' ? 'Confirm Resend' : 'Confirm Recheck'}
        onConfirm={async () => {
          if (!action) return;
          await http.post(`/whatsapp/orders/${action.id}/recover/`, { action: action.type, request_id: action.requestId, acknowledge_duplicate_risk: action.type === 'resend' });
          setNotice('The worker will process the recovery request. Refresh the order to check its outcome.');
          await orderQuery.refetch();
        }} 
      />
    </Card>
  );
}

function ReminderForm({ data, reload }: { data: ReminderSettings; reload: () => Promise<unknown> }) {
  const [form, setForm] = useState(data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);

  if (!data.version) {
    return (
      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
        Create your shared-number business link above before configuring customer reminders.
      </div>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const { version, ...values } = form;
      await http.put('/whatsapp/reminders/', { ...values, expected_version: version });
      await reload();
    } catch (err) { setError(errorMessage(err)); }
    finally { saving.current = false; setBusy(false); }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-purple-600 dark:text-purple-400" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Automated Customer Reminders</h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Customers opt in with <strong>REMINDERS ON</strong> and opt out with <strong>REMINDERS OFF</strong>. Use Meta-approved WhatsApp template names.
      </p>

      {error && <Alert tone="danger" title="Could not save reminders">{error}</Alert>}

      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <Checkbox label="Enable Reminders System" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          <Checkbox label="Unused Voucher Alerts" checked={form.unused_enabled} onChange={(event) => setForm({ ...form, unused_enabled: event.target.checked })} />
          <Checkbox label="Expiring Plan Alerts" checked={form.expiry_enabled} onChange={(event) => setForm({ ...form, expiry_enabled: event.target.checked })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Unused Voucher Delay (hrs)">
            <Input type="number" min={1} max={720} required value={form.unused_hours} onChange={(event) => setForm({ ...form, unused_hours: Number(event.target.value) })} />
          </FormField>
          <FormField label="Short Plan Expiry Notice (hrs)">
            <Input type="number" min={1} max={24} required value={form.short_lead_hours} onChange={(event) => setForm({ ...form, short_lead_hours: Number(event.target.value) })} />
          </FormField>
          <FormField label="Medium Plan Expiry Notice (hrs)">
            <Input type="number" min={1} max={168} required value={form.medium_lead_hours} onChange={(event) => setForm({ ...form, medium_lead_hours: Number(event.target.value) })} />
          </FormField>
          <FormField label="Long Plan Expiry Notice (hrs)">
            <Input type="number" min={1} max={720} required value={form.long_lead_hours} onChange={(event) => setForm({ ...form, long_lead_hours: Number(event.target.value) })} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Approved Unused-Voucher Template">
            <Input maxLength={80} value={form.unused_template} onChange={(event) => setForm({ ...form, unused_template: event.target.value })} placeholder="e.g. unused_voucher_notice" />
          </FormField>
          <FormField label="Approved Expiry Template">
            <Input maxLength={80} value={form.expiry_template} onChange={(event) => setForm({ ...form, expiry_template: event.target.value })} placeholder="e.g. plan_expiring_notice" />
          </FormField>
          <FormField label="Template Language Code">
            <Input maxLength={10} value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} placeholder="en_US" />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit">{busy ? 'Saving...' : 'Save Reminder Settings'}</Button>
          <Button type="button" variant="secondary" onClick={() => void reload()}>Reload Settings</Button>
        </div>
      </fieldset>
    </form>
  );
}

