import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, makeUser } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { can, derivePrincipal } from '@/services/auth/principal';
import { visibleItems, WORKSPACE_NAV } from '@/app/navigation/navConfig';
import ReportsPage from './ReportsPage';

const report = {
  period: 'last_30_days',
  group_by: 'day',
  from_date: '2026-09-04',
  to_date: '2026-10-03',
  reporting_timezone: 'Africa/Lagos',
  observed_at: '2026-10-03T12:00:00Z',
  currency: 'NGN',
  amount_unit: 'kobo',
  activation_basis: 'first_activation',
  collections_basis: 'recorded',
  usage_basis: 'distinct_vouchers_with_radius_session_overlap',
  accounting_available: true,
  latest_accounting_at: '2026-10-03T11:55:00Z',
  completed_periods: 1,
  totals: {
    activated_value: 10000,
    collections: 6000,
    collections_by_channel: { online_payments: 4500, agent_wallet: 1500, credit_repayments: 0 },
  },
  averages: { activated_value: 10000, collections: 6000, active_vouchers: 2 },
  rows: [
    {
      start: '2026-10-02',
      end_exclusive: '2026-10-03',
      in_progress: false,
      complete: true,
      activated_value: 10000,
      collections: 6000,
      active_vouchers: 2,
      collections_by_channel: { online_payments: 4500, agent_wallet: 1500, credit_repayments: 0 },
    },
    {
      start: '2026-10-03',
      end_exclusive: '2026-10-04',
      in_progress: true,
      complete: false,
      activated_value: 0,
      collections: 0,
      active_vouchers: 0,
      collections_by_channel: { online_payments: 0, agent_wallet: 0, credit_repayments: 0 },
    },
  ],
};

describe('Tenant reports', () => {
  it('shows summaries, charts with a keyboard readout and figures on request', async () => {
    server.use(http.get(`${API}/reports/`, () => HttpResponse.json(report)));
    renderPage(<ReportsPage />, { role: 'owner', path: '/reports' });
    const summaries = await screen.findByRole('region', { name: 'Report summaries' });
    expect(within(summaries).getByText('Activated voucher value')).toBeInTheDocument();
    expect(within(summaries).getByText('Recorded collections')).toBeInTheDocument();
    expect(within(summaries).getByText('Average active vouchers')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Revenue over time' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Share of collections by channel' }),
    ).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    const user = userEvent.setup();
    const trend = screen.getByRole('group', { name: /Activated value and collections by period/ });
    act(() => trend.focus());
    expect(await within(trend).findByRole('status')).toHaveTextContent(/In progress/);
    await user.keyboard('{ArrowLeft}');
    const readout = within(trend).getByRole('status');
    expect(readout).toHaveTextContent(/Complete/);
    expect(readout).toHaveTextContent('₦100.00');
    expect(readout).toHaveTextContent('₦60.00');

    await user.click(screen.getByRole('button', { name: 'Show figures' }));
    const table = screen.getByRole('table', { name: 'Report figures by period' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Online payments')).toBeInTheDocument();
  });

  it('sends custom dates and grouping as query parameters', async () => {
    const requests: string[] = [];
    server.use(
      http.get(`${API}/reports/`, ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json(report);
      }),
    );
    renderPage(<ReportsPage />, { role: 'manager', path: '/reports' });
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Report summaries' });
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    const from = screen.getByLabelText('From');
    const to = screen.getByLabelText('To');
    await user.clear(from);
    await user.type(from, '2026-09-01');
    await user.clear(to);
    await user.type(to, '2026-09-30');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() =>
      expect(
        requests.some(
          (search) =>
            search.includes('period=custom') &&
            search.includes('from=2026-09-01') &&
            search.includes('to=2026-09-30'),
        ),
      ).toBe(true),
    );
    await user.click(screen.getByRole('radio', { name: 'Weekly' }));
    await waitFor(() =>
      expect(
        requests.some(
          (search) => search.includes('group_by=week') && search.includes('from=2026-09-01'),
        ),
      ).toBe(true),
    );
    await user.click(screen.getByRole('radio', { name: '7 days' }));
    await waitFor(() =>
      expect(
        requests.some(
          (search) => search.includes('period=last_7_days') && !search.includes('from='),
        ),
      ).toBe(true),
    );
  });

  it('compares totals with the previous equal-length range', async () => {
    const requests: string[] = [];
    server.use(
      http.get(`${API}/reports/`, ({ request }) => {
        const search = new URL(request.url).search;
        requests.push(search);
        return HttpResponse.json(
          search.includes('from=2026-08-05')
            ? { ...report, totals: { ...report.totals, activated_value: 5000, collections: 8000 } }
            : report,
        );
      }),
    );
    renderPage(<ReportsPage />, { role: 'owner', path: '/reports' });
    expect(await screen.findByText('Up 100%')).toBeInTheDocument();
    expect(screen.getByText('Down 25%')).toBeInTheDocument();
    expect(
      requests.some(
        (search) => search.includes('from=2026-08-05') && search.includes('to=2026-09-03'),
      ),
    ).toBe(true);
  });

  it('keeps staff and platform staff away from the report navigation', () => {
    for (const role of ['staff', 'platform_staff'] as const) {
      const principal = derivePrincipal(makeUser(role));
      expect(can(principal, 'reports.view')).toBe(false);
      expect(visibleItems(WORKSPACE_NAV, principal).some((item) => item.to === '/reports')).toBe(
        false,
      );
    }
    expect(can(derivePrincipal(makeUser('manager')), 'reports.view')).toBe(true);
  });

  it('distinguishes accounting unavailable from a zero count', async () => {
    server.use(
      http.get(`${API}/reports/`, () =>
        HttpResponse.json({
          ...report,
          accounting_available: false,
          latest_accounting_at: null,
          averages: { ...report.averages, active_vouchers: null },
          rows: report.rows.map((row) => ({ ...row, active_vouchers: null })),
        }),
      ),
    );
    renderPage(<ReportsPage />, { role: 'owner', path: '/reports' });
    expect(await screen.findByText('Usage accounting unavailable')).toBeInTheDocument();
    expect(screen.getByText(/active vouchers cannot be charted/)).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: /Active vouchers by period/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Revenue over time' })).toBeInTheDocument();
  });

  it('shows honest empty states when nothing was recorded', async () => {
    server.use(
      http.get(`${API}/reports/`, () =>
        HttpResponse.json({
          ...report,
          totals: {
            activated_value: 0,
            collections: 0,
            collections_by_channel: { online_payments: 0, agent_wallet: 0, credit_repayments: 0 },
          },
          rows: report.rows.map((row) => ({
            ...row,
            activated_value: 0,
            collections: 0,
            collections_by_channel: { online_payments: 0, agent_wallet: 0, credit_repayments: 0 },
          })),
        }),
      ),
    );
    renderPage(<ReportsPage />, { role: 'owner', path: '/reports' });
    expect(
      await screen.findByText('No activated voucher value was recorded for this range.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No collections were recorded for this range.')).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Share of collections by channel' }),
    ).not.toBeInTheDocument();
  });

  it('still works against a server without the channel breakdown', async () => {
    server.use(
      http.get(`${API}/reports/`, () =>
        HttpResponse.json({
          ...report,
          totals: { activated_value: 10000, collections: 6000 },
          rows: report.rows.map(({ collections_by_channel: _omit, ...row }) => row),
        }),
      ),
    );
    renderPage(<ReportsPage />, { role: 'owner', path: '/reports' });
    expect(await screen.findByText(/channel breakdown is not available/)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Channel mix over time' }),
    ).not.toBeInTheDocument();
  });
});
