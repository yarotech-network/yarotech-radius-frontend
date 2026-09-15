import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type { InternetPlan, MacDevice } from '@/types/api';
import DevicesPage from './DevicesPage';
import { deviceSchema, formToPatch, formToPayload, normaliseMac } from '../deviceSchemas';

const plan: InternetPlan = {
  id: 1,
  name: 'Daily 1GB',
  plan_type: 'iot_mac',
  price: 50000,
  price_display: '₦500',
  duration_hours: 24,
  rate_limit: '5M/10M',
  data_limit: 1024,
  voucher_prefix: 'WH',
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
};
const device = (extra: Partial<MacDevice> = {}): MacDevice => ({
  id: 1,
  version: 1,
  mac_address: 'AA:BB:CC:DD:EE:FF',
  device_name: 'Lobby TV',
  plan: 1,
  plan_name: 'Daily 1GB',
  tenant: 5,
  accounting: {
    available: true,
    session_count: 3,
    open_sessions: 1,
    bytes_total: 1536,
    last_connected_at: '2026-09-11T10:00:00Z',
  },
  is_active: true,
  expires_at: '2027-09-01T10:00:00Z',
  created_at: '2026-09-01T10:00:00Z',
  ...extra,
});

beforeEach(() =>
  server.use(
    http.get(`${API}/routers/`, () =>
      HttpResponse.json(paginated([{ id: 'router-1', name: 'Lab router' }])),
    ),
  ),
);

describe('device schemas', () => {
  it('requires a router, validates VLAN boundaries and requires an expiry only for timed access', () => {
    const base = {
      device_name: 'TV',
      mac_address: 'aabbccddeeff',
      plan: '1',
      router: 'router-1',
      access_type: 'permanent',
      vlan_id: '',
      description: '',
      expires_at: '',
      is_active: true,
    };
    expect(formToPayload(deviceSchema.parse(base)).expires_at).toBeNull();
    for (const mac_address of [
      'aabb.ccdd.eeff',
      'AA:BB:CC:DD:EE:FF',
      'aa-bb-cc-dd-ee-ff',
      'aabbccddeeff',
    ])
      expect(formToPayload(deviceSchema.parse({ ...base, mac_address })).mac_address).toBe(
        'AA:BB:CC:DD:EE:FF',
      );
    expect(deviceSchema.safeParse({ ...base, router: '' }).success).toBe(false);
    expect(deviceSchema.safeParse({ ...base, access_type: 'timed' }).success).toBe(false);
    expect(deviceSchema.safeParse({ ...base, vlan_id: '4095' }).success).toBe(false);
    expect(deviceSchema.safeParse({ ...base, vlan_id: '1' }).success).toBe(true);
  });

  it('normalises MAC formats and converts the local expiry to ISO', () => {
    expect(normaliseMac('aabb.ccdd.eeff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(normaliseMac('aa-bb-cc-dd-ee-ff')).toBe('AA:BB:CC:DD:EE:FF');
    const parsed = deviceSchema.parse({
      router: 'router-1',
      access_type: 'timed',
      vlan_id: '',
      description: '',
      device_name: 'TV',
      mac_address: 'aa-bb-cc-dd-ee-01',
      plan: '1',
      expires_at: '2027-01-01T10:00',
      is_active: true,
    });
    const payload = formToPayload(parsed);
    expect(payload.mac_address).toBe('AA:BB:CC:DD:EE:01');
    expect(payload.plan).toBe(1);
    expect(new Date(payload.expires_at!).getTime()).toBe(new Date('2027-01-01T10:00').getTime());
  });
  it('patches only what changed', () => {
    const d = device();
    const parsed = deviceSchema.parse({
      router: 'router-1',
      access_type: 'timed',
      vlan_id: '',
      description: '',
      device_name: 'Lobby TV',
      mac_address: 'aa:bb:cc:dd:ee:ff',
      plan: '1',
      expires_at: '2027-09-01T11:00',
      is_active: false,
    });
    const patch = formToPatch(parsed, d);
    expect(patch).not.toHaveProperty('mac_address');
    expect(patch.is_active).toBe(false);
  });
});

describe('DevicesPage', () => {
  it('lists devices with expiry, registers a new one and removes one', async () => {
    const rows = [
      device(),
      device({
        id: 2,
        device_name: 'Old printer',
        mac_address: '00:11:22:33:44:55',
        is_active: false,
        expires_at: '2026-01-01T10:00:00Z',
      }),
    ];
    const created: Record<string, unknown>[] = [];
    const deleted: string[] = [];
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([plan]))),
      http.get(`${API}/iot-devices/`, () => HttpResponse.json(paginated(rows))),
      http.post(`${API}/iot-devices/`, async ({ request }) => {
        created.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          device({ id: 3, device_name: 'Kitchen tablet', mac_address: '12:22:33:44:55:66' }),
          { status: 201 },
        );
      }),
      http.delete(`${API}/iot-devices/:id/`, ({ params }) => {
        deleted.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage(<DevicesPage />, { path: '/devices' });
    const table = await screen.findByRole('table', { name: 'Devices' });
    expect(await within(table).findByText('Lobby TV')).toBeInTheDocument();
    expect(within(table).getAllByText('1 open').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('1.5 KB').length).toBeGreaterThan(0);
    expect(within(table).getAllByText(/Expired/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Add device' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add IoT / MAC Device' });
    await userEvent.type(within(dialog).getByLabelText(/Device name/), 'Kitchen tablet');
    await userEvent.type(within(dialog).getByLabelText(/MAC address/), '12-22-33-44-55-66');
    await userEvent.selectOptions(await within(dialog).findByLabelText(/Plan/), '1');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Router/), 'router-1');
    await userEvent.type(within(dialog).getByLabelText(/VLAN ID/), '42');
    await userEvent.type(within(dialog).getByLabelText(/Description/), 'Kitchen equipment');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save device' }));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({
      device_name: 'Kitchen tablet',
      mac_address: '12:22:33:44:55:66',
      plan: 1,
      is_active: true,
    });
    expect(created[0]).toMatchObject({
      expires_at: null,
      access_type: 'permanent',
      router: 'router-1',
      vlan_id: 42,
      description: 'Kitchen equipment',
    });

    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Old printer' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove device' }));
    await waitFor(() => expect(deleted).toEqual(['2']));
  }, 15000);

  it('is read-only for staff', async () => {
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([plan]))),
      http.get(`${API}/iot-devices/`, () => HttpResponse.json(paginated([device()]))),
    );
    renderPage(<DevicesPage />, { path: '/devices', role: 'staff' });
    const table = await screen.findByRole('table', { name: 'Devices' });
    expect(await within(table).findByText('Lobby TV')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add device' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
  });
});

describe('Device directory recovery', () => {
  it('keeps filters together and retains records when refresh fails', async () => {
    let failed = false;
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([plan]))),
      http.get(`${API}/iot-devices/`, ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return failed
          ? HttpResponse.json({ detail: 'Unavailable' }, { status: 503 })
          : HttpResponse.json(paginated([device()]));
      }),
    );
    renderPage(<DevicesPage />, { path: '/devices' });
    const table = await screen.findByRole('table', { name: 'Devices' });
    await within(table).findByRole('button', { name: 'Lobby TV' });
    expect(screen.getByText('1 matching device')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'false');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Plan' }), '1');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search devices' }), 'Lobby');
    await waitFor(() =>
      expect(
        requests.some(
          (p) =>
            p.get('is_active') === 'false' && p.get('plan') === '1' && p.get('search') === 'Lobby',
        ),
      ).toBe(true),
    );
    failed = true;
    await userEvent.click(screen.getByRole('button', { name: 'Refresh devices' }));
    expect(await screen.findByText('Devices could not be refreshed')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Lobby TV' })).toBeInTheDocument();
    await userEvent.click(within(table).getByRole('button', { name: 'Lobby TV' }));
    expect(await screen.findByRole('dialog', { name: 'Edit Lobby TV' })).toBeInTheDocument();
  });

  it('retries failed plan options while the device directory remains visible', async () => {
    let failed = true;
    server.use(
      http.get(`${API}/plans/`, () =>
        failed
          ? HttpResponse.json({ detail: 'Unavailable' }, { status: 503 })
          : HttpResponse.json(paginated([plan])),
      ),
      http.get(`${API}/iot-devices/`, () => HttpResponse.json(paginated([device()]))),
    );
    renderPage(<DevicesPage />, { path: '/devices', role: 'staff' });
    expect(await screen.findByText('Plan filters unavailable')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Devices' })).getByText('Lobby TV'),
    ).toBeInTheDocument();
    failed = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry plans' }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveTextContent('Daily 1GB'),
    );
    expect(screen.queryByText('Plan filters unavailable')).not.toBeInTheDocument();
  });
});

describe('Device lifecycle controls', () => {
  it('retains the renewal request and version across a network retry, and shows history', async () => {
    const bodies: unknown[] = [];
    const keys: (string | null)[] = [];
    let attempts = 0;
    const timed = device({
      access_type: 'timed',
      status: 'suspended',
      is_active: false,
      router: 'router-1',
    });
    server.use(
      http.get(`${API}/plans/`, () =>
        HttpResponse.json(
          paginated([plan, { ...plan, id: 2, name: 'Voucher only', plan_type: 'voucher' }]),
        ),
      ),
      http.get(`${API}/iot-devices/`, () => HttpResponse.json(paginated([timed]))),
      http.get(`${API}/iot-devices/1/`, () => HttpResponse.json(timed)),
      http.get(`${API}/iot-devices/1/renewals/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/iot-devices/1/renew/`, async ({ request }) => {
        bodies.push(await request.json());
        keys.push(request.headers.get('Idempotency-Key'));
        attempts += 1;
        return attempts === 1 ? HttpResponse.error() : HttpResponse.json({ ...timed, version: 2 });
      }),
    );
    renderPage(<DevicesPage />, { path: '/devices' });
    await userEvent.click(
      await within(await screen.findByRole('table', { name: 'Devices' })).findByRole('button', {
        name: 'Actions for Lobby TV',
      }),
    );
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Manage access / Renew' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manage Lobby TV' });
    expect(within(dialog).getByText(/Unused time is retained/)).toBeInTheDocument();
    expect(await within(dialog).findByText(/No recorded operator renewals/)).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText(/Renewal plan/), '1');
    expect(within(dialog).queryByRole('option', { name: /Voucher only/ })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm renewal grant' }));
    expect(await within(dialog).findByText(/Retry uses the same request/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Renewal plan/)).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry same request' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies).toEqual([
      { plan: 1, expected_version: 1 },
      { plan: 1, expected_version: 1 },
    ]);
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
  });

  it('shows removed registration history without offering edits or renewal', async () => {
    const deleted = device({ status: 'deleted', is_active: false });
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([plan]))),
      http.get(`${API}/iot-devices/`, ({ request }) =>
        HttpResponse.json(
          paginated(
            new URL(request.url).searchParams.get('include_deleted') === 'true' ? [deleted] : [],
          ),
        ),
      ),
      http.get(`${API}/iot-devices/1/`, () => HttpResponse.json(deleted)),
      http.get(`${API}/iot-devices/1/renewals/`, () => HttpResponse.json(paginated([]))),
    );
    renderPage(<DevicesPage />, { path: '/devices' });
    await userEvent.selectOptions(screen.getByLabelText('Retained registrations'), 'true');
    await userEvent.click(
      await within(await screen.findByRole('table', { name: 'Devices' })).findByRole('button', {
        name: 'Actions for Lobby TV',
      }),
    );
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'History' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manage Lobby TV' });
    expect(within(dialog).queryByLabelText('Device action')).not.toBeInTheDocument();
    expect(await within(dialog).findByText(/No recorded operator renewals/)).toBeInTheDocument();
  });
});
