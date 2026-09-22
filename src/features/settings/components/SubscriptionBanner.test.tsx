import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, makeAssignment, makeUser } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { derivePrincipal } from '@/services/auth/principal';
import type { TenantSubscription } from '@/types/api';
import { SubscriptionBanner } from './SubscriptionBanner';
import { subscriptionNotice } from '../subscriptionNotice';
import { settingsKeys } from '../queries';

const subscription = (extra: Partial<TenantSubscription> = {}): TenantSubscription => ({
  id: 1,
  tenant: 5,
  plan: 1,
  plan_name: 'Starter',
  status: 'trial',
  started_at: '2026-09-01T00:00:00Z',
  expires_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
  is_trial: true,
  is_expired: false,
  ...extra,
});

describe('subscription notice', () => {
  it.each([true, false])('uses the exact seven-day boundary (trial=%s)', (trial) => {
    const now = Date.parse('2026-09-21T12:00:00Z');
    const base = { status: trial ? 'trial' as const : 'active' as const, is_trial: trial };
    const expiry = now + 7 * 86400_000;
    expect(subscriptionNotice(subscription({ ...base, expires_at: new Date(expiry + 1).toISOString() }), now)).toBeNull();
    expect(subscriptionNotice(subscription({ ...base, expires_at: new Date(expiry).toISOString() }), now)?.text).toContain('7d');
    expect(subscriptionNotice(subscription({ ...base, expires_at: new Date(now).toISOString() }), now)?.text).toBe('Your subscription has expired');
    expect(subscriptionNotice(subscription({ ...base, expires_at: new Date(now - 1).toISOString() }), now)?.text).toBe('Your subscription has expired');
  });
  it('uses the expiry boundary, never a negative countdown', () => {
    const now = Date.parse('2026-09-08T12:00:00Z');
    expect(
      subscriptionNotice(subscription({ expires_at: new Date(now + 120_000).toISOString() }), now)
        ?.text,
    ).toBe('Your free trial ends in 2m');
    expect(
      subscriptionNotice(subscription({ expires_at: new Date(now).toISOString() }), now)?.text,
    ).toBe('Your subscription has expired');
    expect(subscriptionNotice(subscription({ expires_at: 'invalid' }), now)?.text).toBe(
      'Subscription expiry is unavailable',
    );
  });
  it('respects server-expired and cancelled states even when the date is in the future', () => {
    expect(subscriptionNotice(subscription({ is_expired: true }), Date.now())?.text).toBe(
      'Your subscription has expired',
    );
    expect(subscriptionNotice(subscription({ status: 'cancelled' }), Date.now())?.text).toBe(
      'Your subscription is cancelled',
    );
  });
  it('distinguishes paid active plans from trials and missing subscriptions', () => {
    expect(
      subscriptionNotice(subscription({ status: 'active', is_trial: false }), Date.now())?.text,
    ).toMatch(/^Starter subscription expires in/);
    expect(subscriptionNotice(null, Date.now())?.text).toBe('No active subscription');
  });
});

describe('SubscriptionBanner', () => {
  it.each([true, false])('hides healthy subscriptions outside the final week (trial=%s)', async (trial) => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json(subscription({
      status: trial ? 'trial' : 'active', is_trial: trial,
      expires_at: new Date(Date.now() + 8 * 86400_000).toISOString(),
    }))));
    const view = renderPage(<SubscriptionBanner />, { role: 'owner' });
    await waitFor(() => expect(view.client.getQueryData(settingsKeys.subscription())).toBeDefined());
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Workspace subscription' })).not.toBeInTheDocument());
  });

  it('removes the countdown when refreshed subscription data confirms a renewed deadline', async () => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json(subscription())));
    const view = renderPage(<SubscriptionBanner />, { role: 'owner' });
    await screen.findByText(/Your free trial ends in/);
    await act(async () => {
      view.client.setQueryData(settingsKeys.subscription(), subscription({
        status: 'active', is_trial: false,
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      }));
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Workspace subscription' })).not.toBeInTheDocument());
  });
  it('shows trial time and links owners to the existing billing flow', async () => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json(subscription())));
    renderPage(<SubscriptionBanner />, { role: 'owner' });
    expect(await screen.findByText(/Your free trial ends in/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Renew plan' })).toHaveAttribute(
      'href',
      '/settings/subscription',
    );
  });
  it('does not offer staff an owner-only renewal control', async () => {
    server.use(
      http.get(`${API}/subscriptions/`, () =>
        HttpResponse.json(subscription({ status: 'expired', is_expired: true })),
      ),
    );
    renderPage(<SubscriptionBanner />, { role: 'staff' });
    expect(await screen.findByText('Your subscription has expired')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View billing' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Renew plan' })).not.toBeInTheDocument();
  });
  it('handles a workspace without a subscription', async () => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json({}, { status: 404 })));
    renderPage(<SubscriptionBanner />, { role: 'owner' });
    expect(await screen.findByText('No active subscription')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a plan' })).toBeInTheDocument();
  });
  it('recovers from unavailable status without claiming the subscription expired', async () => {
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json({}, { status: 503 })));
    renderPage(<SubscriptionBanner />, { role: 'owner' });
    expect(await screen.findByText('Subscription status is unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Renew plan' })).not.toBeInTheDocument();
    server.use(http.get(`${API}/subscriptions/`, () => HttpResponse.json(subscription())));
    await userEvent.click(screen.getByRole('button', { name: 'Retry subscription status' }));
    expect(await screen.findByText(/Your free trial ends in/)).toBeInTheDocument();
  });
  it('does not fetch a tenant subscription for platform administration or assigned staff', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/subscriptions/`, () => {
        calls++;
        return HttpResponse.json(subscription());
      }),
    );
    const first = renderPage(<SubscriptionBanner />, { role: 'platform_admin' });
    expect(
      screen.queryByRole('region', { name: 'Workspace subscription' }),
    ).not.toBeInTheDocument();
    first.unmount();
    const next = renderPage(<SubscriptionBanner />, {
      principal: derivePrincipal(
        makeUser('platform_staff'),
        [makeAssignment(5, ['payments.view'])],
        5,
      ),
    });
    await waitFor(() => expect(next.client.isFetching()).toBe(0));
    expect(calls).toBe(0);
  });
});
