import { http, HttpResponse } from 'msw';
import { expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type { TenantSetting } from '@/types/api';
import BillingSettingsPage from './pages/BillingSettingsPage';

const original: TenantSetting = {
  id: 1,
  tenant: 5,
  agent_commission_percent: '10.00',
  agent_funding_fee_percent: '0.00',
  agent_funding_flat_fee: 1050,
  voucher_prefix: 'WH',
  default_voucher_code_format: 'legacy',
  max_funding_amount: 5000000,
  updated_at: '2026-09-20T10:00:00Z',
};

function setup() {
  let saved = { ...original };
  const patches: Record<string, unknown>[] = [];
  server.use(
    http.get(`${API}/tenants/settings/`, () => HttpResponse.json(saved)),
    http.patch(`${API}/tenants/settings/`, async ({ request }) => {
      const patch = (await request.json()) as Record<string, unknown>;
      patches.push(patch);
      const { paystack_secret_key: secret, ...publicFields } = patch;
      void secret;
      saved = { ...saved, ...publicFields };
      return HttpResponse.json(saved);
    }),
  );
  renderPage(<BillingSettingsPage />, { role: 'manager' });
  return patches;
}

it('saves decimal fees, preserves Naira after saving, and clears replacement keys', async () => {
  const patches = setup();
  const user = userEvent.setup();
  const fee = await screen.findByLabelText('Agent funding percentage fee (%)');
  const flat = screen.getByLabelText('Agent funding flat fee (Naira)');
  const commission = screen.getByLabelText('Agent commission rate (%)');
  expect(flat).toHaveValue(10.5);
  for (const [input, value] of [
    [fee, '2.50'],
    [flat, '25.75'],
    [commission, '12.50'],
  ] as const) {
    await user.clear(input);
    await user.type(input, value);
  }
  await user.type(screen.getByLabelText('Paystack secret key'), 'sk_test_replacement');
  await user.click(screen.getByRole('button', { name: 'Save preferences' }));
  await waitFor(() =>
    expect(patches).toEqual([
      {
        agent_funding_fee_percent: '2.5',
        agent_funding_flat_fee: 2575,
        agent_commission_percent: '12.5',
        paystack_secret_key: 'sk_test_replacement',
      },
    ]),
  );
  await waitFor(() => expect(screen.getByLabelText('Paystack secret key')).toHaveValue(''));
  expect(flat).toHaveValue(25.75);
  await user.clear(screen.getByLabelText('Voucher prefix'));
  await user.type(screen.getByLabelText('Voucher prefix'), 'NEW');
  await user.click(screen.getByRole('button', { name: 'Save preferences' }));
  await waitFor(() => expect(patches[1]).toEqual({ voucher_prefix: 'NEW' }));
  expect(screen.queryByText(/expected string/)).not.toBeInTheDocument();
});

it('saves an unrelated edit without resubmitting untouched numeric values', async () => {
  const patches = setup();
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Voucher prefix'), 'X');
  await user.click(screen.getByRole('button', { name: 'Save preferences' }));
  await waitFor(() => expect(patches).toEqual([{ voucher_prefix: 'WHX' }]));
});

it('rejects empty fees and percentages above 100 with useful validation messages', async () => {
  const patches = setup();
  const user = userEvent.setup();
  await user.clear(await screen.findByLabelText('Agent funding percentage fee (%)'));
  await user.clear(screen.getByLabelText('Agent funding flat fee (Naira)'));
  const commission = screen.getByLabelText('Agent commission rate (%)');
  await user.clear(commission);
  await user.type(commission, '101');
  await user.click(screen.getByRole('button', { name: 'Save preferences' }));
  expect(await screen.findByText('At most 100%')).toBeInTheDocument();
  expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(2);
  expect(patches).toEqual([]);
});
