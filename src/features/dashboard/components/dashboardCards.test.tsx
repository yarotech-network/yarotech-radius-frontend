import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API, makeAssignment, makeUser } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { derivePrincipal } from '@/services/auth/principal';
import type { DashboardStats, NetworkSummary } from '@/types/api';
import { BusinessCards } from './BusinessCards';
import { NetworkCards } from './NetworkCards';
import { SubscriptionSummary } from './SubscriptionSummary';

const summary: NetworkSummary = {
  rate_sampled_sessions: 50,
  online_users: 52,
  online_vouchers: 40,
  stale_sessions: 3,
  sessions_today: 70,
  live_upload_bytes: 1000,
  live_download_bytes: 2000,
  live_traffic_bytes: 3000,
  today_upload_bytes: 4000,
  today_download_bytes: 5000,
  today_traffic_bytes: 9000,
  all_time_upload_bytes: 10000,
  all_time_download_bytes: 20000,
  all_time_traffic_bytes: 30000,
  upload_bytes_per_second: null,
  download_bytes_per_second: 1024,
  latest_accounting_at: new Date().toISOString(),
  router_counts: { online: 1, offline: 0, unknown: 1, awaiting_import: 1, inactive: 0 },
  routers: [
    { id: 'router-1', name: 'Main router', status: 'online', online_users: 52, last_seen_at: null },
  ],
  routers_total: 3,
  observed_at: new Date().toISOString(),
  freshness_seconds: 300,
  traffic_basis: 'cumulative_counters_for_sessions_active_today',
  source: 'radius_accounting',
};

describe('Legacy dashboard cards', () => {
  it('groups revenue, payment outcomes and voucher usage with appropriate destinations', () => {
    const stats: DashboardStats = {
      total_vouchers: 30,
      active_vouchers: 5,
      total_revenue: 80000,
      total_agents: 1,
      total_routers: 3,
      active_routers: 1,
      currency: 'NGN',
      amount_unit: 'kobo',
      observed_at: new Date().toISOString(),
      paid_unfulfilled_payments: 0,
      collected_revenue: { today: 10000, month: 50000, total: 100000 },
      revenue_sources: { online: 80000, agent_wallet: 15000, agent_credit_repayments: 5000 },
      successful_payments: 10,
      failed_payments: 4,
      pending_payments: 2,
      voucher_usage: { available: 7, sold: 4, used: 3, expired: 1, not_started: 8, disabled: 0 },
      vouchers_issued_today: 6,
      active_plans: 5,
      total_plans: 9,
    };
    renderPage(<BusinessCards stats={stats} loading={false} />, { role: 'owner' });
    expect(screen.getByText('₦100.00')).toBeInTheDocument();
    expect(screen.getByText('₦1,000.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View failed payments' })).toHaveAttribute(
      'href',
      '/payments?status=failed',
    );
    expect(screen.getByRole('link', { name: 'View voucher activity' })).toHaveAttribute(
      'href',
      '/vouchers',
    );
    expect(screen.getByText('Vouchers issued today')).toBeInTheDocument();
  });

  it('uses aggregate network values, links routers and distinguishes unmeasured speeds', async () => {
    server.use(http.get(`${API}/dashboard/network/`, () => HttpResponse.json(summary)));
    renderPage(<NetworkCards />, { role: 'owner' });
    expect(await screen.findByText('52')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB/s')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Main router' })).toHaveAttribute(
      'href',
      '/routers/router-1',
    );
    expect(screen.getByText(/including data from before midnight/)).toBeInTheDocument();
  });

  it('retains the last figures with a warning when refresh fails', async () => {
    let count = 0;
    server.use(
      http.get(`${API}/dashboard/network/`, () =>
        ++count === 1
          ? HttpResponse.json(summary)
          : HttpResponse.json({ detail: 'Down' }, { status: 503 }),
      ),
    );
    renderPage(<NetworkCards live={false} />, { role: 'manager' });
    await screen.findByText('52');
    await userEvent.click(screen.getByRole('button', { name: 'Refresh network figures' }));
    expect(await screen.findByText('Network figures unavailable')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
    expect(screen.getByText('Showing the last successful observation.')).toBeInTheDocument();
  });

  it('does not fetch network details for staff without that service grant', () => {
    renderPage(<NetworkCards />, {
      principal: derivePrincipal(
        makeUser('platform_staff'),
        [makeAssignment(5, ['payments.view'])],
        5,
      ),
    });
    expect(screen.queryByText('Live HotSpot users')).not.toBeInTheDocument();
  });

  it('shows subscription expiry and actual router allowance', async () => {
    server.use(
      http.get(`${API}/subscriptions/`, () =>
        HttpResponse.json({
          id: 1,
          plan: 1,
          plan_name: 'Starter',
          status: 'trial',
          is_trial: true,
          is_expired: false,
          expires_at: new Date(Date.now() + 2 * 86400000).toISOString(),
          entitlements: { routers_used: 2, terms: { name: 'Starter', max_routers: 3 } },
        }),
      ),
    );
    renderPage(<SubscriptionSummary />, { role: 'owner' });
    expect(await screen.findByText('Routers 2 / 3')).toBeInTheDocument();
    expect(screen.getByText('Your subscription expires soon.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('link', { name: 'Renew / upgrade' })).getByText('Renew / upgrade'),
    ).toBeInTheDocument();
  });
});
