import { Link, useNavigate } from 'react-router';
import { LifeBuoy, Check, Copy } from 'lucide-react';
import { Button, CopyButton, DescriptionList, Dialog, Skeleton } from '@/components/ui';
import { Alert, QueryBoundary } from '@/components/feedback';
import { StatusBadge } from '@/components/layout';
import { usePrincipal } from '@/app/auth/useAuth';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatKobo } from '@/lib/formatting/money';
import { can } from '@/services/auth/principal';
import { usePayment } from '../queries';

export function PaymentDrawer({
  paymentId,
  onClose,
  onOpenRecovery,
}: {
  paymentId: number | null;
  onClose: () => void;
  onOpenRecovery?: (id: number) => void;
}) {
  const principal = usePrincipal();
  const navigate = useNavigate();
  const canRecover = can(principal, 'payments.recovery.view');
  const query = usePayment(paymentId ?? NaN);

  return (
    <Dialog
      open={paymentId !== null}
      onClose={onClose}
      variant="drawer"
      size="md"
      title="Payment Transaction"
      description={query.data ? query.data.reference : undefined}
    >
      {paymentId !== null && (
        <QueryBoundary
          query={query}
          compact
          errorTitle="Payment not found"
          skeleton={<Skeleton className="h-64 w-full rounded-xl" />}
        >
          {(p) => (
            <div className="flex flex-col gap-6">
              {/* Amount & Status Hero Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50/70 via-surface to-sky-50/50 dark:from-brand-950/40 dark:via-surface dark:to-slate-900/40 px-5 py-5 shadow-sm">
                <div>
                  <p className="text-xs font-medium text-ink-500">Transaction Amount</p>
                  <p className="text-3xl font-bold text-ink-900 tabular-nums">
                    {formatKobo(p.amount)}
                  </p>
                </div>
                <StatusBadge status={p.status} size="md" dot />
              </div>

              {p.status === 'success' && !p.voucher && (
                <Alert tone="warning" title="Paid, no voucher">
                  Payment is recorded as successful, but no voucher is linked yet.{' '}
                  {canRecover
                    ? 'Open recovery below to review fulfilment.'
                    : 'Ask a manager to review fulfilment.'}
                </Alert>
              )}

              <DescriptionList
                columns={2}
                items={[
                  {
                    label: 'Reference',
                    value: (
                      <span className="inline-flex max-w-full flex-wrap items-center gap-2 font-mono text-[13px] font-semibold break-all text-brand-700 dark:text-brand-300">
                        {p.reference}
                        <CopyButton value={p.reference} label="Copy reference" />
                      </span>
                    ),
                    span: 2,
                  },
                  { label: 'Customer', value: p.customer_name || null },
                  {
                    label: 'Email',
                    value: p.customer_email ? (
                      <a
                        href={`mailto:${p.customer_email}`}
                        className="break-all font-medium text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        {p.customer_email}
                      </a>
                    ) : null,
                  },
                  { label: 'Phone', value: p.customer_phone || null, mono: true },
                  { label: 'Paystack reference', value: p.paystack_reference || null, mono: true },
                  {
                    label: 'Voucher',
                    value: p.voucher ? (
                      <Link
                        to={`/vouchers/${p.voucher}`}
                        className="font-mono font-bold text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        {p.voucher_username}
                      </Link>
                    ) : (
                      <span className="text-ink-400">Not issued</span>
                    ),
                  },
                  { label: 'Plan', value: p.plan ? `#${p.plan}` : null },
                  { label: 'Created', value: formatDateTime(p.created_at) },
                  { label: 'Paid', value: p.paid_at ? formatDateTime(p.paid_at) : null },
                ]}
              />

              {canRecover && p.status === 'success' && (
                <div className="border-t border-border pt-4">
                  <Button
                    variant="secondary"
                    leadingIcon={<LifeBuoy className="size-4" aria-hidden />}
                    onClick={() => {
                      if (onOpenRecovery) {
                        onOpenRecovery(p.id);
                      } else {
                        navigate(`/payments/recovery?payment=${p.id}`);
                      }
                    }}
                  >
                    {p.voucher ? 'Resend credentials…' : 'Recover this payment…'}
                  </Button>
                  <p className="mt-2 text-xs leading-relaxed text-ink-500">
                    {p.voucher
                      ? 'Email the voucher to the customer again from the recovery board.'
                      : 'The customer paid but no voucher was issued — retry fulfilment from the recovery board.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </QueryBoundary>
      )}
    </Dialog>
  );
}
