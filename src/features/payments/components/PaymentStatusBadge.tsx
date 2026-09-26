import { StatusBadge } from '@/components/layout';
import { getPaymentStatusPresentation, resolveDisplayStatus } from '../paymentStatus';
import type { PaymentDisplayStatus } from '@/types/api';

export function PaymentStatusBadge({
  displayStatusCode,
  displayStatusLabel,
  status,
  size = 'sm',
  dot = true,
}: {
  displayStatusCode?: PaymentDisplayStatus | null | undefined;
  displayStatusLabel?: string | null | undefined;
  status?: string | null | undefined;
  size?: 'sm' | 'md';
  dot?: boolean;
}) {
  const code = resolveDisplayStatus({ display_status_code: displayStatusCode, status });
  const presentation = getPaymentStatusPresentation(code);
  const label = displayStatusLabel || presentation.label;
  return (
    <span aria-label={`Payment status ${label}`}>
      <StatusBadge status={code} size={size} dot={dot} />
    </span>
  );
}

export function PaymentStatusMessage({ code }: { code: PaymentDisplayStatus }) {
  const p = getPaymentStatusPresentation(code);
  return (
    <div role="status" aria-live="polite">
      <span className="font-medium">{p.label}</span>
      <span className="ml-2 text-sm text-ink-600">{p.description}</span>
    </div>
  );
}
