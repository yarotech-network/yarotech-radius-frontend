import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router';
import { delay, http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { AuthContext, type AuthContextValue } from '@/app/auth/authContext';
import { PublicLayout } from '@/app/shell/PublicLayout';
import { PurchaseLayout } from '@/app/shell/PurchaseLayout';
import ContactPage from './pages/ContactPage';
import PricingPage from './pages/PricingPage';
import AboutPage from './pages/AboutPage';
import GettingStartedPage from '@/features/auth/pages/GettingStartedPage';
import StorefrontPage from './pages/StorefrontPage';

const anonymous: AuthContextValue = {
  status: 'anonymous',
  principal: null,
  signOutReason: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refreshPrincipal: vi.fn(),
  selectTenant: vi.fn(),
  switchContext: vi.fn(),
};

describe('public visitor journeys', () => {
  it('does not carry one tenant catalogue into another tenant while its plans load', async () => {
    server.use(
      http.get(`${API}/public/tenants/:slug/`, ({ params }) =>
        HttpResponse.json({
          id: params.slug === 'first' ? 1 : 2,
          slug: params.slug,
          name: `${params.slug} business`,
        }),
      ),
      http.get(`${API}/public/tenants/:slug/plans/`, async ({ params }) => {
        if (params.slug === 'second') await delay(300);
        return HttpResponse.json(
          paginated([
            {
              id: 1,
              name: `${params.slug} plan`,
              price: 50000,
              duration_hours: 24,
              rate_limit: '5M/10M',
              data_limit: 1024,
            },
          ]),
        );
      }),
    );
    renderWithProviders(
      <>
        <Link to="/s/second">Switch business</Link>
        <Routes>
          <Route path="/s/:slug/*" element={<StorefrontPage />} />
        </Routes>
      </>,
      { route: '/s/first' },
    );
    expect(await screen.findByRole('heading', { name: 'first plan' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Switch business' }));
    expect(await screen.findByRole('heading', { name: 'second business' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'first plan' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'second plan' })).toBeInTheDocument();
  });
  it('offers official contact links and does not invent a WhatsApp channel', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByRole('link', { name: /Email us/ })).toHaveAttribute(
      'href',
      'mailto:info@yarotech.com.ng',
    );
    expect(screen.getByRole('link', { name: /Give us a call/ })).toHaveAttribute(
      'href',
      'tel:+2347075373603',
    );
    expect(screen.getByText('No. 122, Lukoro Plaza A, Kano, Nigeria')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it('closes navigation with Escape, restores toggle focus and follows public links', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AuthContext.Provider value={anonymous}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<h1>Home</h1>} />
            <Route path="/about" element={<AboutPage />} />
          </Route>
        </Routes>
      </AuthContext.Provider>,
    );
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(toggle);
    const nav = screen.getByRole('navigation', { name: 'Public' });
    within(nav).getByRole('link', { name: 'About' }).focus();
    await user.keyboard('{Escape}');
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await user.click(within(nav).getByRole('link', { name: 'About' }));
    expect(await screen.findByRole('heading', { name: /Local understanding/ })).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('explains preparation and links to explicit setup actions', () => {
    renderWithProviders(<GettingStartedPage />);
    expect(screen.getByRole('heading', { name: 'Before you begin' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore business plans/ })).toHaveAttribute(
      'href',
      '/pricing',
    );
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
  });

  it('recovers pricing errors without showing invented prices', async () => {
    server.use(
      http.get(`${API}/pricing/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    renderWithProviders(<PricingPage />);
    expect(await screen.findByText('Could not load pricing')).toBeInTheDocument();
    server.use(
      http.get(`${API}/pricing/`, () =>
        HttpResponse.json(
          paginated([
            {
              id: 7,
              name: 'Business',
              price: 1200000,
              duration_days: 30,
              features: ['Agent sales'],
              max_routers: 4,
              is_active: true,
            },
          ]),
        ),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    expect(await screen.findByRole('heading', { name: 'Business' })).toBeInTheDocument();
    expect(screen.getByText('4 active routers')).toBeInTheDocument();
    expect(screen.getByText('for 30 days')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create workspace' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('shows empty business pricing with useful guidance', async () => {
    server.use(http.get(`${API}/pricing/`, () => HttpResponse.json(paginated([]))));
    renderWithProviders(<PricingPage />);
    expect(await screen.findByText('Pricing coming soon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('keeps tenant purchases separate from marketing navigation', async () => {
    server.use(
      http.get(`${API}/public/tenants/demo/`, () =>
        HttpResponse.json({ id: 1, name: 'Demo Hotspot', slug: 'demo' }),
      ),
    );
    renderWithProviders(
      <Routes>
        <Route element={<PurchaseLayout />}>
          <Route path="/s/:slug/*" element={<h1>Choose a plan</h1>} />
        </Route>
      </Routes>,
      { route: '/s/demo' },
    );
    expect(await screen.findByRole('link', { name: 'Demo Hotspot' })).toHaveAttribute(
      'href',
      '/s/demo',
    );
    expect(screen.queryByRole('link', { name: /Create workspace/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('For purchase support, contact the business you bought from.'),
    ).toBeInTheDocument();
  });
});
