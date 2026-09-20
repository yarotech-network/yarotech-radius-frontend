import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { CustomerGatewaySettings } from './CustomerGatewaySettings';
import { checkoutUrl } from '@/features/storefront/checkoutUrl';

describe('Customer gateway settings', () => {
  it('saves one OPay account and clears write-only credentials after success', async () => {
    let sent: unknown;
    server.use(
      http.get(`${API}/payments/customer-gateway/`, () =>
        HttpResponse.json({ legacy: true, configured: false, provider: 'paystack', mode: null }),
      ),
      http.put(`${API}/payments/customer-gateway/`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          provider: 'opay',
          mode: 'test',
          configured: true,
          legacy: false,
          account_id: 'version-1',
        });
      }),
    );
    renderPage(<CustomerGatewaySettings />, { role: 'owner' });
    await userEvent.selectOptions(await screen.findByLabelText('New active gateway'), 'opay');
    await userEvent.type(screen.getByLabelText(/OPay merchant ID/), '123456789');
    await userEvent.type(screen.getByLabelText(/OPay public key/), 'public-test');
    await userEvent.type(screen.getByLabelText(/OPay private key/), 'private-test');
    await userEvent.click(screen.getByRole('button', { name: 'Save and activate gateway' }));
    await screen.findByText('Gateway saved for new customer purchases.');
    expect(sent).toEqual({
      provider: 'opay',
      mode: 'test',
      merchant_id: '123456789',
      public_key: 'public-test',
      secret_key: 'private-test',
    });
    expect(screen.getByLabelText(/OPay private key/)).toHaveValue('');
    expect(screen.getByLabelText(/OPay public key/)).toHaveValue('');
  });

  it('retains a failed-save draft and keeps configured status unchanged', async () => {
    server.use(
      http.get(`${API}/payments/customer-gateway/`, () =>
        HttpResponse.json({ legacy: true, configured: false, provider: 'paystack', mode: null }),
      ),
      http.put(`${API}/payments/customer-gateway/`, () =>
        HttpResponse.json({ detail: 'Rejected' }, { status: 400 }),
      ),
    );
    renderPage(<CustomerGatewaySettings />, { role: 'owner' });
    await userEvent.type(await screen.findByLabelText(/Paystack secret key/), 'sk_test_draft');
    await userEvent.click(screen.getByRole('button', { name: 'Save and activate gateway' }));
    await waitFor(() =>
      expect(screen.getByText(/The gateway could not be saved/)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/Paystack secret key/)).toHaveValue('sk_test_draft');
    expect(screen.getByText(/Current: Existing Paystack/)).toBeInTheDocument();
  });

  it('does not show credential controls to managers', () => {
    renderPage(<CustomerGatewaySettings />, { role: 'manager' });
    expect(screen.queryByText('Customer payment gateway')).not.toBeInTheDocument();
  });

  it('permits provider checkout URLs and rejects unsafe redirects', () => {
    expect(checkoutUrl('https://sandboxcashier.opaycheckout.com/pay')).toContain(
      'opaycheckout.com',
    );
    for (const url of [
      'https://checkout.paystack.com.evil.test/',
      'http://checkout.paystack.com/',
      'https://user@checkout.paystack.com/',
      'javascript:alert(1)',
    ]) {
      expect(() => checkoutUrl(url)).toThrow();
    }
  });
});
