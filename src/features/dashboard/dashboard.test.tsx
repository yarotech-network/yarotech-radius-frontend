import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, makeAssignment, makeUser, paginated } from '@/test/fixtures';
import { derivePrincipal } from '@/services/auth/principal';
import { renderPage } from '@/test/renderPage';
import type { DashboardStats, LiveUsersResponse } from '@/types/api';
import { networkSummary } from '@/test/dashboardFixtures';
import { formatDateTime } from '@/lib/formatting/dates';
import DashboardPage from './pages/DashboardPage';
import SessionsPage from '@/features/sessions/pages/SessionsPage';

beforeEach(() => {
  server.use(
    http.get(`${API}/dashboard/network/`, () =>
      HttpResponse.json({ detail: 'No accounting' }, { status: 503 }),
    ),
    http.get(`${API}/subscriptions/`, () =>
      HttpResponse.json({ detail: 'No subscription' }, { status: 404 }),
    ),
  );
});

const revenuePeriods = (amount: number) => ({
  total: { amount, vouchers: 1 },
  today: { amount, vouchers: 1 },
  month: { amount, vouchers: 1 },
});
const stats: DashboardStats = {
  activated_voucher_revenue: {
    basis: 'first_activation',
    totals: revenuePeriods(60000),
    channels: {
      storefront: revenuePeriods(10000),
      whatsapp: revenuePeriods(20000),
      generated: revenuePeriods(30000),
    },
    incomplete_vouchers: 0,
  },
  collected_revenue: { today: 12300, month: 40000, total: 50000 },
  total_vouchers: 41,
  active_vouchers: 9,
  total_revenue: 1250000,
  total_agents: 2,
  total_routers: 2,
  active_routers: 1,
  currency: 'NGN',
  amount_unit: 'kobo',
  observed_at: new Date().toISOString(),
  pending_payments: 3,
  paid_unfulfilled_payments: 1,
};
const live = (users: LiveUsersResponse['users']): LiveUsersResponse => ({
  users,
  count: users.length,
  current_page: 1,
  total_pages: 1,
  observed_at: new Date().toISOString(),
  source: 'radius_accounting',
});
const session = (id: number, username: string) => ({
  session_id: id,
  username,
  ip_address: '10.100.100.12',
  client_ip: null,
  session_time: 420,
  bytes_in: 2_000_000,
  bytes_out: 48_000_000,
  connected_at: new Date(Date.now() - 7 * 60_000).toISOString(),
  router_id: 'r1',
  router_name: 'mikrotik-wuse-01',
});

const payments = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  customer_email: `buyer${index}@example.com`,
  reference: `REF-${index}`,
  amount: 10000,
  status: index === 0 ? 'success' : 'pending',
  created_at: `2026-09-29T10:0${5 - index}:00Z`,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API}/dashboard/stats/`, () => HttpResponse.json(stats)),
      http.get(`${API}/dashboard/network/`, () => HttpResponse.json(networkSummary)),
      http.get(`${API}/payments/transactions/`, () => HttpResponse.json(paginated(payments))),
    );
  });

  it('keeps four summary cards with destinations and no detailed reports or session table', async () => {
    renderPage(<DashboardPage />, { role: 'owner' });
    const cards = screen.getByRole('region', { name: 'Dashboard summaries' });
    await within(cards).findByText('52');
    expect(cards.children).toHaveLength(4);
    for (const [name, href] of [
      ['View voucher revenue', '/vouchers#voucher-revenue'],
      ['View payments', '/payments'],
      ['View live sessions', '/sessions'],
      ['View routers', '/routers'],
    ] as const)
      expect(within(cards).getByRole('link', { name })).toHaveAttribute('href', href);
    expect(within(cards).getByText('0 confirmed offline / 1 unknown')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review payments' })).toHaveAttribute(
      'href',
      '/payments/recovery',
    );
    for (const name of [
      'Voucher usage',
      'Activated voucher revenue',
      'Recorded collections and payments',
    ]) {
      expect(screen.queryByRole('heading', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('table', { name: 'Live sessions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Generate vouchers' })).not.toBeInTheDocument();
  });

  it('requests exactly five newest payments and displays exact creation dates', async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${API}/payments/transactions/`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({ ...paginated(payments), count: 300 });
      }),
    );
    renderPage(<DashboardPage />);
    const table = await screen.findByRole('table', { name: 'Five most recent customer payments' });
    expect(requested?.searchParams.get('page_size')).toBe('5');
    expect(requested?.searchParams.get('ordering')).toBe('-created_at');
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(
      within(table)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(payments.map((p) => p.customer_email));
    expect(within(table).getByText(formatDateTime(payments[0]!.created_at))).toBeInTheDocument();
    expect(table.querySelector('time')).toHaveAttribute('dateTime', payments[0]!.created_at);
  });

  it('distinguishes unavailable data, zero users and unknown routers', async () => {
    server.use(http.get(`${API}/dashboard/network/`, () => HttpResponse.json({}, { status: 503 })));
    renderPage(<DashboardPage />);
    await screen.findByText('Network figures unavailable');
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    server.use(
      http.get(`${API}/dashboard/network/`, () =>
        HttpResponse.json({ ...networkSummary, online_users: 0 }),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    await screen.findByText('0');
    expect(screen.getByText('0 confirmed offline / 1 unknown')).toBeInTheDocument();
  });

  it('retains cached figures with a warning after a failed refresh', async () => {
    renderPage(<DashboardPage />);
    await screen.findByText('52');
    await screen.findByText('buyer0@example.com');
    server.use(http.get(`${API}/dashboard/stats/`, () => HttpResponse.json({}, { status: 503 })));
    await userEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    await screen.findByText('Business figures unavailable');
    expect(screen.getByText(/Showing the last successful figures/)).toBeInTheDocument();
    expect(screen.getByText(/600.00/)).toBeInTheDocument();
  });

  it('never fetches unauthorized aggregates for payment-only delegated staff', async () => {
    let forbiddenCalls = 0;
    server.use(
      http.get(`${API}/dashboard/:kind/`, () => {
        forbiddenCalls++;
        return HttpResponse.json({});
      }),
    );
    renderPage(<DashboardPage />, {
      principal: derivePrincipal(
        makeUser('platform_staff'),
        [makeAssignment(5, ['payments.view'])],
        5,
      ),
    });
    await screen.findByText('buyer0@example.com');
    expect(screen.getByRole('region', { name: 'Dashboard summaries' }).children).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    expect(forbiddenCalls).toBe(0);
  });

  it('renders empty and failed payment history separately', async () => {
    server.use(http.get(`${API}/payments/transactions/`, () => HttpResponse.json(paginated([]))));
    renderPage(<DashboardPage />);
    await screen.findByText('No customer payments yet.');
    server.use(
      http.get(`${API}/payments/transactions/`, () => HttpResponse.json({}, { status: 503 })),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    await screen.findByText('Recent payments unavailable');
    expect(screen.getByText('Showing the last successful results.')).toBeInTheDocument();
  });
});

describe('SessionsPage', () => {
  it('allows manual refresh while paused and retains the last observation on failure', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get(`${API}/dashboard/live-users/`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(live([session(1, 'WH10002')]))
          : HttpResponse.json({ detail: 'Unavailable' }, { status: 503 });
      }),
      http.get(`${API}/routers/`, () => HttpResponse.json(paginated([]))),
    );
    renderPage(<SessionsPage />, { role: 'manager', path: '/sessions' });
    const table = await screen.findByRole('table', { name: 'Live sessions' });
    await within(table).findByText('WH10002');
    await user.click(screen.getByRole('button', { name: 'Pause updates' }));
    expect(screen.getByRole('button', { name: 'Resume updates' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Refresh sessions' }));
    expect(await screen.findByText('Sessions could not be refreshed')).toBeInTheDocument();
    expect(within(table).getByText('WH10002')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('lists live sessions, filters by router and disconnects with confirmation', async () => {
    const seen: URL[] = [];
    let disconnected: string | null = null;
    server.use(
      http.get(`${API}/dashboard/live-users/`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json(live([session(1, 'WH10002'), session(2, 'WH10001')]));
      }),
      http.get(`${API}/routers/`, () =>
        HttpResponse.json(paginated([{ id: 'r1', name: 'mikrotik-wuse-01' }])),
      ),
      http.post(`${API}/dashboard/live-users/:id/disconnect/`, ({ params, request }) => {
        disconnected = `${params.id}:${request.headers.get('Idempotency-Key') ? 'idem' : 'no-key'}`;
        return HttpResponse.json({ acknowledged: true });
      }),
    );
    renderPage(<SessionsPage />, { role: 'manager', path: '/sessions' });
    const table = await screen.findByRole('table', { name: 'Live sessions' });
    expect(await within(table).findByText('WH10002')).toBeInTheDocument();
    expect(within(table).getAllByText('45.8 MB')).toHaveLength(2);

    await userEvent.selectOptions(await screen.findByLabelText('Router'), 'r1');
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('router')).toBe('r1'));

    await userEvent.click(within(table).getByRole('button', { name: 'Disconnect WH10002' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(disconnected).toBe('1:idem'));
    expect(await screen.findByText('Disconnect sent')).toBeInTheDocument();
  });

  it('staff get no disconnect control and see the empty state', async () => {
    server.use(
      http.get(`${API}/dashboard/live-users/`, () => HttpResponse.json(live([]))),
      http.get(`${API}/routers/`, () => HttpResponse.json(paginated([]))),
    );
    renderPage(<SessionsPage />, { role: 'staff', path: '/sessions' });
    expect(await screen.findByText('Nobody is online right now')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disconnect/ })).not.toBeInTheDocument();
  });
});
