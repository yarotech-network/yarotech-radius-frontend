import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import PaymentResultPage from './PaymentResultPage';
import { pendingCheckout } from '../pendingCheckout';

beforeEach(() => {
  localStorage.clear();
});

function renderResult(reference: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/pay/result" element={<PaymentResultPage />} />
    </Routes>,
    { route: `/pay/result?reference=${reference}` },
  );
}

function callback(payload: Record<string, unknown>) {
  server.use(
    http.get(`${API}/payments/callback/`, () => HttpResponse.json(payload)),
    http.post(`${API}/payments/verify/`, () => HttpResponse.json(payload)),
  );
}

describe('PaymentResultPage display status (Phase 3B)', () => {
  it('needs_review does NOT offer duplicate payment', async () => {
    callback({ status: 'pending', reference: 'ref-review', voucher: null, display_status_code: 'needs_review', display_status_label: 'Needs review' });
    renderResult('ref-review');
    expect(await screen.findByText('Confirmation is taking longer than expected')).toBeInTheDocument();
    expect(screen.getByText(/Do not make another payment/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check payment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay again/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Try another payment/i })).not.toBeInTheDocument();
  });

  it('paid_unfulfilled says payment confirmed + Do not pay again, only Check again/support', async () => {
    callback({ status: 'success', reference: 'ref-unfulfilled', voucher: null, fulfilled: false, display_status_code: 'paid_unfulfilled', display_status_label: 'Paid · Fulfilment issue' });
    renderResult('ref-unfulfilled');
    expect(await screen.findByText('Payment confirmed')).toBeInTheDocument();
    expect(screen.getByText(/Do not make another payment for this purchase/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay again/i })).not.toBeInTheDocument();
  });

  it('failed may offer a new payment as a new transaction', async () => {
    pendingCheckout.save({ kind: 'voucher', reference: 'ref-failed', slug: 'wuse-hotspot' });
    callback({ status: 'failed', reference: 'ref-failed', voucher: null, display_status_code: 'failed' });
    renderResult('ref-failed');
    expect(await screen.findByText('Payment failed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try another payment' })).toBeInTheDocument();
  });

  it('reversed shows support/reversal state, not ordinary failure', async () => {
    callback({ status: 'reversed', reference: 'ref-reversed', voucher: null, display_status_code: 'reversed' });
    renderResult('ref-reversed');
    expect(await screen.findByText('Payment reversed')).toBeInTheDocument();
    expect(screen.getByText(/was reversed/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Try another payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay again/i })).not.toBeInTheDocument();
  });

  it('pending keeps existing payment check without encouraging another payment', async () => {
    callback({ status: 'pending', reference: 'ref-pending', voucher: null, display_status_code: 'pending' });
    renderResult('ref-pending');
    expect(await screen.findByText('Waiting for confirmation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay again/i })).not.toBeInTheDocument();
  });
});
