import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, makeUser } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { can, derivePrincipal } from '@/services/auth/principal';
import { visibleItems, WORKSPACE_NAV } from '@/app/navigation/navConfig';
import ReportsPage from './ReportsPage';

const report = {
  period: 'last_30_days', group_by: 'day', from_date: '2026-09-04', to_date: '2026-10-03',
  reporting_timezone: 'Africa/Lagos', observed_at: '2026-10-03T12:00:00Z', currency: 'NGN',
  amount_unit: 'kobo', activation_basis: 'first_activation', collections_basis: 'recorded',
  usage_basis: 'distinct_vouchers_with_radius_session_overlap', accounting_available: true,
  latest_accounting_at: '2026-10-03T11:55:00Z', completed_periods: 1,
  totals: { activated_value: 10000, collections: 6000 },
  averages: { activated_value: 10000, collections: 6000, active_vouchers: 2 },
  rows: [{ start: '2026-10-02', end_exclusive: '2026-10-03', in_progress: false,
    complete: true, activated_value: 10000, collections: 6000, active_vouchers: 2 },
  { start: '2026-10-03', end_exclusive: '2026-10-04', in_progress: true,
    complete: false, activated_value: 0, collections: 0, active_vouchers: 0 }],
};

describe('Tenant reports', () => {
  it('shows separate measures with bar and donut charts instead of an exact figures table', async () => {
    server.use(http.get(`${API}/reports/`, () => HttpResponse.json(report)));
    renderPage(<ReportsPage />, { role: 'owner', path: '/reports' });
    expect(await screen.findByText('Activated voucher value')).toBeInTheDocument();
    const summaries = screen.getByRole('region', { name: 'Report summaries' });
    expect(within(summaries).getByText('Recorded collections')).toBeInTheDocument();
    expect(within(summaries).getByText('Average active vouchers')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activity over time' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Activated value share by reporting period' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Collections', pressed: false }));
    expect(screen.getByRole('button', { name: /2026-10-02:.*Complete/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /2026-10-03:.*In progress/ }));
    expect(screen.getByText(/In progress/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Active vouchers', pressed: false }));
    expect(screen.getByRole('button', { name: /2026-10-02: 2; Complete/ })).toBeInTheDocument();
  });

  it('sends custom dates and grouping as query parameters', async () => {
    let selected = '';
    server.use(http.get(`${API}/reports/`, ({ request }) => {
      selected = new URL(request.url).search;
      return HttpResponse.json(report);
    }));
    renderPage(<ReportsPage />, { role: 'manager', path: '/reports' });
    const user = userEvent.setup();
    await screen.findByText('Activated voucher value');
    await user.selectOptions(screen.getByLabelText('Period'), 'custom');
    await user.selectOptions(screen.getByLabelText('Group by'), 'week');
    await user.type(screen.getByLabelText('From'), '2026-09-01');
    await user.type(screen.getByLabelText('To'), '2026-09-30');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(selected).toContain('from=2026-09-01'));
    expect(selected).toContain('group_by=week');
    expect(selected).toContain('period=custom');
    await user.selectOptions(screen.getByLabelText('Period'), 'last_7_days');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(selected).toContain('period=last_7_days'));
    expect(selected).not.toContain('from=');
  });

  it('keeps staff and platform staff away from the report navigation', () => {
    for (const role of ['staff', 'platform_staff'] as const) {
      const principal = derivePrincipal(makeUser(role));
      expect(can(principal, 'reports.view')).toBe(false);
      expect(visibleItems(WORKSPACE_NAV, principal).some((item) => item.to === '/reports')).toBe(false);
    }
    expect(can(derivePrincipal(makeUser('manager')), 'reports.view')).toBe(true);
  });

  it('distinguishes accounting unavailable from a zero count', async () => {
    server.use(http.get(`${API}/reports/`, () => HttpResponse.json({ ...report,
      accounting_available: false, latest_accounting_at: null,
      averages: { ...report.averages, active_vouchers: null },
      rows: report.rows.map((row) => ({ ...row, active_vouchers: null })),
    })));
    renderPage(<ReportsPage />, { role: 'owner', path: '/reports' });
    expect(await screen.findByText('Usage accounting unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Active vouchers' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activity over time' })).toBeInTheDocument();
  });

  it('shows an honest empty state when no activated value exists', async () => {
    server.use(http.get(`${API}/reports/`, () => HttpResponse.json({ ...report,
      totals: { activated_value: 0, collections: 0 },
      rows: report.rows.map((row) => ({ ...row, activated_value: 0, collections: 0 })),
    })));
    renderPage(<ReportsPage />, { role: 'owner', path: '/reports' });
    expect(await screen.findByText('No activated voucher value was recorded for this range.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Activated value share by reporting period' })).not.toBeInTheDocument();
  });
});
