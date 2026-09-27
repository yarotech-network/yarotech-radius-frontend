import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

describe('PaymentResultPage verify-on-return', () => {
  function mockFlows(callbackPayload: Record<string, unknown>, verifyPayload: Record<string, unknown>) {
    const verifyCalls: unknown[] = [];
    const buyCalls: unknown[] = [];
    server.use(
      http.get(`${API}/payments/callback/`, () => HttpResponse.json(callbackPayload)),
      http.post(`${API}/payments/verify/`, async ({ request }) => {
        verifyCalls.push(await request.json());
        return HttpResponse.json(verifyPayload);
      }),
      http.post(`${API}/buy/`, async ({ request }) => {
        buyCalls.push(await request.json());
        return HttpResponse.json({ error: 'must not initialize' }, { status: 500 });
      }),
    );
    return { verifyCalls, buyCalls };
  }

  const pendingCallback = { status: 'pending', reference: 'ref-return', voucher: null, display_status_code: 'pending' };

  it('verifies a pending reference immediately, exactly once', async () => {
    const { verifyCalls, buyCalls } = mockFlows(pendingCallback, pendingCallback);
    renderResult('ref-return');
    expect(await screen.findByText('Waiting for confirmation')).toBeInTheDocument();
    await waitFor(() => expect(verifyCalls).toHaveLength(1));
    expect(verifyCalls[0]).toMatchObject({ reference: 'ref-return' });
    expect(buyCalls).toHaveLength(0);
  });

  it('does not verify again on re-render of the same reference', async () => {
    const { verifyCalls } = mockFlows(pendingCallback, pendingCallback);
    const view = renderResult('ref-return');
    expect(await screen.findByText('Waiting for confirmation')).toBeInTheDocument();
    await waitFor(() => expect(verifyCalls).toHaveLength(1));
    view.rerender(
      <Routes>
        <Route path="/pay/result" element={<PaymentResultPage />} />
      </Routes>,
    );
    await waitFor(() => expect(screen.getByText('Waiting for confirmation')).toBeInTheDocument());
    expect(verifyCalls).toHaveLength(1);
  });

  it('abandoned provider truth renders Failed within the return', async () => {
    mockFlows(pendingCallback, { status: 'failed', reference: 'ref-return', voucher: null, display_status_code: 'failed', provider_status: 'abandoned' });
    renderResult('ref-return');
    expect(await screen.findByText('Payment failed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay again/i })).not.toBeInTheDocument();
  });

  it('failed provider truth renders Failed', async () => {
    mockFlows(pendingCallback, { status: 'failed', reference: 'ref-return', voucher: null, display_status_code: 'failed' });
    renderResult('ref-return');
    expect(await screen.findByText('Payment failed')).toBeInTheDocument();
  });

  it('success renders the Paid flow without a new checkout', async () => {
    const { buyCalls } = mockFlows(pendingCallback, {
      status: 'success', reference: 'ref-return', fulfilled: true, voucher: null,
      access_code: null, code_revealed: false, display_status_code: 'paid',
    });
    renderResult('ref-return');
    expect(await screen.findByText('Payment successful')).toBeInTheDocument();
    expect(buyCalls).toHaveLength(0);
  });

  it('unresolved pending stays Pending', async () => {
    mockFlows(pendingCallback, pendingCallback);
    renderResult('ref-return');
    expect(await screen.findByText('Waiting for confirmation')).toBeInTheDocument();
    expect(screen.queryByText('Payment failed')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment successful')).not.toBeInTheDocument();
  });

  it('needs_review stays in review state', async () => {
    const review = { status: 'pending', reference: 'ref-return', voucher: null, display_status_code: 'needs_review', display_status_label: 'Needs review' };
    mockFlows(review, review);
    renderResult('ref-return');
    expect(await screen.findByText('Confirmation is taking longer than expected')).toBeInTheDocument();
    expect(screen.queryByText('Payment failed')).not.toBeInTheDocument();
  });

  it('provider unavailable does not falsely show Failed', async () => {
    server.use(
      http.get(`${API}/payments/callback/`, () => HttpResponse.json(pendingCallback)),
      http.post(`${API}/payments/verify/`, () => HttpResponse.json({ detail: 'unavailable' }, { status: 503 })),
    );
    renderResult('ref-return');
    expect(await screen.findByText('Waiting for confirmation')).toBeInTheDocument();
    expect(screen.queryByText('Payment failed')).not.toBeInTheDocument();
  });

  it('multi-device purchase fulfils the snapshotted device limit exactly once', async () => {
    const paid3 = {
      status: 'success', reference: 'ref-multi', fulfilled: true,
      voucher: 'WH84QRKP', access_code: 'WH84QRKP', code_revealed: true,
      display_status_code: 'paid',
      plan: { name: 'Daily 1GB', duration_hours: 24, data_limit: 1024, device_limit: 3 },
      tenant_name: 'Wuse Hotspot', customer_email_masked: 'a•••@example.com',
    };
    const verifyCalls: unknown[] = [];
    server.use(
      http.get(`${API}/payments/callback/`, () => HttpResponse.json({ status: 'pending', reference: 'ref-multi', voucher: null })),
      http.post(`${API}/payments/verify/`, async ({ request }) => {
        verifyCalls.push(await request.json());
        return HttpResponse.json(paid3);
      }),
    );
    renderResult('ref-multi');
    expect(await screen.findByText('Payment successful')).toBeInTheDocument();
    expect(screen.getByText(/3 devices/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Access code' })).toHaveTextContent('WH84QRKP');
    await waitFor(() => expect(verifyCalls).toHaveLength(1));
  });
});
