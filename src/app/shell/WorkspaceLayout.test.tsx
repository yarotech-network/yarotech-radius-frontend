import { derivePrincipal } from '@/services/auth/principal';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, makeAssignment, makeUser } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { settingsKeys } from '@/features/settings/queries';
import { WorkspaceLayout } from './WorkspaceLayout';
import { PlatformLayout } from './PlatformLayout';

const subscription = (enabled: boolean, tenant = 5) => ({
  id: 1, tenant, plan: 2, plan_name: 'Custom plan', status: 'active',
  started_at: '2026-09-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z',
  is_trial: false, is_expired: false,
  entitlements: { enabled: true, terms: { whatsapp_enabled: enabled } },
});

describe('workspace WhatsApp navigation', () => {
  it.each(['owner', 'manager', 'staff'] as const)('hides unsupported WhatsApp on desktop and mobile for %s', async (role) => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json(subscription(false))));
    const view = renderPage(<WorkspaceLayout />, { role });
    await waitFor(() => expect(view.client.getQueryData(settingsKeys.subscription())).toBeDefined());
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(within(screen.getByRole('dialog', { name: 'Navigation' })).queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
  });

  it('shows entitled plans and responds to upgrade/downgrade refreshes', async () => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json(subscription(false))));
    const view = renderPage(<WorkspaceLayout />, { role: 'owner' });
    await waitFor(() => expect(view.client.getQueryData(settingsKeys.subscription())).toBeDefined());
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json(subscription(true))));
    await view.client.invalidateQueries({ queryKey: settingsKeys.subscription() });
    expect(await screen.findByRole('link', { name: 'WhatsApp' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole('link', { name: 'WhatsApp' })).toBeInTheDocument();
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json(subscription(false))));
    await view.client.invalidateQueries({ queryKey: settingsKeys.subscription() });
    await waitFor(() => expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument());
  });

  it.each([404, 503])('hides WhatsApp when entitlement cannot be established (HTTP %s)', async (status) => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json({}, { status })));
    const view = renderPage(<WorkspaceLayout />, { role: 'owner' });
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    await waitFor(() => expect(view.client.isFetching()).toBe(0));
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
  });

  it('does not use another tenant entitlement', async () => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json(subscription(true, 999))));
    const view = renderPage(<WorkspaceLayout />, { role: 'owner' });
    await waitFor(() => expect(view.client.isFetching()).toBe(0));
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
  });

  it('retains platform WhatsApp administration', () => {
    renderPage(<PlatformLayout />, { role: 'platform_admin', path: '/platform' });
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', '/platform/whatsapp');
  });
});


describe('direct workspace navigation', () => {
  it.each([
    ['/routers/new', 'Routers', '/routers'],
    ['/plans/bandwidth', 'Service Plans', '/plans'],
    ['/vouchers/generate', 'Vouchers', '/vouchers'],
    ['/settings/billing', 'Settings', '/settings'],
  ])('keeps the section active at %s without submenus', (path, label, destination) => {
    renderPage(<WorkspaceLayout />, { role: 'owner', path });
    const sidebar = within(screen.getByRole('complementary'));
    expect(sidebar.getByRole('link', { name: label })).toHaveAttribute('href', destination);
    expect(sidebar.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(sidebar.queryByRole('button', { name: /^(Expand|Collapse) (Routers|Service Plans|Vouchers|Settings)$/ })).not.toBeInTheDocument();
  });

  it('routes generation-only staff directly to generation on desktop and mobile', async () => {
    const principal = derivePrincipal(makeUser('platform_staff'), [makeAssignment(5, ['vouchers.generate'])], 5);
    renderPage(<WorkspaceLayout />, { principal, path: '/vouchers/generate' });
    const sidebar = within(screen.getByRole('complementary'));
    expect(sidebar.getByRole('link', { name: 'Vouchers' })).toHaveAttribute('href', '/vouchers/generate');
    expect(sidebar.getByRole('link', { name: 'Vouchers' })).toHaveAttribute('aria-current', 'page');
    expect(sidebar.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = within(screen.getByRole('dialog', { name: 'Navigation' }));
    expect(drawer.getByRole('link', { name: 'Vouchers' })).toHaveAttribute('href', '/vouchers/generate');
  });
});
