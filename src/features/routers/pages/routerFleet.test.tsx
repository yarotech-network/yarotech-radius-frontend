import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { RouterAllowance } from '../components/RouterAllowance';
import RoutersPage from './RoutersPage';

describe('Router fleet controls', () => {
  it.each([0, 2, null])('shows the authoritative allowance including %s limits', async (limit) => {
    server.use(
      http.get(`${API}/subscriptions/`, () =>
        HttpResponse.json({ entitlements: { routers_used: 2, terms: { max_routers: limit } } }),
      ),
    );
    renderPage(<RouterAllowance />, { role: 'owner' });
    expect(
      await screen.findByText(`2 / ${limit === null ? 'Unlimited' : limit}`),
    ).toBeInTheDocument();
    if (limit !== null) expect(screen.getByText(/Router limit reached/)).toBeInTheDocument();
    else expect(screen.queryByText(/Router limit reached/)).not.toBeInTheDocument();
  });
  it('does not turn a failed allowance request into zero capacity', async () => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json({}, { status: 503 })));
    renderPage(<RouterAllowance />, { role: 'owner' });
    expect(await screen.findByText('Allowance unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry allowance' })).toBeInTheDocument();
    expect(screen.queryByText(/Router limit reached/)).not.toBeInTheDocument();
  });
  it('does not fetch billing information for a platform administrator', () => {
    renderPage(<RouterAllowance />, { role: 'platform_admin' });
    expect(screen.queryByRole('region', { name: 'Router allowance' })).not.toBeInTheDocument();
  });
  it('quick filters retain search and deployment while resetting pagination', async () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${API}/routers/`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json(paginated([]));
      }),
    );
    renderPage(<RoutersPage />, {
      path: '/routers',
      route: '/routers?page=3&search=branch&deployment_status=failed',
    });
    await screen.findByText('No routers match');
    await userEvent.click(screen.getByRole('button', { name: 'Active setup' }));
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('onboarding_state')).toBe('active'));
    expect(seen.at(-1)?.searchParams.get('page')).toBe('1');
    expect(seen.at(-1)?.searchParams.get('search')).toBe('branch');
    expect(seen.at(-1)?.searchParams.get('deployment_status')).toBe('failed');
    expect(screen.getByRole('button', { name: 'Active setup' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
