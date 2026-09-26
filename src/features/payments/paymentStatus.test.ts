import { describe, it, expect } from 'vitest';
import { getPaymentStatusPresentation, resolveDisplayStatus, isPollableDisplayStatus } from './paymentStatus';

describe('paymentStatus', () => {
  it('maps pending -> Pending', () => {
    expect(getPaymentStatusPresentation('pending').label).toBe('Pending');
    expect(resolveDisplayStatus({ status: 'pending' })).toBe('pending');
  });
  it('maps needs_review -> Needs review', () => {
    expect(getPaymentStatusPresentation('needs_review').label).toBe('Needs review');
    expect(resolveDisplayStatus({ display_status_code: 'needs_review' })).toBe('needs_review');
    expect(isPollableDisplayStatus('needs_review')).toBe(true);
  });
  it('needs_review does NOT show or trigger duplicate payment', () => {
    const p = getPaymentStatusPresentation('needs_review');
    expect(p.description).not.toMatch(/pay again/i);
    expect(p.description).not.toMatch(/try another payment/i);
    expect(p.description).not.toMatch(/make another payment/i);
    expect(p.description).toMatch(/still checking automatically/i);
  });
  it('maps paid -> Paid', () => {
    expect(getPaymentStatusPresentation('paid').label).toBe('Paid');
    expect(resolveDisplayStatus({ display_status_code: 'paid' })).toBe('paid');
  });
  it('maps paid_unfulfilled -> Paid · Fulfilment issue', () => {
    expect(getPaymentStatusPresentation('paid_unfulfilled').label).toBe('Paid · Fulfilment issue');
  });
  it('paid_unfulfilled says payment confirmed and Do not pay again', () => {
    const p = getPaymentStatusPresentation('paid_unfulfilled');
    expect(p.label).toMatch(/Paid/);
    expect(p.description).toMatch(/Payment is confirmed/i);
    expect(p.description).toMatch(/Do not pay again/);
    expect(resolveDisplayStatus({ display_status_code: 'paid_unfulfilled' })).toBe('paid_unfulfilled');
    expect(isPollableDisplayStatus('paid_unfulfilled')).toBe(true);
  });
  it('maps failed -> Failed', () => {
    expect(getPaymentStatusPresentation('failed').label).toBe('Failed');
    expect(getPaymentStatusPresentation('failed').description).toMatch(/did not complete/i);
  });
  it('maps reversed -> Reversed with support state', () => {
    expect(getPaymentStatusPresentation('reversed').label).toBe('Reversed');
    expect(getPaymentStatusPresentation('reversed').description).toMatch(/reversed/i);
    expect(getPaymentStatusPresentation('reversed').description).toMatch(/support/i);
  });
  it('fallback old response success -> paid', () => {
    expect(resolveDisplayStatus({ status: 'success' })).toBe('paid');
  });
  it('fallback old response failed -> failed', () => {
    expect(resolveDisplayStatus({ status: 'failed' })).toBe('failed');
  });
  it('fallback old response reversed -> reversed', () => {
    expect(resolveDisplayStatus({ status: 'reversed' })).toBe('reversed');
  });
  it('fallback old response pending -> pending', () => {
    expect(resolveDisplayStatus({ status: 'pending' })).toBe('pending');
  });
  it('does not derive Needs review from timestamps or browser time', () => {
    // An old pending response that is hours old must still resolve to pending.
    // Backend remains authoritative for the 3-minute Needs Review threshold.
    expect(
      resolveDisplayStatus({
        status: 'pending',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      } as unknown as { status: string }),
    ).toBe('pending');
    expect(resolveDisplayStatus({ status: 'pending' })).not.toBe('needs_review');
    expect(resolveDisplayStatus({ status: 'success' })).not.toBe('needs_review');
  });
  it('backend display_status_code stays authoritative over raw status', () => {
    expect(resolveDisplayStatus({ display_status_code: 'needs_review', status: 'pending' })).toBe(
      'needs_review',
    );
    expect(resolveDisplayStatus({ display_status_code: 'paid_unfulfilled', status: 'success' })).toBe(
      'paid_unfulfilled',
    );
  });
  it('polling: pending/needs_review/paid_unfulfilled poll; paid/failed/reversed stop', () => {
    expect(isPollableDisplayStatus('pending')).toBe(true);
    expect(isPollableDisplayStatus('needs_review')).toBe(true);
    expect(isPollableDisplayStatus('paid_unfulfilled')).toBe(true);
    expect(isPollableDisplayStatus('paid')).toBe(false);
    expect(isPollableDisplayStatus('failed')).toBe(false);
    expect(isPollableDisplayStatus('reversed')).toBe(false);
  });
  it('never exposes internal claim/lease tokens', () => {
    // Resolving status must ignore lease/token fields even if present.
    expect(
      resolveDisplayStatus({
        status: 'pending',
        reconciliation_claim_token: 'secret',
        reconciliation_lease_until: '2026-09-01T00:00:00Z',
      } as unknown as { status: string }),
    ).toBe('pending');
  });
});
