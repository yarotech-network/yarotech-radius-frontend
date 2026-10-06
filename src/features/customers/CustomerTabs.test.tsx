import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderPage } from '@/test/renderPage';
import { makeUser } from '@/test/fixtures';
import { derivePrincipal } from '@/services/auth/principal';
import { CustomerTabs } from './CustomerTabs';

describe('Customer workspace navigation', () => {
  it('links customers and live sessions and marks the current section', () => {
    renderPage(<CustomerTabs />, { role: 'owner', path: '/customers' });
    const nav = screen.getByRole('navigation', { name: 'Customer workspace sections' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
    const current = within(nav).getByRole('link', { name: 'Customers' });
    expect(current).toHaveAttribute('href', '/customers');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Live sessions' })).toHaveAttribute(
      'href',
      '/sessions',
    );
    // Retired sections are gone.
    expect(within(nav).queryByRole('link', { name: /Devices|Contact records/ })).toBeNull();
  });

  it('hides the switcher when only one section is permitted', () => {
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
    expect(
      screen.queryByRole('navigation', { name: 'Customer workspace sections' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Customers' })).not.toBeInTheDocument();
  });
});
