import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type { TenantSetting } from '@/types/api';
import SettingsLayout from './pages/SettingsLayout';
import BillingSettingsPage from './pages/BillingSettingsPage';

const setting: TenantSetting = {
  id: 1,
  tenant: 5,
  agent_commission_percent: '10.00',
  agent_funding_fee_percent: '1.50',
  agent_funding_flat_fee: 5000,
  voucher_prefix: 'WH',
  default_voucher_code_format: 'legacy',
  max_funding_amount: 5000000,
  updated_at: '2026-09-20T10:00:00Z',
};

describe('Settings redesign', () => {
  it('shows the team section to managers alongside billing', async () => {
    renderPage(<SettingsLayout />, {
      path: '/settings',
      route: '/settings',
      role: 'manager',
      extraRoutes: (
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<div>index</div>} />
        </Route>
      ),
    });
    const nav = await screen.findByRole('navigation', { name: 'Settings sections' });
    for (const name of ['General', 'Billing & payouts', 'Team', 'Subscription']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('explains funding fees and commission with live examples', async () => {
    server.use(http.get(`${API}/tenants/settings/`, () => HttpResponse.json(setting)));
    renderPage(<BillingSettingsPage />, { role: 'manager' });
    // 1.5% of ₦10,000 + ₦50 flat = ₦200 fee, paid on top of the top-up.
    expect(await screen.findByText(/an agent pays/)).toHaveTextContent(
      'Example: to add ₦10,000 to their wallet, an agent pays ₦10,200.00 (₦200.00 fee).',
    );
    expect(screen.getByText(/the agent keeps/)).toHaveTextContent(
      'Example: on a ₦500 voucher, the agent keeps ₦50.00 and pays you ₦450.00.',
    );
    const rate = screen.getByLabelText('Agent commission rate (%)');
    await userEvent.clear(rate);
    await userEvent.type(rate, '20');
    expect(screen.getByText(/the agent keeps/)).toHaveTextContent('keeps ₦100.00');
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
  });
});
