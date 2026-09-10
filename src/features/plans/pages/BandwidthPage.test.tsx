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
    expect(() => toKbps('0.5', 'kbps')).toThrow();
    expect(() => toKbps('10001', 'Mbps')).toThrow();
  });
  it('lists profile speeds while keeping mutation controls hidden for staff', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(paginated([profile]))));
    renderPage(<BandwidthPage />, { role: 'staff', path: '/plans/bandwidth' });
    expect(await screen.findByText('2.5 Mbps')).toBeVisible();
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
  it('keeps speeds read-only during editing and displays protected delete errors', async () => {
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
    expect(screen.getByLabelText('Upload speed')).toHaveAttribute('readonly');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete profile' }));
    expect(
      await screen.findByText('This profile is used by plans. Deactivate it instead.'),
    ).toBeVisible();
  });
  it('selects a profile in the existing plan form and preserves NGN conversion', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
      http.get(endpoint, () => HttpResponse.json(paginated([profile]))),
      http.get(`${endpoint}4/`, () => HttpResponse.json(profile)),
      http.post(`${API}/plans/`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1, ...body });
      }),
    );
    renderPage(<PlansPage />, { role: 'manager', path: '/plans' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New plan' }));
    const form = within(screen.getByRole('dialog', { name: 'New plan' }));
    await user.type(form.getByLabelText(/Plan name/), 'Daily');
    await user.type(form.getByLabelText(/^Price/), '50.50');
    await user.click(form.getByRole('button', { name: 'Use bandwidth profile' }));
    await screen.findByRole('option', { name: /Home standard/ });
    await user.selectOptions(form.getByLabelText('Bandwidth profile'), '4');
    expect(form.getByLabelText(/Speed limit/)).toHaveValue('2500k/10000k');
    await user.click(form.getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(body?.bandwidth_profile).toBe(4));
    expect(body?.price).toBe(5050);
    expect(body?.rate_limit).toBe('2500k/10000k');
  });
});
