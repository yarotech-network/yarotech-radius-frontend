import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API, makeAssignment, makeUser } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { derivePrincipal } from '@/services/auth/principal';
import { networkSummary } from '@/test/dashboardFixtures';
import { PageMetrics } from './PageMetrics';
import { NetworkCards } from './NetworkCards';

describe('Workspace page summaries', () => {
  it('uses server plan totals independently of table filters and pagination', async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/dashboard/stats/`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({ total_plans: 101, active_plans: 70 });
      }),
    );
    renderPage(<PageMetrics section="plans" />, {
      path: '/plans',
      route: '/plans?page=3&search=single&is_active=true',
    });
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(url?.search).toBe('');
    expect(screen.getByText(/archived records excluded/)).toBeInTheDocument();
  });

  it('shows zero customers as a known count', async () => {
    server.use(
      http.get(`${API}/dashboard/stats/`, () => HttpResponse.json({ total_customers: 0 })),
    );
    renderPage(<PageMetrics section="customers" />);
    expect(await screen.findByText('0')).toBeInTheDocument();
  });

  it('does not invent a customer count when an older API omits it', async () => {
    server.use(http.get(`${API}/dashboard/stats/`, () => HttpResponse.json({})));
    renderPage(<PageMetrics section="customers" />);
    await waitFor(() => expect(screen.queryByText('0')).not.toBeInTheDocument());
    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('keeps voucher and collection reporting on separate pages', async () => {
    server.use(
      http.get(`${API}/dashboard/stats/`, () =>
        HttpResponse.json({ total_vouchers: 500, active_vouchers: 300 }),
      ),
    );
    renderPage(<PageMetrics section="vouchers" />);
    expect(await screen.findByText('500')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activated voucher revenue' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Recorded collections and payments' }),
    ).not.toBeInTheDocument();
  });

  it('puts router counts on Routers without a live-session report', async () => {
    server.use(http.get(`${API}/dashboard/network/`, () => HttpResponse.json(networkSummary)));
    renderPage(<NetworkCards section="routers" />);
    expect(await screen.findByRole('link', { name: 'Main router' })).toBeInTheDocument();
    expect(screen.getByText('Total routers').parentElement?.parentElement).toHaveTextContent('3');
    expect(screen.queryByText('All-time traffic')).not.toBeInTheDocument();
    expect(
      screen.getByText('Confirmed offline routers').parentElement?.parentElement,
    ).toHaveTextContent('0');
  });

  it('keeps sessions reporting free of router cards', async () => {
    server.use(http.get(`${API}/dashboard/network/`, () => HttpResponse.json(networkSummary)));
    renderPage(<NetworkCards section="sessions" />);
    expect(await screen.findByText('52')).toBeInTheDocument();
    expect(screen.queryByText('Total routers')).not.toBeInTheDocument();
    expect(screen.getByText('All-time traffic')).toBeInTheDocument();
  });

  it('does not request business or accounting summaries for router-only delegated staff', () => {
    renderPage(
      <>
        <PageMetrics section="payments" />
        <NetworkCards section="routers" />
      </>,
      {
        principal: derivePrincipal(
          makeUser('platform_staff'),
          [makeAssignment(5, ['routers.view'])],
          5,
        ),
      },
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('exposes an unavailable summary with retry instead of zero', async () => {
    server.use(http.get(`${API}/dashboard/stats/`, () => HttpResponse.json({}, { status: 503 })));
    renderPage(<PageMetrics section="plans" />);
    const region = screen.getByRole('region', { name: 'plans workspace summary' });
    await within(region).findByText('Summary could not be refreshed');
    expect(within(region).queryByText('0')).not.toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Retry summary' })).toBeInTheDocument();
  });
});
