import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as clipboard from '@/lib/utilities/clipboard';
import { server } from '@/test/server';
import { API, makeUser, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { derivePrincipal } from '@/services/auth/principal';
import StorefrontManagementPage from './pages/StorefrontManagementPage';
import { Route, Routes } from 'react-router';
import { RequireCapability } from '@/app/auth/RequireCapability';
import { visibleItems, WORKSPACE_NAV } from '@/app/navigation/navConfig';

function mockProfile(slug = 'wuse-hotspot', active = true) {
  server.use(
    http.get(`${API}/tenants/profile/`, () =>
      HttpResponse.json({
        id: 5,
        name: 'Wuse Hotspot',
        slug,
        is_active: active,
        phone: '',
        email: '',
        address: '',
        updated_at: '2026-09-01T00:00:00Z',
      }),
    ),
    http.get(`${API}/public/tenants/${slug}/plans/`, ({ request }) => {
      expect(request.headers.get('Authorization')).toBeNull();
      expect(request.headers.get('X-Tenant-ID')).toBeNull();
      return HttpResponse.json(
        paginated([
          {
            id: 7,
            name: 'Daily Wi-Fi',
            price: 50000,
            duration_hours: 24,
            rate_limit: '5M/10M',
            data_limit: 0,
          },
        ]),
      );
    }),
  );
}

describe('tenant storefront management', () => {
  it('keeps storefront management out of staff navigation and denies its route', async () => {
    const principal = derivePrincipal(makeUser('staff'));
    expect(visibleItems(WORKSPACE_NAV, principal).some((item) => item.to === '/storefront')).toBe(
      false,
    );
    renderPage(
      <Routes>
        <Route element={<RequireCapability capability="settings.profile" />}>
          <Route path="storefront" element={<StorefrontManagementPage />} />
        </Route>
        <Route path="dashboard" element={<h1>Dashboard</h1>} />
      </Routes>,
      { principal, path: '/*', route: '/storefront' },
    );
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open storefront' })).not.toBeInTheDocument();
  });

  it('opens and copies the tenant customer link and previews its checkout', async () => {
    const user = userEvent.setup();
    mockProfile();
    renderPage(<StorefrontManagementPage />, { role: 'owner' });
    expect(await screen.findByRole('link', { name: 'Open storefront' })).toHaveAttribute(
      'href',
      '/s/wuse-hotspot',
    );
    expect(await screen.findByRole('article', { name: 'Daily Wi-Fi' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View customer checkout' })).toHaveAttribute(
      'href',
      '/s/wuse-hotspot/checkout/7',
    );
    await user.click(screen.getByRole('button', { name: 'Copy storefront link' }));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/s/wuse-hotspot`);
    expect(screen.getByRole('link', { name: 'Manage plans' })).toHaveAttribute('href', '/plans');
  });

  it('uses the returned slug for another tenant instead of a fixed storefront', async () => {
    mockProfile('kano-wifi');
    renderPage(<StorefrontManagementPage />, {
      principal: derivePrincipal(makeUser('manager', { tenant_id: 9, tenant_name: 'Kano Wi-Fi' })),
    });
    expect(await screen.findByRole('link', { name: 'Open storefront' })).toHaveAttribute(
      'href',
      '/s/kano-wifi',
    );
    expect(await screen.findByRole('link', { name: 'View customer checkout' })).toHaveAttribute(
      'href',
      '/s/kano-wifi/checkout/7',
    );
    expect(screen.queryByText(/\/s\/wuse-hotspot/)).not.toBeInTheDocument();
  });

  it('explains when no customer plans have been published', async () => {
    mockProfile();
    server.use(
      http.get(`${API}/public/tenants/wuse-hotspot/plans/`, () => HttpResponse.json(paginated([]))),
    );
    renderPage(<StorefrontManagementPage />);
    expect(await screen.findByText('No plans available to customers')).toBeInTheDocument();
  });

  it('shows an inactive business without loading or advertising plans', async () => {
    mockProfile('wuse-hotspot', false);
    renderPage(<StorefrontManagementPage />);
    expect(await screen.findByText('Your storefront is unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View customer checkout' })).not.toBeInTheDocument();
  });

  it('shows a retryable profile error without inventing a customer link', async () => {
    server.use(
      http.get(`${API}/tenants/profile/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    renderPage(<StorefrontManagementPage />);
    expect(await screen.findByText('Could not load your storefront')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open storefront' })).not.toBeInTheDocument();
  });
  it('explains how to copy manually when clipboard access fails', async () => {
    const user = userEvent.setup();
    mockProfile();
    const copy = vi.spyOn(clipboard, 'copyToClipboard').mockResolvedValue(false);
    renderPage(<StorefrontManagementPage />);
    await user.click(await screen.findByRole('button', { name: 'Copy storefront link' }));
    expect(await screen.findByText(/Could not copy automatically/)).toBeInTheDocument();
    copy.mockRestore();
  });

  it('retains customer plans with a warning after a failed refresh', async () => {
    const user = userEvent.setup();
    mockProfile();
    renderPage(<StorefrontManagementPage />);
    expect(await screen.findByRole('article', { name: 'Daily Wi-Fi' })).toBeInTheDocument();
    server.use(
      http.get(`${API}/public/tenants/wuse-hotspot/plans/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh plans' }));
    expect(await screen.findByText('Customer plans could not be refreshed')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Daily Wi-Fi' })).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 customer plans')).toBeInTheDocument();
  });
});
