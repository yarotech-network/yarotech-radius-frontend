import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import Page from './AccessCustomersPage';
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
    expect(screen.getByRole('link', { name: 'View device history' })).toHaveAttribute(
      'href',
      '/customers/devices?voucher=42',
    );
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
    await userEvent.selectOptions(screen.getByLabelText('Connection'), 'online');
    await waitFor(() => {
      expect(requests.at(-1)?.searchParams.get('status')).toBe('used');
      expect(requests.at(-1)?.searchParams.get('activity')).toBe('online');
    });
  });
});

beforeEach(() => {
  server.use(http.get(`${API}/dashboard/stats/`, () => HttpResponse.json({}, { status: 503 })));
});
