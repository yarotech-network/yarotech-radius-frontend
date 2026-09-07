import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import BusinessPlansPage from './BusinessPlansPage';
import { priceInKobo } from '../businessPlanRules';

it('converts naira exactly and rejects invalid prices', () => {
  expect(priceInKobo('5000.50')).toBe(500050);
  expect(priceInKobo('0.01')).toBe(1);
  for (const value of ['0', '-1', '1.001', '1e3', 'NaN', '21474836.48'])
    expect(priceInKobo(value)).toBeNull();
});

describe('BusinessPlansPage', () => {
  it('publishes a plan with authoritative values and refreshes the catalogue', async () => {
    let saved: Record<string, unknown> | null = null;
    let key: string | null = null;
    server.use(
      http.get(`${API}/platform/business-plans/`, () =>
        HttpResponse.json(paginated(saved ? [{ ...saved, id: 1, is_active: true }] : [])),
      ),
      http.post(`${API}/platform/business-plans/`, async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>;
        key = request.headers.get('Idempotency-Key');
        expect(request.headers.has('X-Tenant-ID')).toBe(false);
        return HttpResponse.json({ ...saved, id: 1, is_active: true }, { status: 201 });
      }),
    );
    renderPage(<BusinessPlansPage />, { path: '/platform/business-plans', role: 'platform_admin' });
    await userEvent.click(screen.getByRole('button', { name: 'Create business plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create business plan' });
    await userEvent.type(within(dialog).getByLabelText(/Plan name/), 'Business Plus');
    await userEvent.type(within(dialog).getByLabelText(/Price/), '5000.50');
    await userEvent.type(
      within(dialog).getByLabelText(/Features/),
      'Voucher management\nRouter management',
    );
    await userEvent.type(within(dialog).getByLabelText('Maximum routers'), '3');
    await userEvent.type(within(dialog).getByLabelText('Daily voucher printing limit'), '100');
    await userEvent.click(within(dialog).getByLabelText('WhatsApp enabled'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish business plan' }));
    await waitFor(() =>
      expect(saved).toEqual({
        name: 'Business Plus',
        price: 500050,
        duration_days: 30,
        max_routers: 3,
        daily_voucher_print_limit: 100,
        whatsapp_enabled: true,
        is_active: true,
        features: ['Voucher management', 'Router management'],
      }),
    );
    expect(key).toMatch(/^[A-Za-z0-9_.:-]{16,128}$/);
    expect(await screen.findByText('Business plan published')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Business plans' });
    expect(await within(table).findByText('Business Plus')).toBeInTheDocument();
  });

  it('retains the form and displays API field errors', async () => {
    server.use(
      http.get(`${API}/platform/business-plans/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/platform/business-plans/`, () =>
        HttpResponse.json({ name: ['Choose another name.'] }, { status: 400 }),
      ),
    );
    renderPage(<BusinessPlansPage />, { path: '/platform/business-plans', role: 'platform_admin' });
    await userEvent.click(screen.getByRole('button', { name: 'Create business plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create business plan' });
    await userEvent.type(within(dialog).getByLabelText(/Plan name/), 'Business');
    await userEvent.type(within(dialog).getByLabelText(/Price/), '50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish business plan' }));
    expect(await within(dialog).findByText('Choose another name.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Plan name/)).toHaveValue('Business');
  });
});

it('edits limits and deactivates with the loaded version, and explains protected deletion', async () => {
  const plan = {
    id: 7,
    name: 'Starter',
    price: 100000,
    duration_days: 30,
    features: [],
    max_routers: 2,
    daily_voucher_print_limit: 50,
    whatsapp_enabled: false,
    is_active: true,
    version: 3,
  };
  let patch: Record<string, unknown> | null = null;
  server.use(
    http.get(`${API}/platform/business-plans/`, () => HttpResponse.json(paginated([plan]))),
    http.patch(`${API}/platform/business-plans/7/`, async ({ request }) => {
      patch = (await request.json()) as Record<string, unknown>;
      Object.assign(plan, patch, { version: 4 });
      return HttpResponse.json(plan);
    }),
    http.delete(`${API}/platform/business-plans/7/`, () =>
      HttpResponse.json(
        { detail: 'This plan has payment or subscription history. Deactivate it instead.' },
        { status: 409 },
      ),
    ),
  );
  renderPage(<BusinessPlansPage />, { path: '/platform/business-plans', role: 'platform_admin' });
  const table = await screen.findByRole('table', { name: 'Business plans' });
  await userEvent.click(await within(table).findByRole('button', { name: 'Edit Starter' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Starter' });
  await userEvent.clear(within(dialog).getByLabelText('Maximum routers'));
  await userEvent.click(within(dialog).getByLabelText(/Active: show/));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(patch).toMatchObject({
      expected_version: 3,
      max_routers: null,
      is_active: false,
      daily_voucher_print_limit: 50,
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Edit Starter' })).not.toBeInTheDocument(),
  );
  await userEvent.click(within(table).getByRole('button', { name: 'Delete Starter' }));
  const confirmation = await screen.findByRole('dialog', { name: 'Delete business plan' });
  await userEvent.click(within(confirmation).getByRole('button', { name: 'Delete plan' }));
  expect(
    await within(confirmation).findByText(/This plan has payment or subscription history/),
  ).toBeInTheDocument();
});

it('deletes an unused plan after confirmation', async () => {
  let deleted = false;
  server.use(
    http.get(`${API}/platform/business-plans/`, () =>
      HttpResponse.json(
        paginated(
          deleted
            ? []
            : [
                {
                  id: 9,
                  name: 'Unused',
                  price: 10000,
                  duration_days: 1,
                  features: [],
                  is_active: false,
                  version: 1,
                },
              ],
        ),
      ),
    ),
    http.delete(`${API}/platform/business-plans/9/`, () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderPage(<BusinessPlansPage />, { path: '/platform/business-plans', role: 'platform_admin' });
  const table = await screen.findByRole('table', { name: 'Business plans' });
  await userEvent.click(await within(table).findByRole('button', { name: 'Delete Unused' }));
  await userEvent.click(
    within(await screen.findByRole('dialog', { name: 'Delete business plan' })).getByRole(
      'button',
      { name: 'Delete plan' },
    ),
  );
  await waitFor(() => expect(deleted).toBe(true));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Delete business plan' })).not.toBeInTheDocument(),
  );
});
