import type { PaymentDisplayStatus, ReconciliationState } from '@/types/api';

export const PAYMENT_DISPLAY_STATUSES: PaymentDisplayStatus[] = [
  'pending',
  'needs_review',
  'paid',
  'paid_unfulfilled',
  'failed',
  'reversed',
];

export interface PaymentStatusPresentation {
  code: PaymentDisplayStatus;
  label: string;
  description: string;
  tone: 'neutral' | 'warning' | 'success' | 'danger' | 'info';
}

const MAP: Record<PaymentDisplayStatus, PaymentStatusPresentation> = {
  pending: {
    code: 'pending',
    label: 'Pending',
    description: 'Waiting for payment confirmation.',
    tone: 'info',
  },
  needs_review: {
    code: 'needs_review',
    label: 'Needs review',
    description: 'Confirmation is taking longer than expected. We are still checking automatically.',
    tone: 'warning',
  },
  paid: {
    code: 'paid',
    label: 'Paid',
    description: 'Payment confirmed.',
    tone: 'success',
  },
  paid_unfulfilled: {
    code: 'paid_unfulfilled',
    label: 'Paid · Fulfilment issue',
    description: 'Payment is confirmed, but the purchased service has not been delivered yet. Do not pay again.',
    tone: 'warning',
  },
  failed: {
    code: 'failed',
    label: 'Failed',
    description: 'The payment provider confirmed that this transaction did not complete.',
    tone: 'danger',
  },
  reversed: {
    code: 'reversed',
    label: 'Reversed',
    description: 'The provider reports that this payment was reversed. Contact support if value was already delivered.',
    tone: 'danger',
  },
};

export function getPaymentStatusPresentation(code: PaymentDisplayStatus | string | null | undefined): PaymentStatusPresentation {
  if (code && code in MAP) return MAP[code as PaymentDisplayStatus];
  return MAP.pending;
}

export function resolveDisplayStatus(
  payment: {
    display_status_code?: PaymentDisplayStatus | null | undefined;
    status?: string | null | undefined;
  } | null | undefined,
): PaymentDisplayStatus {
  if (!payment) return 'pending';
  if (payment.display_status_code && PAYMENT_DISPLAY_STATUSES.includes(payment.display_status_code as PaymentDisplayStatus)) {
    return payment.display_status_code as PaymentDisplayStatus;
  }
  // Fallback for older backend without display_status_code
  const s = payment.status;
  if (s === 'success') return 'paid';
  if (s === 'failed') return 'failed';
  if (s === 'reversed') return 'reversed';
  if (s === 'pending') return 'pending';
  return 'pending';
}

export function getDisplayLabel(code: PaymentDisplayStatus | null | undefined, fallback?: string | null): string {
  if (code && code in MAP) return MAP[code as PaymentDisplayStatus].label;
  return fallback ?? 'Pending';
}

export const RECONCILIATION_STATE_LABELS: Record<ReconciliationState, string> = {
  waiting: 'Waiting',
  retrying: 'Retrying',
  needs_review: 'Needs review',
  resolved: 'Resolved',
};

export function isPollableDisplayStatus(code: PaymentDisplayStatus): boolean {
  return code === 'pending' || code === 'needs_review' || code === 'paid_unfulfilled';
}
