import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Ban, Pencil, Printer, RefreshCw, Ticket, Trash2 } from 'lucide-react';
import { PageHeader, StatusBadge } from '@/components/layout';
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
        <>
          <PageHeader title={<Skeleton className="h-7 w-48" />} backTo="/vouchers" />
          <Card>
            <Skeleton className="h-40 w-full" />
          </Card>
        </>
      }
    >
      {(voucher) => (
        <div className="space-y-6">
          <PageHeader
            backTo="/vouchers"
            crumbs={[{ label: 'Vouchers', to: '/vouchers' }, { label: voucher.username }]}
            title={
              <span className="inline-flex flex-wrap items-center gap-3">
                <code className="min-w-0 font-mono break-all">{voucher.username}</code>
                <StatusBadge status={voucher.status} />
              </span>
            }
            description={`${voucher.plan_name} · ${voucher.price_display} · ${describeSource(voucher)}`}
            actions={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={query.isFetching}
                  leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin' : ''} />}
                  onClick={() => void query.refetch()}
                >
                  Refresh voucher
                </Button>
                <CopyButton value={voucher.username} label="Copy username" />
                {canPrint && (
                  <Button
                    variant="secondary"
                    leadingIcon={<Printer className="h-4 w-4" aria-hidden />}
                    loading={printer.printing}
                    onClick={() => void printer.print([voucher.id])}
                  >
                    Print
                  </Button>
                )}
                {canManage && isEditable(voucher) && (
                  <Button
                    variant="secondary"
                    leadingIcon={<Pencil className="h-4 w-4" aria-hidden />}
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                )}
                {canManage && canDisable(voucher) && (
                  <Button
                    variant="danger"
                    leadingIcon={<Ban className="h-4 w-4" aria-hidden />}
                    onClick={() => setConfirm('disable')}
                  >
                    Disable
                  </Button>
                )}
              </div>
            }
          />
          {query.isError && (
            <Alert tone="warning" title="Voucher could not be refreshed">
              Showing the last loaded details. Refresh again to check for changes.
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              <Card padded={false}>
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
              <Card padded={false}>
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
              <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
                <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Ticket className="size-5" aria-hidden />
                </span>
                <h2 className="text-lg font-semibold text-brand-950">Credentials</h2>
                {voucher.access_code ? (
                  <>
                    <p className="mt-1 text-sm text-ink-600">
                      Single access code — the customer enters it as both username and password.
                    </p>
                    <p className="mt-4 flex flex-wrap items-center gap-2">
                      <code className="min-w-0 rounded-lg border border-brand-100 bg-white px-3 py-2 font-mono text-base font-semibold tracking-wide break-all text-brand-950">
                        {voucher.access_code}
                      </code>
                      <CopyButton value={voucher.access_code} label="Copy access code" />
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-ink-600">
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
                <Card>
                  <h2 className="text-sm font-semibold text-danger-700">Delete this voucher</h2>
                  <p className="mt-1 text-sm text-ink-600">
                    Unused vouchers that were never issued can be deleted outright.
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-3"
                    leadingIcon={<Trash2 className="h-4 w-4" aria-hidden />}
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
