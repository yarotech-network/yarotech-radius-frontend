import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import RecoveryPage from './pages/RecoveryPage';

describe('recovery sensitive fields (Phase 3B)', () => {
  it('never renders internal claim/lease tokens, secrets or raw provider payloads', async () => {
    const row = {
      id: 7,
      reference: 'PAY-TOKEN-007',
      amount: 50000,
      status: 'success',
      voucher: null,
      fulfillment_status: 'paid_unfulfilled',
      delivery_status: 'not_requested',
      verified_at: null,
      display_status_code: 'paid_unfulfilled',
      display_status_label: 'Paid · Fulfilment issue',
      provider_status: 'success',
      reconciliation_state: 'retrying',
      verification_attempts: 2,
      last_verified_at: '2026-09-01T10:00:00Z',
      next_reconciliation_at: '2026-09-01T10:05:00Z',
      fulfilment_attempts: 1,
      last_fulfilment_attempt_at: '2026-09-01T10:01:00Z',
      reconciliation_error: 'provider timeout',
      // backend-only / sensitive fields that must never be displayed
      reconciliation_claim_token: 'super-secret-claim-token',
      reconciliation_lease_until: '2026-09-01T10:10:00Z',
      secret_key: 'sk-live-secret',
      api_key: 'pk-live-key',
      raw_provider_payload: { secret: 'payload-secret' },
    };
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
      http.get(`${API}/payment-recovery/`, () => HttpResponse.json(paginated([row]))),
      http.get(`${API}/payment-recovery/:id/`, () => HttpResponse.json(row)),
      http.get(`${API}/payment-deliveries/`, () => HttpResponse.json(paginated([]))),
    );
    renderPage(<RecoveryPage />, {
      path: '/payments/recovery',
      route: '/payments/recovery?payment=7',
      role: 'manager',
    });
    const dialog = await screen.findByRole('dialog', { name: 'Recover payment' });
    // Wait for the recovery detail to load before asserting on its content.
    await within(dialog).findByText(/Financial status/);
    expect(dialog).toBeInTheDocument();
    // legitimate reconciliation info is shown
    expect(dialog.textContent).toMatch(/Provider payment confirmed/);
    // sensitive internals are never rendered
    expect(dialog.textContent).not.toMatch(/super-secret-claim-token/);
    expect(dialog.textContent).not.toMatch(/sk-live-secret/);
    expect(dialog.textContent).not.toMatch(/pk-live-key/);
    expect(dialog.textContent).not.toMatch(/payload-secret/);
    expect(dialog.textContent).not.toMatch(/reconciliation_claim_token/);
    expect(dialog.textContent).not.toMatch(/reconciliation_lease_until/);
  });
});
