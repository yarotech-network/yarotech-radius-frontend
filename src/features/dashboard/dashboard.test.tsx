import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, makeAssignment, makeUser, paginated } from '@/test/fixtures';
import { derivePrincipal } from '@/services/auth/principal';
import { renderPage } from '@/test/renderPage';
import type { DashboardStats, LiveUsersResponse } from '@/types/api';
import DashboardPage from './pages/DashboardPage';
import SessionsPage from '@/features/sessions/pages/SessionsPage';

const stats: DashboardStats = {
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

describe('DashboardPage', () => {
  it('uses the full session count without treating one page of counters as network totals', async () => {
    server.use(
      http.get(`${API}/dashboard/stats/`, () => HttpResponse.json(stats)),
      http.get(`${API}/dashboard/live-users/`, () =>
        HttpResponse.json({ ...live([session(1, 'latest-client')]), count: 55, total_pages: 55 }),
      ),
    );
    renderPage(<DashboardPage />, { role: 'owner' });
    expect(await screen.findByText('latest-client')).toBeInTheDocument();
    expect(screen.getByText('Online now').parentElement?.parentElement).toHaveTextContent('55');
    expect(
      screen.getByText(
        'Cumulative data for this session only. These values are not current bandwidth rates.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Routers online')).not.toBeInTheDocument();
  });

  it('keeps the online count and storefront available when business figures fail', async () => {
    server.use(
      http.get(`${API}/dashboard/stats/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
      http.get(`${API}/dashboard/live-users/`, () => HttpResponse.json(live([session(1, 'a')]))),
    );
    renderPage(<DashboardPage />, { role: 'owner' });
    expect(await screen.findByText('Dashboard could not be loaded')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Online now').parentElement?.parentElement).toHaveTextContent('1'),
    );
    expect(screen.getByRole('link', { name: 'Manage storefront' })).toHaveAttribute(
      'href',
      '/storefront',
    );
  });

  it('distinguishes an unavailable session count from zero and offers its own retry', async () => {
    server.use(
      http.get(`${API}/dashboard/stats/`, () => HttpResponse.json(stats)),
      http.get(`${API}/dashboard/live-users/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    renderPage(<DashboardPage />, { role: 'manager' });
    expect(await screen.findByText('Live sessions could not be refreshed')).toBeInTheDocument();
    expect(screen.getByText('Online now').parentElement?.parentElement).toHaveTextContent('—');
    expect(screen.getByText('₦12,500.00')).toBeInTheDocument();
    server.use(http.get(`${API}/dashboard/live-users/`, () => HttpResponse.json(live([]))));
    await userEvent.click(screen.getByRole('button', { name: 'Retry live sessions' }));
    await waitFor(() =>
      expect(screen.queryByText('Live sessions could not be refreshed')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Online now').parentElement?.parentElement).toHaveTextContent('0');
  });

  it('does not request or refresh live sessions without permission', async () => {
    let liveCalls = 0;
    let statsCalls = 0;
    server.use(
      http.get(`${API}/dashboard/stats/`, () => {
        statsCalls++;
        return HttpResponse.json(stats);
      }),
      http.get(`${API}/dashboard/live-users/`, () => {
        liveCalls++;
        return HttpResponse.json(live([]));
      }),
    );
    renderPage(<DashboardPage />, {
      principal: derivePrincipal(
        makeUser('platform_staff'),
        [makeAssignment(5, ['payments.view'])],
        5,
      ),
    });
    const refresh = await screen.findByRole('button', { name: 'Refresh overview' });
    expect(screen.getByText('No access')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage storefront' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Generate vouchers' })).not.toBeInTheDocument();
    await userEvent.click(refresh);
    await waitFor(() => expect(statsCalls).toBe(2));
    expect(liveCalls).toBe(0);
  });

  it('keeps last business figures visible with a warning after refresh fails', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/dashboard/stats/`, () =>
        ++calls === 1
          ? HttpResponse.json(stats)
          : HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
      http.get(`${API}/dashboard/live-users/`, () => HttpResponse.json(live([]))),
    );
    renderPage(<DashboardPage />, { role: 'manager' });
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh overview' }));
    expect(await screen.findByText('Business figures could not be refreshed')).toBeInTheDocument();
    expect(screen.getByText('₦12,500.00')).toBeInTheDocument();
  });

  it('shows the stat cards, the recovery alert for managers and the live count', async () => {
    server.use(
      http.get(`${API}/dashboard/stats/`, () => HttpResponse.json(stats)),
      http.get(`${API}/dashboard/live-users/`, () => HttpResponse.json(live([session(1, 'a')]))),
    );
    renderPage(<DashboardPage />, { role: 'manager', path: '/' });
    expect(await screen.findByText('₦12,500.00')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('of 41 issued')).toBeInTheDocument();
    expect(await screen.findByText('1 paid order has no voucher yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/payments/recovery',
    );
    await waitFor(() =>
      expect(screen.getByText('Online now').parentElement?.parentElement).toHaveTextContent('1'),
    );
  });

  it('staff do not see the recovery alert and the error state offers a retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/dashboard/stats/`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { problem: { code: 'http_500', message: 'Server error' } },
              { status: 500 },
            )
          : HttpResponse.json(stats);
      }),
      http.get(`${API}/dashboard/live-users/`, () => HttpResponse.json(live([]))),
    );
    renderPage(<DashboardPage />, { role: 'staff', path: '/' });
    expect(await screen.findByText('Dashboard could not be loaded')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('₦12,500.00')).toBeInTheDocument();
    expect(screen.queryByText(/paid order/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage storefront' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Generate vouchers' })).not.toBeInTheDocument();
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
