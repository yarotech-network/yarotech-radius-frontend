import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type { AgentProfile } from '@/types/api';
import { AgentCreditPanel } from './components/AgentCreditPanel';
import { creditQuote, readPendingCredit } from './creditApi';

const agent: AgentProfile = {
  id: 1,
  user: 10,
  tenant: 5,
  username: 'reseller',
  phone: '',
  shop_name: '',
  status: 'active',
  commission_rate: '10.00',
  wallet_balance: 0,
  created_at: '2026-09-15T10:00:00Z',
};
const batch = {
  id: 7,
  plan: 1,
  quantity: 2,
  unit_price: 9000,
  total: 18000,
  repaid: 4000,
  cancelled_debt: 0,
  outstanding: 14000,
  due_date: null,
  note: '',
  reversed_at: null,
  reversal_reason: '',
};
const account = {
  exists: true,
  credit_limit: 100000,
  current_balance: 18000,
  available_credit: 82000,
  is_active: true,
  requires_review: false,
};
beforeEach(() => {
  sessionStorage.clear();
  server.use(
    http.get(`${API}/tenant/agents/1/credit/`, () => HttpResponse.json(account)),
    http.get(`${API}/tenant/agents/1/credit-batches/`, () => HttpResponse.json(paginated([batch]))),
    http.get(`${API}/tenant/agents/1/credit-history/`, () => HttpResponse.json(paginated([]))),
    http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
  );
});

describe('credit workflow', () => {
  it('rounds per voucher before multiplying quantity', () => {
    expect(creditQuote(101, '10.00', 2)).toBe(182);
    expect(creditQuote(10001, '12.50', 3)).toBe(26253);
  });

  it('explains cancellation without refund and reuses the request after an uncertain result', async () => {
    const requests: unknown[] = [];
    server.use(
      http.post(`${API}/tenant/agents/1/credit-reverse/`, async ({ request }) => {
        requests.push(await request.json());
        return requests.length === 1
          ? HttpResponse.json({ detail: 'Connection interrupted' }, { status: 503 })
          : HttpResponse.json({
              ...batch,
              outstanding: 0,
              cancelled_debt: 14000,
              reversed_at: '2026-09-15T10:00:00Z',
            });
      }),
    );
    const user = userEvent.setup();
    renderPage(<AgentCreditPanel agent={agent} />, { role: 'owner' });
    await user.click(
      await screen.findByRole('button', { name: 'Cancel unused allocation' }, { timeout: 5000 }),
    );
    expect(screen.getByText(/No refund or wallet credit will be issued/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Reason for cancellation'), 'Returned unused');
    await user.click(screen.getByLabelText('I confirm cancellation without a refund.'));
    await user.click(screen.getByRole('button', { name: 'Save cancellation' }));
    await user.click(await screen.findByRole('button', { name: 'Retry saved request' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toEqual(requests[0]);
    await screen.findByText('Credit records saved.');
    expect(readPendingCredit('agent-credit:42:5:1')).toBeNull();
  });

  it('restores a pending operation on remount without creating a new key', async () => {
    const command = {
      kind: 'repay',
      payload: {
        request_key: crypto.randomUUID(),
        batch_id: 7,
        amount: 4000,
        external_reference: 'BANK-1',
        method: 'bank_transfer',
        received_on: '2026-09-15',
      },
    };
    sessionStorage.setItem('agent-credit:42:5:1', JSON.stringify(command));
    let received: unknown;
    server.use(
      http.post(`${API}/tenant/agents/1/credit-repay/`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(batch);
      }),
    );
    renderPage(<AgentCreditPanel agent={agent} />, { role: 'owner' });
    await userEvent.click(await screen.findByRole('button', { name: 'Retry saved request' }));
    await waitFor(() => expect(received).toEqual(command.payload));
  });

  it('sends credit settings with the previous settings and no editable balance', async () => {
    let received: unknown;
    server.use(
      http.patch(`${API}/tenant/agents/1/credit/`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(account);
      }),
    );
    const user = userEvent.setup();
    renderPage(<AgentCreditPanel agent={agent} />, { role: 'owner' });
    const input = await screen.findByLabelText('Credit limit (naira)');
    await user.clear(input);
    await user.type(input, '2500');
    await user.type(screen.getByLabelText('Note'), 'Approved credit');
    await user.click(screen.getByRole('button', { name: 'Save credit settings' }));
    await waitFor(() =>
      expect(received).toMatchObject({
        credit_limit: 250000,
        expected: account,
        note: 'Approved credit',
      }),
    );
    expect(received).not.toHaveProperty('current_balance');
  });
});
