import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { Route } from 'react-router';
import Page from './AccessCustomersPage';
import { RetiredCustomerSection } from './RetiredCustomerSection';
const row = {
  id: 42,
  buyer_name: 'Buyer',
  buyer_email: 'buyer@example.com',
  buyer_phone: '',
  reference: 'purchase-42',
  plan: 'Daily',
  source: 'customer',
  date: '2026-09-16T10:00:00Z',
  status: 'unused',
  connection: 'never_connected',
  devices: 0,
  sessions: 0,
  last_seen: null,
  bytes_total: 0,
  expires_at: null,
  access_code: null,
};
const device = {
  mac_address: 'AA:BB:CC:DD:EE:01',
  codes_used: 1,
  lifetime_codes_used: 1,
  sessions: 3,
  first_seen: '2026-09-16T10:00:00Z',
  last_seen: '2026-09-16T12:00:00Z',
  bytes_total: 1048576,
  status: 'online',
};
function options() {
  server.use(
    http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
    http.get(`${API}/routers/`, () => HttpResponse.json(paginated([]))),
  );
}
describe('Customer access workspace', () => {
  it('shows buyers before login, stale sync, and an authorized detail link', async () => {
    options();
    server.use(
      http.get(`${API}/customer-access/`, () =>
        HttpResponse.json({ ...paginated([row]), synced_at: null, sync_fresh: false }),
      ),
      http.get(`${API}/customer-access/42/`, () =>
        HttpResponse.json({ ...row, access_code: 'TESTCODE' }),
      ),
      http.get(`${API}/customer-devices/`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('voucher')).toBe('42');
        return HttpResponse.json({
          ...paginated([device]),
          summary: { devices: 1, distinct_codes: 1 },
          synced_at: null,
          timezone: 'Africa/Lagos',
          accounting_note: '',
        });
      }),
    );
    renderPage(<Page />, { role: 'owner', path: '/customers' });
    const table = await screen.findByRole('table', {
      name: 'Customer purchases and voucher users',
    });
    expect(await within(table).findByText('Buyer')).toBeVisible();
    expect(within(table).getByText('Never connected')).toBeInTheDocument();
    expect(within(table).getByText('Bought online')).toBeInTheDocument();
    expect(screen.getByText(/Device synchronization is missing/)).toBeVisible();
    expect(screen.queryByText('TESTCODE')).not.toBeInTheDocument();
    await userEvent.click(within(table).getByRole('button', { name: 'View details' }));
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('TESTCODE')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    expect(within(dialog).getByText('purchase-42')).toBeInTheDocument();
    expect(within(dialog).queryByText(/\?/)).not.toBeInTheDocument();
    const devices = within(dialog).getByRole('region', { name: 'Devices on this code' });
    expect(await within(devices).findByText('AA:BB:CC:DD:EE:01')).toBeInTheDocument();
    expect(within(devices).getByText('Online')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View device history' })).not.toBeInTheDocument();
  });

  it('opens a record from a shared link and redirects retired sections', async () => {
    options();
    server.use(
      http.get(`${API}/customer-access/`, () =>
        HttpResponse.json({ ...paginated([row]), synced_at: null, sync_fresh: true }),
      ),
      http.get(`${API}/customer-access/42/`, () =>
        HttpResponse.json({ ...row, access_code: 'LINKED' }),
      ),
      http.get(`${API}/customer-devices/`, () =>
        HttpResponse.json({
          ...paginated([]),
          summary: { devices: 0, distinct_codes: 0 },
          synced_at: null,
          timezone: 'Africa/Lagos',
          accounting_note: '',
        }),
      ),
    );
    renderPage(<Page />, {
      role: 'owner',
      path: '/customers',
      route: '/customers/devices?voucher=42',
      extraRoutes: (
        <>
          <Route path="/customers/devices" element={<RetiredCustomerSection />} />
          <Route path="/customers/contacts" element={<RetiredCustomerSection />} />
        </>
      ),
    });
    const dialog = await screen.findByRole('dialog', { name: 'Customer access details' });
    expect(await within(dialog).findByText('LINKED')).toBeVisible();
    expect(
      await within(dialog).findByText('No device has a recorded session with this code yet.'),
    ).toBeInTheDocument();
  });
  it('keeps extra filters behind a toggle, opens them for active filters and clears them', async () => {
    options();
    const requests: URL[] = [];
    server.use(
      http.get(`${API}/customer-access/`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ ...paginated([row]), synced_at: null, sync_fresh: true });
      }),
    );
    renderPage(<Page />, { role: 'owner', path: '/customers', route: '/customers?source=agent' });
    const toggle = await screen.findByRole('button', { name: 'More filters (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Source')).toHaveValue('agent');
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('source')).toBe('agent'));
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('source')).toBeNull());
  });
  it('summarises the matching records and shows removable filter chips', async () => {
    options();
    const requests: URL[] = [];
    server.use(
      http.get(`${API}/customer-access/`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({
          ...paginated([{ ...row, connection: 'online', last_seen: '2026-09-16T12:00:00Z' }]),
          synced_at: '2026-09-16T12:00:00Z',
          sync_fresh: true,
          summary: {
            total: 12,
            connection: { online: 3, offline: 5, never_connected: 4, unknown: 0 },
            sources: { customer: 7, agent: 4, admin: 1 },
            bytes_total: 1073741824,
          },
        });
      }),
    );
    renderPage(<Page />, {
      role: 'owner',
      path: '/customers',
      route: '/customers?source=agent&status=used',
    });
    const summary = await screen.findByRole('region', { name: 'Customer summary' });
    expect(await within(summary).findByText('12')).toBeInTheDocument();
    expect(within(summary).getByText('7 bought online · 4 agent · 1 staff')).toBeInTheDocument();
    expect(within(summary).getByText('25% of customers connected')).toBeInTheDocument();
    expect(within(summary).getByText('1.0 GB')).toBeInTheDocument();
    const connection = screen.getByRole('radiogroup', { name: 'Connection' });
    expect(within(connection).getByRole('radio', { name: /^All\s*12/ })).toBeChecked();
    expect(
      within(connection).getByRole('radio', { name: /^Never connected\s*4/ }),
    ).toBeInTheDocument();

    const chips = screen.getByRole('list', { name: 'Active filters' });
    await userEvent.click(
      within(chips).getByRole('button', { name: 'Remove filter Source: Sold by agent' }),
    );
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('source')).toBeNull());
    expect(requests.at(-1)?.searchParams.get('status')).toBe('used');
  });

  it('sends independent historical status and live connection filters', async () => {
    options();
    const requests: URL[] = [];
    server.use(
      http.get(`${API}/customer-access/`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ ...paginated([row]), synced_at: null, sync_fresh: true });
      }),
    );
    renderPage(<Page />, { role: 'owner', path: '/customers' });
    const table = await screen.findByRole('table', {
      name: 'Customer purchases and voucher users',
    });
    await within(table).findByText('Buyer');
    await userEvent.selectOptions(screen.getByLabelText('Code status'), 'used');
    const connection = screen.getByRole('radiogroup', { name: 'Connection' });
    await userEvent.click(within(connection).getByRole('radio', { name: /^Online/ }));
    await waitFor(() => {
      expect(requests.at(-1)?.searchParams.get('status')).toBe('used');
      expect(requests.at(-1)?.searchParams.get('activity')).toBe('online');
    });
  });
});

beforeEach(() => {
  server.use(http.get(`${API}/dashboard/stats/`, () => HttpResponse.json({}, { status: 503 })));
});
