import { describe, expect, it } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import CustomersPage from './CustomersPage';
const mac = 'AA:BB:CC:DD:EE:FF';
const device = {
  mac_address: mac,
  codes_used: 2,
  lifetime_codes_used: 5,
  sessions: 10,
  bytes_total: 1024,
  first_seen: '2026-09-01T10:00:00Z',
  last_seen: '2026-09-11T10:00:00Z',
  status: 'unknown',
};
const payload = (rows = [device]) => ({
  ...paginated(rows),
  summary: { devices: rows.length, distinct_codes: 2 },
  synced_at: '2026-09-11T10:00:00Z',
  timezone: 'Africa/Lagos',
  accounting_note: 'Recorded session totals.',
});
describe('Automatic customer device history', () => {
  it('shows MAC usage and code history without manual customer controls', async () => {
    server.use(
      http.get(`${API}/customer-devices/`, () => HttpResponse.json(payload())),
      http.get(`${API}/customer-devices/:mac/codes/`, () =>
        HttpResponse.json(
          paginated([
            {
              voucher_id: 1,
              access_code: 'CODE-A',
              plan: 'Daily',
              status: 'expired',
              expires_at: '2026-09-10T10:00:00Z',
              device_limit: 3,
              first_seen: device.first_seen,
              last_seen: device.last_seen,
              sessions: 9,
              bytes_total: 1024,
            },
          ]),
        ),
      ),
    );
    renderPage(<CustomersPage />, { role: 'owner', path: '/customers' });
    expect(await screen.findByText(mac)).toBeVisible();
    expect(screen.getByText('Connection unknown', { selector: 'span' })).toBeVisible();
    expect(screen.getByText('Lifetime codes used')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add customer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import CSV' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View access-code history' }));
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText(/CODE-A/)).toBeVisible();
    expect(within(dialog).getByText('expired')).toBeVisible();
    expect(within(dialog).getByText(/Device allowance: 3/)).toBeVisible();
  });
  it('sends date and connection filters and holds invalid custom ranges', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${API}/customer-devices/`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(payload());
      }),
    );
    renderPage(<CustomersPage />, { role: 'owner', path: '/customers' });
    await screen.findByText(mac);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Activity period'), 'week');
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('period')).toBe('week'));
    await user.selectOptions(screen.getByLabelText('Connection status'), 'online');
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('activity')).toBe('online'));
    await user.selectOptions(screen.getByLabelText('Activity period'), 'custom');
    expect(screen.getByText(/Choose a start date/)).toBeVisible();
    await user.type(screen.getByLabelText('From'), '2026-09-01');
    await user.type(screen.getByLabelText('Through'), '2026-09-11');
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('end')).toBe('2026-09-11'));
  });
  it('explains missing accounting without fabricated customers', async () => {
    server.use(
      http.get(`${API}/customer-devices/`, () =>
        HttpResponse.json({ ...payload([]), synced_at: null }),
      ),
    );
    renderPage(<CustomersPage />, { role: 'staff', path: '/customers' });
    expect(await screen.findByText('No observed devices')).toBeVisible();
    expect(screen.getByText(/Waiting for the first accounting sync/)).toBeVisible();
  });
  it('shows a recoverable API error', async () => {
    server.use(
      http.get(`${API}/customer-devices/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    renderPage(<CustomersPage />, { role: 'owner', path: '/customers' });
    expect(await screen.findByRole('button', { name: /try again/i })).toBeVisible();
  });
});
