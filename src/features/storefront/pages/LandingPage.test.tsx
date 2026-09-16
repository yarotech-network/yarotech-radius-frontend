import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import LandingPage from './LandingPage';

function mockPricing() {
  server.use(
    http.get(`${API}/pricing/`, () =>
      HttpResponse.json(
        paginated([
          {
            id: 1,
            name: 'Starter',
            price: 1500000,
            price_display: '₦15,000',
            duration_days: 30,
            features: ['1 router', 'Vouchers'],
            is_active: true,
          },
        ]),
      ),
    ),
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});

describe('public landing page', () => {
  it('renders hero, business plans and about for visitors', async () => {
    mockPricing();
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole('heading', { name: /run your wi-fi business/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /create workspace/i })[0]).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.getByRole('link', { name: /view business plans/i })).toHaveAttribute(
      'href',
      '/pricing',
    );
    expect(await screen.findByRole('heading', { name: 'Starter' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /built for west african hotspot businesses/i }),
    ).toBeInTheDocument();
    // No featured storefront configured → the customer section stays hidden.
    expect(
      screen.queryByRole('heading', { name: /buy a wi-fi access code/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps customer purchases within storefronts even when a featured slug is configured', async () => {
    vi.stubEnv('VITE_FEATURED_STOREFRONT_SLUG', 'wuse-hotspot');
    mockPricing();
    renderWithProviders(<LandingPage />);
    expect(await screen.findByRole('heading', { name: 'Starter' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Buy access code' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Does a business subscription include internet access?'),
    ).toBeInTheDocument();
  });
});
