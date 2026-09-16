import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Ban, Pencil, Printer, RefreshCw, Ticket, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  CopyButton,
  DescriptionList,
  Dialog,
  Skeleton,
} from '@/components/ui';
import { Alert, QueryBoundary, useToast } from '@/components/feedback';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { formatHours } from '@/lib/formatting/units';
import { can } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import { ManualVoucherForm } from '../components/ManualVoucherForm';
import { usePrintVouchers } from '../hooks/usePrintVouchers';
import { useDeleteVoucher, useDisableVoucher, useVoucher } from '../queries';
import { canDisable, describeSource, isEditable } from '../voucherRules';

export default function VoucherDetailPage() {
  const { id } = useParams();
  const voucherId = Number(id);
  const principal = usePrincipal();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useVoucher(voucherId);
  const disable = useDisableVoucher();
  const remove = useDeleteVoucher();
  const printer = usePrintVouchers();
  const [confirm, setConfirm] = useState<'disable' | 'delete' | null>(null);
  const editing = searchParams.get('edit') === '1';
  const setEditing = (on: boolean) => setSearchParams(on ? { edit: '1' } : {}, { replace: true });
  const canManage = can(principal, 'vouchers.manage');
  const canPrint = can(principal, 'vouchers.print');

  return (
    <QueryBoundary
      query={query}
      errorTitle="Voucher not found"
      skeleton={
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Card>
            <Skeleton className="h-40 w-full" />
          </Card>
        </div>
      }
    >
      {(voucher) => (
        <div className="space-y-6">
          {/* Premium Hero Header */}
          <div className="router-page-hero">
            <div className="router-page-hero-inner">
              <div className="router-page-hero-text">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/vouchers')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-200 hover:text-white transition"
                  >
                    <ArrowLeft className="size-3.5" /> Back to Vouchers
                  </button>
                  <span className="text-white/30">|</span>
                  <StatusBadge status={voucher.status} />
                </div>
                <h1 className="router-page-hero-title font-mono tracking-wider break-all">
                  {voucher.username}
                </h1>
                <p className="router-page-hero-desc">
                  {voucher.plan_name} · {voucher.price_display} · {describeSource(voucher)}
                </p>
              </div>
              <div className="router-page-hero-actions">
                <Button
                  variant="secondary"
                  disabled={query.isFetching}
                  leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />}
                  onClick={() => void query.refetch()}
                >
                  {query.isFetching ? 'Refreshing...' : 'Refresh'}
                </Button>
                <CopyButton value={voucher.username} label="Copy username" />
                {canPrint && (
                  <Button
                    variant="secondary"
                    leadingIcon={<Printer className="size-4" aria-hidden />}
                    loading={printer.printing}
                    onClick={() => void printer.print([voucher.id])}
                  >
                    Print
                  </Button>
                )}
                {canManage && isEditable(voucher) && (
                  <Button
                    variant="secondary"
                    leadingIcon={<Pencil className="size-4" aria-hidden />}
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                )}
                {canManage && canDisable(voucher) && (
                  <Button
                    variant="danger"
                    leadingIcon={<Ban className="size-4" aria-hidden />}
                    onClick={() => setConfirm('disable')}
                  >
                    Disable
                  </Button>
                )}
              </div>
            </div>
          </div>

          {query.isError && (
            <Alert tone="warning" title="Voucher could not be refreshed">
              Showing the last loaded details. Refresh again to check for changes.
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              <Card padded={false} className="border-border/70">
                <CardHeader
                  title="Plan and usage limits"
                  description="The package and device allowance attached to this voucher."
                  className="px-5 pt-5"
                />
                <DescriptionList
                  className="px-5 pb-5"
                  columns={2}
                  items={[
                    { label: 'Plan', value: voucher.plan_name },
                    { label: 'Duration', value: formatHours(voucher.plan_duration) },
                    { label: 'Price', value: voucher.price_display },
                    {
                      label: 'Device limit',
                      value: `${voucher.device_limit} ${voucher.device_limit === 1 ? 'device' : 'devices'}`,
                    },
                  ]}
                />
              </Card>

              <Card padded={false} className="border-border/70">
                <CardHeader
                  title="Voucher lifecycle"
                  description="Recorded creation, activation and expiry dates."
                  className="px-5 pt-5"
                />
                <DescriptionList
                  className="px-5 pb-5"
                  columns={2}
                  items={[
                    { label: 'Source', value: describeSource(voucher) },
                    {
                      label: 'Created',
                      value: (
                        <span title={formatDateTime(voucher.created_at)}>
                          {formatDateTime(voucher.created_at)}
                        </span>
                      ),
                    },
                    {
                      label: 'Activated',
                      value: voucher.activated_at
                        ? formatDateTime(voucher.activated_at)
                        : voucher.status === 'unused'
                          ? 'Not yet used'
                          : 'Not available',
                    },
                    {
                      label: 'Expires',
                      value: voucher.expires_at
                        ? `${formatDateTime(voucher.expires_at)} (${formatRelative(voucher.expires_at)})`
                        : voucher.status === 'unused'
                          ? 'Starts counting at first login'
                          : '—',
                    },
                  ]}
                />
              </Card>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <Card className="border-brand-200 bg-gradient-to-br from-brand-50/70 via-surface to-sky-50/50 dark:from-brand-950/40 dark:via-surface dark:to-slate-900/40">
                <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
                  <Ticket className="size-5" aria-hidden />
                </span>
                <h2 className="text-lg font-semibold text-ink-900">Credentials</h2>
                {voucher.access_code ? (
                  <>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">
                      Single access code — the customer enters it as both username and password.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <code className="min-w-0 rounded-xl border border-brand-200 bg-surface px-4 py-2.5 font-mono text-lg font-bold tracking-wider break-all text-brand-700 dark:text-brand-300 dark:border-brand-800 shadow-inner">
                        {voucher.access_code}
                      </code>
                      <CopyButton value={voucher.access_code} label="Copy access code" />
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">
                    This voucher has a separate password that is never shown in the app.{' '}
                    {canPrint
                      ? 'Use Print to produce a card with both the username and password.'
                      : 'A manager can print the card for the customer.'}
                  </p>
                )}
              </Card>

              {voucher.status === 'unused' && voucher.generation_source !== 'admin' && (
                <Alert tone="info">
                  Sold {voucher.generation_source === 'agent' ? 'by an agent' : 'online'} — it
                  cannot be edited or deleted, only disabled.
                </Alert>
              )}

              {canManage && isEditable(voucher) && (
                <Card className="border-danger-200 dark:border-danger-900/60">
                  <h2 className="text-sm font-semibold text-danger-700 dark:text-danger-400">Delete this voucher</h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Unused vouchers that were never issued can be deleted outright.
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-3"
                    leadingIcon={<Trash2 className="size-4" aria-hidden />}
                    onClick={() => setConfirm('delete')}
                  >
                    Delete voucher
                  </Button>
                </Card>
              )}
            </div>
          </div>

          <Dialog
            open={editing && canManage && isEditable(voucher)}
            onClose={() => setEditing(false)}
            variant="drawer"
            title={`Edit ${voucher.username}`}
            description="Changing the credentials rewrites what the hotspot accepts."
          >
            {editing && canManage && isEditable(voucher) && (
              <ManualVoucherForm
                voucher={voucher}
                onCancel={() => setEditing(false)}
                onSaved={(saved) => {
                  setEditing(false);
                  toast.success('Voucher updated');
                  if (saved.id !== voucher.id) navigate(`/vouchers/${saved.id}`, { replace: true });
                }}
              />
            )}
          </Dialog>

          <ConfirmDialog
            open={confirm === 'disable' && canManage && canDisable(voucher)}
            onClose={() => setConfirm(null)}
            tone="danger"
            title={`Disable ${voucher.username}?`}
            description="The code stops working immediately and cannot be re-enabled."
            confirmLabel="Disable voucher"
            onConfirm={async () => {
              if (!canManage || !canDisable(voucher)) return;
              await disable.mutateAsync(voucher.id);
              toast.success('Voucher disabled');
            }}
          />

          <ConfirmDialog
            open={confirm === 'delete' && canManage && isEditable(voucher)}
            onClose={() => setConfirm(null)}
            tone="danger"
            title={`Delete ${voucher.username}?`}
            description="This removes the voucher and its hotspot credentials permanently."
            confirmLabel="Delete voucher"
            typeToConfirm={voucher.username}
            onConfirm={async () => {
              if (!canManage || !isEditable(voucher)) return;
              await remove.mutateAsync(voucher.id);
              toast.success('Voucher deleted');
              navigate('/vouchers', { replace: true });
            }}
          />
        </div>
      )}
    </QueryBoundary>
  );
}
