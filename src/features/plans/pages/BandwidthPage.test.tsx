import { describe, expect, it } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import BandwidthPage from './BandwidthPage';
import PlansPage from './PlansPage';
import { toKbps } from '../bandwidth';

const profile = {
  id: 4,
  name: 'Home standard',
  upload_kbps: 2500,
  download_kbps: 10000,
  rate_limit: '2500k/10000k',
  is_active: true,
  plan_count: 2,
  created_at: '2026-09-08T10:00:00Z',
};
const endpoint = `${API}/bandwidth-profiles/`;

describe('Bandwidth profiles', () => {
  it('converts decimal Mbps to exact whole kbps and rejects unsupported precision', () => {
    expect(toKbps('2.5', 'Mbps')).toBe(2500);
    expect(toKbps('1.001', 'Mbps')).toBe(1001);
    expect(toKbps('512', 'kbps')).toBe(512);
    expect(toKbps('1.5', 'Gbps')).toBe(1500000);
    expect(toKbps('0.000001', 'Gbps')).toBe(1);
    expect(toKbps('10', 'Gbps')).toBe(10000000);
    expect(() => toKbps('0.0000001', 'Gbps')).toThrow();
    expect(() => toKbps('10.000001', 'Gbps')).toThrow();
    expect(() => toKbps('1', 'unknown')).toThrow();
    expect(() => toKbps('0.5', 'kbps')).toThrow();
    expect(() => toKbps('10001', 'Mbps')).toThrow();
  });
  it('lists profile speeds while keeping mutation controls hidden for staff', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(paginated([profile]))));
    renderPage(<BandwidthPage />, { role: 'staff', path: '/plans/bandwidth' });
    expect(await screen.findByText('2.5 Mbps', {}, { timeout: 10000 })).toBeVisible();
    expect(screen.getByText('10 Mbps')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'New profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
  it('creates with explicit unit conversion and an idempotency key', async () => {
    let payload: unknown;
    let key: string | null = null;
    server.use(
      http.get(endpoint, () => HttpResponse.json(paginated([]))),
      http.post(endpoint, async ({ request }) => {
        payload = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json(profile, { status: 201 });
      }),
    );
    renderPage(<BandwidthPage />, { role: 'manager', path: '/plans/bandwidth' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New profile' }));
    const form = within(screen.getByRole('dialog', { name: 'New bandwidth profile' }));
    await user.type(form.getByLabelText('Profile name'), 'Home standard');
    await user.clear(form.getByLabelText('Upload speed'));
    await user.type(form.getByLabelText('Upload speed'), '2.5');
    await user.click(form.getByRole('button', { name: 'Create profile' }));
    await waitFor(() =>
      expect(payload).toEqual({
        name: 'Home standard',
        upload_kbps: 2500,
        download_kbps: 10000,
        is_active: true,
      }),
    );
    expect(key).toBeTruthy();
  });
  it('allows speed editing and displays protected delete errors', async () => {
    server.use(
      http.get(endpoint, () => HttpResponse.json(paginated([profile]))),
      http.delete(`${endpoint}4/`, () =>
        HttpResponse.json(
          { detail: 'This profile is used by plans. Deactivate it instead.' },
          { status: 400 },
        ),
      ),
    );
    renderPage(<BandwidthPage />, { role: 'manager', path: '/plans/bandwidth' });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Home standard' }));
    expect(screen.getByLabelText('Upload speed')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Upload unit')).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete profile' }));
    expect(
      await screen.findByText('This profile is used by plans. Deactivate it instead.'),
    ).toBeVisible();
  });
  it('sets Hotspot speeds directly with no profile link and preserves NGN conversion', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/plans/`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1, ...body });
      }),
    );
    renderPage(<PlansPage />, { role: 'manager', path: '/plans' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New plan' }));
    const form = within(screen.getByRole('dialog', { name: 'Create New Hotspot Plan' }));
    expect(form.queryByRole('button', { name: 'Use bandwidth profile' })).not.toBeInTheDocument();
    expect(form.queryByLabelText('Bandwidth profile')).not.toBeInTheDocument();
    await user.type(form.getByLabelText(/Plan name/), 'Daily');
    await user.type(form.getByLabelText(/^Price/), '50.50');
    await user.clear(form.getByLabelText('Upload speed amount'));
    await user.type(form.getByLabelText('Upload speed amount'), '2.5');
    await user.click(form.getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(body?.bandwidth_profile).toBeNull());
    expect(body?.price).toBe(5050);
    expect(body?.rate_limit).toBe('2500k/10000k');
  });
});

it('updates every editable profile field with Kbps/Mbps/Gbps conversion', async () => {
  let payload: unknown;
  server.use(
    http.get(endpoint, () => HttpResponse.json(paginated([profile]))),
    http.patch(`${endpoint}4/`, async ({ request }) => {
      payload = await request.json();
      return HttpResponse.json(profile);
    }),
  );
  renderPage(<BandwidthPage />, { role: 'owner', path: '/plans/bandwidth' });
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Edit Home standard' }));
  const form = within(screen.getByRole('dialog', { name: 'Edit bandwidth profile' }));
  expect(form.getByLabelText('Upload speed')).toHaveValue(2.5);
  expect(form.getByLabelText('Upload unit')).toHaveValue('Mbps');
  await user.clear(form.getByLabelText('Profile name'));
  await user.type(form.getByLabelText('Profile name'), 'Business');
  await user.clear(form.getByLabelText('Upload speed'));
  await user.type(form.getByLabelText('Upload speed'), '1.5');
  await user.selectOptions(form.getByLabelText('Upload unit'), 'Gbps');
  await user.clear(form.getByLabelText('Download speed'));
  await user.type(form.getByLabelText('Download speed'), '512');
  await user.selectOptions(form.getByLabelText('Download unit'), 'kbps');
  await user.click(form.getByRole('checkbox', { name: /^Active profile/ }));
  await user.click(form.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(payload).toEqual({ name: 'Business', upload_kbps: 1500000, download_kbps: 512, is_active: false }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
