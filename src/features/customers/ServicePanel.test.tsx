import { describe, it, expect, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, paginated } from '@/test/fixtures';
import { server } from '@/test/server';
import { renderPage } from '@/test/renderPage';
import { ServicePanel } from './ServicePanel';
import PPPoEPlansPage from '@/features/plans/pages/PPPoEPlansPage';
const plan = {
  id: 2,
  name: 'Home monthly',
  bandwidth_profile: 4,
  bandwidth_profile_name: 'Home',
  rate_limit: '2500k/10000k',
  duration_hours: 720,
  price: 50050,
  is_active: true,
};
const service = {
  id: 3,
  customer: 1,
  plan: 2,
  plan_name: 'Home monthly',
  router: 'router-1',
  router_name: 'Main router',
  username: 'yrp-example',
  rate_limit: '2500k/10000k',
  period_hours: 720,
  expires_at: '2027-01-01T00:00:00Z',
  suspended: false,
  status: 'configured',
  version: 4,
  disconnect_state: 'not_checked',
  last_reconciled_at: null,
};
const services = `${API}/pppoe-services/`;
describe('PPPoE service workflows', () => {
  it('shows configured service to staff without mutation controls or passwords', async () => {
    server.use(http.get(services, () => HttpResponse.json(paginated([service]))));
    renderPage(<ServicePanel customer={1} archived={false} onBusy={vi.fn()} />, { role: 'staff' });
    expect(await screen.findByText('yrp-example')).toBeVisible();
    expect(screen.getByText('configured')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Renew service' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('PPPoE password')).not.toBeInTheDocument();
  });
  it('assigns a selected plan/router with a write-only password and idempotency key', async () => {
    let payload: unknown,
      key: string | null = null;
    server.use(
      http.get(services, () => HttpResponse.json(paginated([]))),
      http.get(`${API}/pppoe-plans/`, () => HttpResponse.json(paginated([plan]))),
      http.get(`${API}/routers/`, () =>
        HttpResponse.json(paginated([{ id: 'router-1', name: 'Main router', is_active: true }])),
      ),
      http.post(services, async ({ request }) => {
        payload = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json(service, { status: 201 });
      }),
    );
    renderPage(<ServicePanel customer={1} archived={false} onBusy={vi.fn()} />, {
      role: 'manager',
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Assign PPPoE service' }));
    await screen.findByRole('option', { name: 'Main router' });
    await user.selectOptions(screen.getByLabelText('PPPoE plan', { exact: true }), '2');
    await user.selectOptions(screen.getByLabelText('Assigned router', { exact: true }), 'router-1');
    await user.type(screen.getByLabelText('PPPoE password'), 'Device-password-883!');
    await user.click(screen.getByRole('button', { name: 'Assign service' }));
    await waitFor(() =>
      expect(payload).toEqual({
        customer: 1,
        plan: 2,
        router: 'router-1',
        password: 'Device-password-883!',
      }),
    );
    expect(key).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText('PPPoE password')).not.toBeInTheDocument());
  });
  it('renews with the displayed version and a stable retry key, without claiming a payment', async () => {
    let payload: unknown;
    const keys: string[] = [];
    server.use(
      http.get(services, () => HttpResponse.json(paginated([service]))),
      http.post(`${services}3/renew/`, async ({ request }) => {
        payload = await request.json();
        keys.push(request.headers.get('Idempotency-Key')!);
        return HttpResponse.json({ detail: 'Refresh before trying again.' }, { status: 409 });
      }),
    );
    renderPage(<ServicePanel customer={1} archived={false} onBusy={vi.fn()} />, { role: 'owner' });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Renew service' }));
    expect(screen.getByText(/records no payment/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Confirm renew' }));
    expect(await screen.findByText('Refresh before trying again.')).toBeVisible();
    expect(payload).toEqual({ expected_version: 4 });
    await user.click(screen.getByRole('button', { name: 'Confirm renew' }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toBe(keys[1]);
  });
  it('creates a PPPoE plan with exact NGN minor units and selected bandwidth', async () => {
    let payload: unknown;
    server.use(
      http.get(`${API}/pppoe-plans/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/pppoe-plans/`, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(plan, { status: 201 });
      }),
      http.get(`${API}/bandwidth-profiles/`, () =>
        HttpResponse.json(
          paginated([
            { id: 4, name: 'Home', upload_kbps: 2500, download_kbps: 10000, is_active: true },
          ]),
        ),
      ),
      http.get(`${API}/bandwidth-profiles/4/`, () =>
        HttpResponse.json({
          id: 4,
          name: 'Home',
          upload_kbps: 2500,
          download_kbps: 10000,
          is_active: true,
        }),
      ),
    );
    renderPage(<PPPoEPlansPage />, { role: 'manager', path: '/plans/pppoe' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New PPPoE plan' }));
    const form = within(screen.getByRole('dialog'));
    await user.type(form.getByLabelText('Plan name'), 'Home monthly');
    await form.findByRole('option', { name: /Home -/ });
    await user.selectOptions(form.getByLabelText('Bandwidth profile', { exact: true }), '4');
    await user.clear(form.getByLabelText('Price (NGN)'));
    await user.type(form.getByLabelText('Price (NGN)'), '500.50');
    await user.click(form.getByRole('button', { name: 'Create PPPoE plan' }));
    await waitFor(() =>
      expect(payload).toEqual({
        name: 'Home monthly',
        bandwidth_profile: 4,
        duration_hours: 720,
        price: 50050,
      }),
    );
  });
});
