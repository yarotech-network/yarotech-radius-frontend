import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderPage } from '@/test/renderPage';
import { makeUser } from '@/test/fixtures';
import { derivePrincipal } from '@/services/auth/principal';
import { CustomerTabs } from './CustomerTabs';

describe('Customer workspace navigation', () => {
  it('shows distinct destinations and marks the current section', () => {
    renderPage(<CustomerTabs />, {
      role: 'owner',
      path: '/customers/contacts',
    });
    const nav = screen.getByRole('navigation', { name: 'Customer workspace sections' });
    expect(within(nav).getByRole('link', { name: /Access history/ })).toHaveAttribute(
      'href',
      '/customers',
    );
    expect(within(nav).getByRole('link', { name: /^Devices/ })).toHaveAttribute(
      'href',
      '/customers/devices',
    );
    expect(within(nav).getByRole('link', { name: /Live sessions/ })).toHaveAttribute(
      'href',
      '/sessions',
    );
    const current = within(nav).getByRole('link', { name: /Contact records/ });
    expect(current).toHaveClass('customer-section-link-active');
    expect(current).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows only permitted sections to a sessions-only platform staff member', () => {
    const principal = derivePrincipal(
      makeUser('platform_staff'),
      [
        {
          id: 1,
          user: 1,
          tenant: 10,
          services: ['live_sessions.view'],
          is_active: true,
          created_at: '',
        },
      ],
      10,
    );
    renderPage(<CustomerTabs />, { principal, path: '/sessions' });
    const nav = screen.getByRole('navigation', { name: 'Customer workspace sections' });
    expect(within(nav).getAllByRole('link')).toHaveLength(1);
    expect(within(nav).getByRole('link', { name: /Live sessions/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
