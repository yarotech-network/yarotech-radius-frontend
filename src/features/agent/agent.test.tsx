import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type {
  AgentFundingPayment,
  AgentProfile,
  AgentVoucherAllocation,
  AgentPlan,
} from '@/types/api';
import AgentHomePage from './pages/AgentHomePage';
import AgentSellPage from './pages/AgentSellPage';
import AgentWalletPage from './pages/AgentWalletPage';
import AgentVouchersPage from './pages/AgentVouchersPage';
import AgentProfilePage from './pages/AgentProfilePage';
import { storeSlugStore, normaliseStoreSlug } from './storeSlug';
import { sellCost, sellSchema } from './sellSchema';
import { fundSchema } from './fundSchema';
import { pendingCheckout } from '@/features/storefront/pendingCheckout';

const profile: AgentProfile = {
  id: 1,
  user: 42,
  username: 'ada',
  tenant: 5,
  phone: '+2348040000001',
  shop_name: 'Chidi Phones',
  status: 'active',
  commission_rate: '10.00',
  wallet_balance: 250000,
  created_at: '2026-09-01T07:27:11Z',
};
const plans: AgentPlan[] = [
  {
    id: 1,
    name: 'Daily 1GB',
    price: 50000,
    agent_cost: 45000, commission_amount: 5000, commission_rate: "10.00",
    duration_hours: 24,
    rate_limit: '5M/10M',
    data_limit: 1024,
  },
  {
    id: 3,
    name: 'Monthly 20GB',
    price: 800000,
    agent_cost: 720000, commission_amount: 80000, commission_rate: "10.00",
    duration_hours: 720,
    rate_limit: '20M/50M',
    data_limit: 20480,
  },
];
const allocation = (extra: Partial<AgentVoucherAllocation> = {}): AgentVoucherAllocation => ({
  id: 1,
  agent: 1,
  voucher: 82,
  voucher_username: 'WH84OQ0oKp',
  allocation_type: 'wallet',
  amount_charged: 50000,
  commission_earned: 0,
  created_at: '2026-09-06T10:08:59Z',
  ...extra,
});

function mockAgent(balance = 250000) {
  server.use(
    http.get(`${API}/agent/wallet/policy/`, () => HttpResponse.json({ minimum: 50000, maximum: 1000000, fee_percent: '0.00', flat_fee: 0, currency: 'NGN' })),
    http.get(`${API}/agents/me/`, () => HttpResponse.json({ ...profile, wallet_balance: balance })),
    http.get(`${API}/agent/dashboard/`, () =>
      HttpResponse.json({
        wallet_balance: balance,
        vouchers_today: 3,
        commission_this_month: 0,
        total_vouchers: 12,
      }),
    ),
    http.get(`${API}/agent/wallet/balance/`, () =>
      HttpResponse.json({ id: 1, agent: 1, balance, updated_at: '2026-09-06T10:00:00Z' }),
    ),
    http.get(`${API}/agent/wallet/transactions/`, () => HttpResponse.json(paginated([]))),
    http.get(`${API}/agent/wallet/payments/`, () => HttpResponse.json(paginated([]))),
    http.get(`${API}/agent/vouchers/history/`, () =>
      HttpResponse.json(
        paginated([allocation(), allocation({ id: 2, voucher_username: 'WHq2PYQtDW' })]),
      ),
    ),
    http.get(`${API}/public/tenants/wuse-hotspot/`, () =>
      HttpResponse.json({ id: 5, slug: 'wuse-hotspot', name: 'Wuse Hotspot' }),
    ),
    http.get(`${API}/agent/plans/`, () =>
      HttpResponse.json(paginated(plans)),
    ),
    http.get(`${API}/public/tenants/:slug/`, () =>
      HttpResponse.json({ detail: 'No Tenant matches the given query.' }, { status: 404 }),
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('store slug helpers', () => {
  it('normalises links, bare slugs and rejects junk', () => {
    expect(normaliseStoreSlug('https://app.example.com/s/wuse-hotspot')).toBe('wuse-hotspot');
    expect(normaliseStoreSlug('  Wuse-Hotspot ')).toBe('wuse-hotspot');
    expect(normaliseStoreSlug('/s/garki-wifi/checkout/2')).toBe('garki-wifi');
    expect(normaliseStoreSlug('not a slug!')).toBeNull();
    expect(normaliseStoreSlug('')).toBeNull();
  });
  it('sell schema + cost mirror the backend limits (1–100, price × quantity)', () => {
    expect(sellSchema.safeParse({ plan_id: 1, quantity: '3' }).success).toBe(true);
    expect(sellSchema.safeParse({ plan_id: 0, quantity: 1 }).success).toBe(false);
    expect(sellSchema.safeParse({ plan_id: 1, quantity: 101 }).success).toBe(false);
    expect(sellCost(50000, 3)).toBe(150000);
    expect(sellCost(50000, 0)).toBe(0);
  });
  it('fund schema enforces the ₦500 floor in naira input', () => {
    expect(fundSchema.safeParse({ amount: '499' }).success).toBe(false);
    expect(fundSchema.safeParse({ amount: '500' })).toMatchObject({
      success: true,
      data: { amount: 50000 },
    });
    expect(fundSchema.safeParse({ amount: '2,000' })).toMatchObject({
      success: true,
      data: { amount: 200000 },
    });
  });
});

describe('agent home', () => {
  it('shows balance, sales counters, recent sales and the retained margin', async () => {
    mockAgent();
    storeSlugStore.write('wuse-hotspot');
    renderPage(<AgentHomePage />, { role: 'agent', path: '/agent' });
    expect(await screen.findByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(await screen.findByText('₦2,500.00')).toBeInTheDocument();
    expect(screen.getByText('Sold today')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Retail margin this month')).toBeInTheDocument();
    expect(await screen.findByText('WH84OQ0oKp')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Connect storefront' })).not.toBeInTheDocument();
  });

  it('asks to connect a storefront when none is remembered and verifies the slug', async () => {
    mockAgent();
    const user = userEvent.setup();
    renderPage(<AgentHomePage />, { role: 'agent', path: '/agent' });
    const form = await screen.findByRole('form', { name: 'Connect storefront' });
    await user.type(
      within(form).getByLabelText(/storefront link or name/i),
      'https://x.test/s/nope',
    );
    await user.click(within(form).getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText(/No storefront found at that address/)).toBeInTheDocument();
    await user.clear(within(form).getByLabelText(/storefront link or name/i));
    await user.type(within(form).getByLabelText(/storefront link or name/i), 'wuse-hotspot');
    await user.click(within(form).getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(storeSlugStore.read()).toBe('wuse-hotspot'));
    expect(screen.queryByRole('form', { name: 'Connect storefront' })).not.toBeInTheDocument();
  });
});

describe('agent sell', () => {
  it('retains the original sale key across an uncertain response and a page remount', async () => {
    mockAgent();
    const keys: (string | null)[] = [];
    server.use(http.post(`${API}/agent/vouchers/generate/`, ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key'));
      return keys.length === 1
        ? HttpResponse.json({ error: 'Sale result unavailable' }, { status: 503 })
        : HttpResponse.json({ vouchers: [allocation({ amount_charged: 45000, commission_earned: 5000 })] }, { status: 201 });
    }));
    const user = userEvent.setup();
    const first = renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    await user.click(await screen.findByRole('radio', { name: 'Daily 1GB' }));
    await user.click(screen.getByRole('button', { name: 'Sell voucher' }));
    expect(await screen.findByText('Sale result unavailable')).toBeInTheDocument();
    first.unmount();
    mockAgent(0);
    renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    expect(await screen.findByText(/This sale has not been confirmed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sell voucher' }));
    expect(await screen.findByRole('heading', { name: '1 voucher sold' })).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(screen.getByText('Retail margin retained: ₦50.00.')).toBeInTheDocument();
  });

  it('blocks changed quantities while an earlier sale is unresolved', async () => {
    mockAgent();
    let calls = 0;
    server.use(http.post(`${API}/agent/vouchers/generate/`, () => {
      calls++;
      return HttpResponse.json({ error: 'Awaiting confirmation' }, { status: 503 });
    }));
    const user = userEvent.setup();
    renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    await user.click(await screen.findByRole('radio', { name: 'Daily 1GB' }));
    await user.click(screen.getByRole('button', { name: 'Sell voucher' }));
    expect(await screen.findByText('Awaiting confirmation')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/how many/i));
    await user.type(screen.getByLabelText(/how many/i), '2');
    await user.click(screen.getByRole('button', { name: 'Sell 2 vouchers' }));
    expect(await screen.findByText(/Retry the original sale before changing/)).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('permits a sale when the balance covers discounted cost but not retail', async () => {
    mockAgent(45000);
    const user = userEvent.setup();
    renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    await user.click(await screen.findByRole('radio', { name: 'Daily 1GB' }));
    expect(screen.getByRole('button', { name: 'Sell voucher' })).toBeEnabled();
    expect(screen.getByText(/Your margin: ₦50.00/)).toBeInTheDocument();
  });

  it('sells from the agent catalogue without a storefront link, previews the wallet charge and shows the access codes', async () => {
    mockAgent();
    storeSlugStore.write('wuse-hotspot');
    let received: { body: unknown; key: string | null } | null = null;
    server.use(
      http.post(`${API}/agent/vouchers/generate/`, async ({ request }) => {
        received = { body: await request.json(), key: request.headers.get('Idempotency-Key') };
        return HttpResponse.json(
          {
            vouchers: [
              allocation({ voucher_username: 'WH84QRKP', access_code: 'WH84QRKP' }),
              allocation({ id: 2, voucher_username: 'WHQ2PYQT', access_code: 'WHQ2PYQT' }),
            ],
          },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    expect(await screen.findByText("Your operator's enabled plans")).toBeInTheDocument();
    const sell = screen.getByRole('button', { name: 'Sell voucher' });
    expect(sell).toBeDisabled();
    await user.click(await screen.findByRole('radio', { name: 'Daily 1GB' }));
    await user.clear(screen.getByLabelText(/how many/i));
    await user.type(screen.getByLabelText(/how many/i), '2');
    expect(screen.getByText('₦900.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sell 2 vouchers' }));
    expect(await screen.findByRole('heading', { name: '2 vouchers sold' })).toBeInTheDocument();
    expect(received!.body).toEqual({ plan_id: 1, quantity: 2 });
    expect(received!.key).toMatch(/^agent-gen-/);
    expect(screen.getByRole('list', { name: 'Access codes' })).toHaveTextContent('WH84QRKP');
    expect(screen.getByText(/enter it as both username and password/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy all codes' })).toBeInTheDocument();
  });

  it('stays honest about legacy vouchers whose password is not returned', async () => {
    mockAgent();
    storeSlugStore.write('wuse-hotspot');
    server.use(
      http.post(`${API}/agent/vouchers/generate/`, () =>
        HttpResponse.json({ vouchers: [allocation({ access_code: null })] }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    await user.click(await screen.findByRole('radio', { name: 'Daily 1GB' }));
    await user.click(screen.getByRole('button', { name: 'Sell voucher' }));
    expect(await screen.findByRole('heading', { name: '1 voucher sold' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Voucher usernames' })).toHaveTextContent('WH84OQ0oKp');
    expect(screen.getByText(/separate password issued by the operator/)).toBeInTheDocument();
  });

  it('blocks a sale that exceeds the balance and points to funding', async () => {
    mockAgent(60000);
    storeSlugStore.write('wuse-hotspot');
    const user = userEvent.setup();
    renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    await user.click(await screen.findByRole('radio', { name: 'Monthly 20GB' }));
    expect(await screen.findByText(/Exceeds your balance by ₦6,600.00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sell voucher' })).toBeDisabled();
  });

  it('surfaces the backend insufficient-balance error even when the local preview allowed it', async () => {
    mockAgent();
    storeSlugStore.write('wuse-hotspot');
    server.use(
      http.post(`${API}/agent/vouchers/generate/`, () =>
        HttpResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    await user.click(await screen.findByRole('radio', { name: 'Daily 1GB' }));
    await user.click(screen.getByRole('button', { name: 'Sell voucher' }));
    expect(await screen.findByText('Not enough in your wallet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fund wallet' })).toHaveAttribute(
      'href',
      '/agent/wallet?fund=1',
    );
  });

  it('maps a plan rejection onto the plan field', async () => {
    mockAgent();
    storeSlugStore.write('wuse-hotspot');
    server.use(
      http.post(`${API}/agent/vouchers/generate/`, () =>
        HttpResponse.json({ plan_id: ['Plan not found or inactive.'] }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    await user.click(await screen.findByRole('radio', { name: 'Daily 1GB' }));
    await user.click(screen.getByRole('button', { name: 'Sell voucher' }));
    expect(await screen.findByText(/Plan not found or inactive/)).toBeInTheDocument();
  });

  it('loads enabled agent plans without a connected storefront', async () => {
    mockAgent();
    renderPage(<AgentSellPage />, { role: 'agent', path: '/agent/sell' });
    expect(await screen.findByRole('radio', { name: 'Daily 1GB' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Connect storefront' })).not.toBeInTheDocument();
  });
});

describe('wallet movements', () => {
  it('shows configured funding fees separately and submits the displayed total', async () => {
    mockAgent();
    let payload: unknown;
    server.use(
      http.get(`${API}/agent/wallet/policy/`, () => HttpResponse.json({ minimum: 50000, maximum: 1000000, fee_percent: '1.50', flat_fee: 1000, currency: 'NGN' })),
      http.post(`${API}/agent/wallet/fund/`, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json({ error: 'Quote requires refresh' }, { status: 400 });
      }),
    );
    const user = userEvent.setup();
    renderPage(<AgentWalletPage />, { role: 'agent', path: '/agent/wallet/*', route: '/agent/wallet?fund=1' });
    const dialog = await screen.findByRole('dialog', { name: 'Fund wallet' });
    await user.type(within(dialog).getByLabelText(/^Amount/), '500');
    expect(await within(dialog).findByText(/Wallet credit: ₦500.00. Funding fee: ₦17.50. Total: ₦517.50/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Pay ₦517.50' }));
    expect(await screen.findByText('Quote requires refresh')).toBeInTheDocument();
    expect(payload).toEqual({ amount: 50000, expected_total: 51750 });
  });

  it('keeps the known funding reference when provider verification is unavailable', async () => {
    mockAgent();
    server.use(
      http.get(`${API}/agent/wallet/payments/`, () => HttpResponse.json(paginated([{
        id: 99, reference: 'keep-reference', amount: 50000, status: 'pending',
        created_at: '2026-09-15T10:00:00Z', completed_at: null,
      }]))),
      http.post(`${API}/agent/wallet/verify/`, () => HttpResponse.json({ detail: 'Verification unavailable; retry this reference.' }, { status: 503 })),
    );
    const user = userEvent.setup();
    renderPage(<AgentWalletPage />, { role: 'agent', path: '/agent/wallet/*', route: '/agent/wallet?reference=keep-reference' });
    await user.click(await screen.findByRole('button', { name: 'Check now' }));
    expect(await screen.findByText('Verification unavailable; retry this reference.')).toBeInTheDocument();
    expect(screen.getByText('Waiting for Paystack to confirm your top-up')).toBeInTheDocument();
  });

  it('displays debit history and loads the next page', async () => {
    mockAgent();
    server.use(http.get(`${API}/agent/wallet/transactions/`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page'));
      return HttpResponse.json({ ...paginated([{
        id: page, reference: `movement-${page}`, category: page === 1 ? 'voucher_sale' : 'funding',
        amount: 12300, previous_balance: 20000, new_balance: page === 1 ? 7700 : 32300,
        created_at: '2026-09-15T10:00:00Z',
      }]), count: 21, total_pages: 2, current_page: page });
    }));
    const user = userEvent.setup();
    renderPage(<AgentWalletPage />, { role: 'agent', path: '/agent/wallet' });
    expect((await screen.findAllByText('Voucher sale')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('-₦123.00').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect((await screen.findAllByText('Wallet funding')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('+₦123.00').length).toBeGreaterThan(0);
  });
});

describe('agent wallet', () => {
  const funding = (extra: Partial<AgentFundingPayment> = {}): AgentFundingPayment => ({
    id: 1,
    reference: 'agent-fund-abc',
    amount: 100000,
    status: 'pending',
    created_at: '2026-09-06T10:08:59Z',
    completed_at: null,
    ...extra,
  });

  it('lists top-ups, opens the fund dialog from ?fund=1 and starts a Paystack payment', async () => {
    mockAgent();
    server.use(
      http.get(`${API}/agent/wallet/payments/`, ({ request }) => {
        const ref = new URL(request.url).searchParams.get('reference');
        if (ref)
          return HttpResponse.json(
            paginated([
              funding({ reference: ref, status: 'success', completed_at: '2026-09-06T10:10:00Z' }),
            ]),
          );
        return HttpResponse.json(paginated([funding({ status: 'failed' })]));
      }),
    );
    let received: { body: unknown; key: string | null } | null = null;
    server.use(
      http.post(`${API}/agent/wallet/fund/`, async ({ request }) => {
        received = { body: await request.json(), key: request.headers.get('Idempotency-Key') };
        return HttpResponse.json({
          authorization_url: 'https://checkout.paystack.com/fund',
          reference: 'agent-fund-new',
        });
      }),
    );
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign,
    } as unknown as Location);
    const user = userEvent.setup();
    renderPage(<AgentWalletPage />, {
      role: 'agent',
      path: '/agent/wallet/*',
      route: '/agent/wallet?fund=1',
    });
    expect(await screen.findByText('₦2,500.00')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Top-ups' });
    expect(await within(table).findByText('agent-fund-abc')).toBeInTheDocument();
    expect(within(table).getByText('Failed')).toBeInTheDocument();

    const dialog = await screen.findByRole('dialog', { name: 'Fund wallet' });
    await user.click(within(dialog).getByRole('button', { name: '₦2,000' }));
    expect(within(dialog).getByRole('button', { name: 'Pay ₦2,000.00' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Pay ₦2,000.00' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/fund'));
    expect(received!.body).toEqual({ amount: 200000, expected_total: 200000 });
    expect(received!.key).toMatch(/^fund-/);
    expect(pendingCheckout.load()).toMatchObject({ kind: 'wallet', reference: 'agent-fund-new' });
    // the tracker for the new reference appears and resolves via ?reference= lookup
    expect(await screen.findByText(/Top-up of ₦1,000.00 received/)).toBeInTheDocument();
  });

  it('rejects amounts under ₦500 locally and shows the tenant ceiling from the API', async () => {
    mockAgent();
    server.use(
      http.post(`${API}/agent/wallet/fund/`, () =>
        HttpResponse.json(
          { amount: ['Amount exceeds the tenant funding limit of 100000 kobo.'] },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage(<AgentWalletPage />, {
      role: 'agent',
      path: '/agent/wallet/*',
      route: '/agent/wallet?fund=1',
    });
    const dialog = await screen.findByRole('dialog', { name: 'Fund wallet' });
    const amount = within(dialog).getByLabelText(/^Amount \(₦\)/);
    await user.type(amount, '200');
    await user.click(within(dialog).getByRole('button', { name: /pay|continue/i }));
    expect(await screen.findByText('Minimum top-up is ₦500')).toBeInTheDocument();
    await user.clear(amount);
    await user.type(amount, '5000');
    await user.click(within(dialog).getByRole('button', { name: 'Pay ₦5,000.00' }));
    expect(await screen.findByText(/exceeds the tenant funding limit/)).toBeInTheDocument();
  });

  it('on return from Paystack polls the remembered reference until it settles', async () => {
    mockAgent();
    let calls = 0;
    server.use(
      http.post(`${API}/agent/wallet/verify/`, async ({ request }) => {
        const body = await request.json() as { reference: string };
        expect(body.reference).toBe('agent-fund-back');
        calls = 2;
        return HttpResponse.json(funding({ reference: body.reference, status: 'success', completed_at: '2026-09-06T10:10:00Z' }));
      }),
      http.get(`${API}/agent/wallet/payments/`, ({ request }) => {
        const ref = new URL(request.url).searchParams.get('reference');
        if (!ref) return HttpResponse.json(paginated([]));
        calls += 1;
        return HttpResponse.json(
          paginated([
            funding({
              reference: ref,
              status: calls < 2 ? 'pending' : 'success',
              completed_at: calls < 2 ? null : '2026-09-06T10:10:00Z',
            }),
          ]),
        );
      }),
    );
    pendingCheckout.save({ kind: 'wallet', reference: 'agent-fund-back', amount: 100000 });
    const user = userEvent.setup();
    renderPage(<AgentWalletPage />, {
      role: 'agent',
      path: '/agent/wallet/*',
      route: '/agent/wallet/return',
    });
    expect(
      await screen.findByText('Waiting for Paystack to confirm your top-up'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check now' }));
    expect(await screen.findByText(/Top-up of ₦1,000.00 received/)).toBeInTheDocument();
  });
});

describe('agent vouchers + profile', () => {
  it('lists sold vouchers with a status filter that maps to the API', async () => {
    mockAgent();
    let lastStatus: string | null = null;
    server.use(
      http.get(`${API}/agent/vouchers/history/`, ({ request }) => {
        lastStatus = new URL(request.url).searchParams.get('status');
        return HttpResponse.json(paginated(lastStatus === 'expired' ? [] : [allocation()]));
      }),
    );
    const user = userEvent.setup();
    renderPage(<AgentVouchersPage />, { role: 'agent', path: '/agent/vouchers' });
    const table = await screen.findByRole('table', { name: 'Vouchers sold' });
    expect(await within(table).findByText('WH84OQ0oKp')).toBeInTheDocument();
    expect(within(table).getByText('Paid from wallet')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Voucher status'), 'expired');
    expect(await screen.findByText('No vouchers with that status')).toBeInTheDocument();
    expect(lastStatus).toBe('expired');
  });

  it('edits shop details with a diff-only PATCH and shows the connected storefront', async () => {
    mockAgent();
    storeSlugStore.write('wuse-hotspot');
    let received: unknown = null;
    server.use(
      http.patch(`${API}/agents/1/`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ ...profile, shop_name: 'Chidi Phones & Data' });
      }),
    );
    const user = userEvent.setup();
    renderPage(<AgentProfilePage />, { role: 'agent', path: '/agent/profile' });
    const form = await screen.findByRole('form', { name: 'Shop details' });
    const shop = within(form).getByLabelText(/shop name/i);
    await waitFor(() => expect(shop).toHaveValue('Chidi Phones'));
    expect(within(form).getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.clear(shop);
    await user.type(shop, 'Chidi Phones & Data');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(received).toEqual({ shop_name: 'Chidi Phones & Data' }));
    expect(await screen.findByText('Shop details saved')).toBeInTheDocument();
    expect(screen.getByText('10.00%')).toBeInTheDocument();
    expect(screen.getByText('/s/wuse-hotspot')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Change password' })).toBeInTheDocument();
  });
});
