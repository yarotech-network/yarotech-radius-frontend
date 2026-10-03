import { formatDateTime } from '@/lib/formatting/dates';
import { usePrintVouchers } from '../hooks/usePrintVouchers';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, useLocation } from 'react-router';
import { server } from '@/test/server';
import { API, makeAssignment, makeUser, paginated } from '@/test/fixtures';
import { derivePrincipal } from '@/services/auth/principal';
import { renderPage } from '@/test/renderPage';
import type { InternetPlan, Voucher } from '@/types/api';
import * as download from '@/lib/utilities/download';
import VouchersPage from './VouchersPage';
import { voucherKeys } from '../queries';
import GenerateVouchersPage from './GenerateVouchersPage';
import VoucherDetailPage from './VoucherDetailPage';

const plan: InternetPlan = {
  id: 1,
  name: 'Daily 1GB',
  price: 50000,
  price_display: '₦500',
  duration_hours: 24,
  rate_limit: '5M/10M',
  data_limit: 1024,
  voucher_prefix: 'WH',
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
};
const voucher = (id: number, extra: Partial<Voucher> = {}): Voucher => ({
  id,
  username: `WH1000${id}`,
  plan: 1,
  plan_name: 'Daily 1GB',
  plan_duration: '24',
  price_display: '₦500',
  tenant: 5,
  tenant_name: 'Wuse Hotspot',
  agent: null,
  agent_name: null,
  status: 'unused',
  generation_source: 'admin',
  device_limit: 1,
  expires_at: null,
  activated_at: null,
  created_at: '2026-09-05T09:00:00Z',
  ...extra,
});
const printPage = (v: Voucher) =>
  `<html><body><h1>YAROTECH Voucher</h1><p><strong>Username:</strong> ${v.username}</p><p><strong>Password:</strong> pw-${v.id}</p><p><strong>Plan:</strong> Daily 1GB</p><p><strong>Duration:</strong> 24 hours</p><p><strong>Status:</strong> unused</p></body></html>`;

let printed: string[] = [];
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="voucher-location">{location.search}</output>;
}
beforeEach(() => {
  printed = [];
  server.use(
    http.post(`${API}/vouchers/authorize-print/`, () =>
      HttpResponse.json({ used: 1, limit: null, day: '2026-09-07', timezone: 'Africa/Lagos' }),
    ),
  );
  vi.spyOn(download, 'printHtml').mockImplementation((html) => {
    printed.push(html);
  });
  server.use(http.get(`${API}/plans/`, () => HttpResponse.json(paginated([plan]))));
  server.use(http.get(`${API}/vouchers/summary/`, () => HttpResponse.json({
    total: 3, available: 1, unused: 1, sold: 1, online: 0, used: 1, expired: 0, disabled: 0,
  })));
});
afterEach(() => vi.restoreAllMocks());

describe('VouchersPage', () => {
  it('shows exact creation and expiry timestamps', async () => {
    const row = voucher(1, { expires_at: '2026-10-06T10:00:00Z' });
    server.use(http.get(`${API}/vouchers/`, () => HttpResponse.json(paginated([row]))));
    renderPage(<VouchersPage />, { role: 'manager', path: '/vouchers' });
    const table = await screen.findByRole('table', { name: 'Vouchers' });
    expect(await within(table).findByText(formatDateTime(row.created_at))).toBeVisible();
    expect(within(table).getByText(formatDateTime(row.expires_at))).toBeVisible();
  });

  it('lists vouchers, maps the status tab to ?status= and prints a selection into one sheet', async () => {
    const seen: URL[] = [];
    const rows = [
      voucher(1),
      voucher(2, {
        status: 'active',
        activated_at: '2026-09-05T10:00:00Z',
        expires_at: '2026-09-06T10:00:00Z',
      }),
      voucher(3, { status: 'disabled' }),
    ];
    server.use(
      http.get(`${API}/vouchers/`, ({ request }) => {
        seen.push(new URL(request.url));
        const status = new URL(request.url).searchParams.get('status');
        return HttpResponse.json(
          paginated(status ? rows.filter((r) => r.status === status) : rows),
        );
      }),
      http.get(`${API}/vouchers/:id/print/`, ({ params }) =>
        HttpResponse.text(printPage(voucher(Number(params.id)))),
      ),
    );
    renderPage(<VouchersPage />, { role: 'manager', path: '/vouchers' });
    const table = await screen.findByRole('table', { name: 'Vouchers' });
    expect(await within(table).findByText('WH10001')).toBeInTheDocument();
    expect(seen[0]?.searchParams.get('ordering')).toBe('-created_at');

    await userEvent.click(screen.getByRole('tab', { name: 'Active' }));
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('status')).toBe('active'));
    await waitFor(() => expect(within(table).queryByText('WH10001')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: 'All' }));
    await within(table).findByText('WH10001');

    await userEvent.click(within(table).getByLabelText('Select all vouchers on this page'));
    expect(screen.getByText('3 selected across pages')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Print selected' }));
    await waitFor(() => expect(printed).toHaveLength(1));
    expect(printed[0]).toContain('pw-1');
    expect(printed[0]).toContain('pw-3');
    expect(printed[0]).toContain('Wuse Hotspot');
  });

  it('staff can print (backend allows it) but get no generate/disable/edit actions', async () => {
    server.use(http.get(`${API}/vouchers/`, () => HttpResponse.json(paginated([voucher(1)]))));
    renderPage(<VouchersPage />, { role: 'staff', path: '/vouchers' });
    const table = await screen.findByRole('table', { name: 'Vouchers' });
    await within(table).findByText('WH10001');
    expect(screen.queryByRole('button', { name: 'Generate Voucher' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Select all vouchers on this page')).toBeInTheDocument();
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for WH10001' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'View details' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Print credentials' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Disable' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('keeps vouchers visible when refresh fails and links to their details', async () => {
    server.use(http.get(`${API}/vouchers/`, () => HttpResponse.json(paginated([voucher(1)]))));
    const { client } = renderPage(<VouchersPage />, { role: 'manager', path: '/vouchers' });
    const table = await screen.findByRole('table', { name: 'Vouchers' });
    expect(await within(table).findByRole('link', { name: 'WH10001' })).toHaveAttribute(
      'href',
      '/vouchers/1',
    );
    expect(screen.getByText('1 total vouchers')).toBeInTheDocument();
    server.use(
      http.get(`${API}/vouchers/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    await client.invalidateQueries({ queryKey: voucherKeys.lists() });
    expect(await screen.findByText('Vouchers could not be refreshed')).toBeInTheDocument();
    expect(within(table).getByText('WH10001')).toBeInTheDocument();
  });

  it('offers selection on mobile cards without loading plan filters', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/vouchers/`, () => HttpResponse.json(paginated([voucher(1)]))),
      http.get(`${API}/plans/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    renderPage(<VouchersPage />, { role: 'staff', path: '/vouchers' });
    const cards = screen.getByRole('list');
    await user.click(await within(cards).findByRole('checkbox', { name: 'Select WH10001' }));
    expect(screen.queryByText('Plan filters could not be loaded')).not.toBeInTheDocument();
    expect(screen.getByText('1 selected across pages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print selected' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('button', { name: 'Print selected' })).not.toBeInTheDocument();
  });

  it('shows the empty state with a call to action', async () => {
    server.use(http.get(`${API}/vouchers/`, () => HttpResponse.json(paginated([]))));
    renderPage(<VouchersPage />, { role: 'owner', path: '/vouchers' });
    expect(await screen.findByText('No vouchers yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Voucher' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate vouchers' })).toBeInTheDocument();
  });
});

describe('GenerateVouchersPage', () => {
  it('sends the selected plan and quantity with an Idempotency-Key, then prints the batch', async () => {
    const posts: { body: Record<string, unknown>; key: string | null }[] = [];
    server.use(
      http.post(`${API}/vouchers/generate/`, async ({ request }) => {
        posts.push({
          body: (await request.json()) as Record<string, unknown>,
          key: request.headers.get('Idempotency-Key'),
        });
        return HttpResponse.json([voucher(11), voucher(12)], { status: 201 });
      }),
      http.get(`${API}/vouchers/:id/print/`, ({ params }) =>
        HttpResponse.text(printPage(voucher(Number(params.id)))),
      ),
    );
    renderPage(<GenerateVouchersPage />, {
      role: 'manager',
      path: '/vouchers/generate',
      route: '/vouchers/generate?plan=1',
    });
    const planInput = screen.getByRole('combobox', { name: 'Plan' });
    await waitFor(() => expect(planInput).toHaveValue('Daily 1GB'));
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Quantity' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Quantity' }), '50');
    expect(screen.getByText(/25,000/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Generate 50 vouchers/ }));
    expect(await screen.findByRole('heading', { name: '2 vouchers ready' })).toBeInTheDocument();
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({ plan_id: 1, quantity: 50 });
    expect(posts[0]?.key).toMatch(/^gen-[A-Za-z0-9_.:-]{12,}$/);
    await userEvent.click(screen.getByRole('button', { name: 'Print all' }));
    await waitFor(() => expect(printed).toHaveLength(1));
    expect(printed[0]).toContain('WH100011');
    expect(printed[0]).toContain('pw-12');
  });

  it('starts a distinct request for another batch and shows the returned usernames', async () => {
    const user = userEvent.setup();
    const keys: (string | null)[] = [];
    server.use(
      http.post(`${API}/vouchers/generate/`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return HttpResponse.json([voucher(keys.length + 20)], { status: 201 });
      }),
    );
    renderPage(<GenerateVouchersPage />, {
      role: 'manager',
      path: '/vouchers/generate',
      route: '/vouchers/generate?plan=1',
    });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveValue('Daily 1GB'));
    expect(screen.getByText(/Face value:/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate 20 vouchers' }));
    expect(await screen.findByRole('link', { name: 'WH100021' })).toHaveAttribute(
      'href',
      '/vouchers/21',
    );
    await user.click(screen.getByRole('button', { name: 'Generate another batch' }));
    await user.click(screen.getByRole('button', { name: 'Generate 20 vouchers' }));
    expect(await screen.findByRole('link', { name: 'WH100022' })).toHaveAttribute(
      'href',
      '/vouchers/22',
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('surfaces validation errors from the API on the right field', async () => {
    server.use(
      http.post(`${API}/vouchers/generate/`, () =>
        HttpResponse.json(
          {
            problem: {
              code: 'validation_error',
              message: 'Invalid input.',
              fields: { plan_id: ['Plan not found or inactive.'] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderPage(<GenerateVouchersPage />, { role: 'manager', path: '/vouchers/generate' });
    await screen.findByRole('combobox', { name: 'Plan' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Plan' }));
    await userEvent.click(await screen.findByRole('option', { name: /Daily 1GB/ }));
    await userEvent.click(screen.getByRole('button', { name: /Generate 20 vouchers/ }));
    expect(await screen.findByText('Plan not found or inactive.')).toBeInTheDocument();
  });

  it('searches tenant plans with the keyboard and rejects text without a selected plan', async () => {
    const user = userEvent.setup();
    const otherPlan = { ...plan, id: 2, name: 'Weekly Unlimited' };
    let posts = 0;
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([plan, otherPlan]))),
      http.post(`${API}/vouchers/generate/`, () => {
        posts += 1;
        return HttpResponse.json([voucher(1)], { status: 201 });
      }),
    );
    renderPage(<GenerateVouchersPage />, { role: 'manager', path: '/vouchers/generate' });
    const input = screen.getByRole('combobox', { name: 'Plan' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.click(input);
    await user.type(input, 'Weekly');
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('Weekly Unlimited');
    await user.click(input);
    await user.type(input, 'missing plan');
    expect(screen.getByText('No matching plans')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate 20 vouchers' }));
    expect(await screen.findByText('Choose a plan')).toBeInTheDocument();
    expect(posts).toBe(0);
  });
});

describe('VoucherDetailPage', () => {
  it('shows details; disable calls the endpoint and refreshes', async () => {
    let current = voucher(7);
    server.use(
      http.get(`${API}/vouchers/7/`, () => HttpResponse.json(current)),
      http.post(`${API}/vouchers/7/disable/`, () => {
        current = { ...current, status: 'disabled' };
        return HttpResponse.json({ message: 'Voucher disabled.' });
      }),
    );
    renderPage(<VoucherDetailPage />, {
      role: 'owner',
      path: '/vouchers/:id',
      route: '/vouchers/7',
    });
    expect(await screen.findByRole('heading', { name: /WH10007/ })).toBeInTheDocument();
    expect(screen.getByText('Generated by staff', { selector: 'dd' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Disable' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disable voucher' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Disabled')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
  });

  it.each([
    { role: 'staff' as const, status: 'unused' as const },
    { role: 'owner' as const, status: 'active' as const },
  ])('denies URL-driven editing for $role with a $status voucher', async ({ role, status }) => {
    server.use(http.get(`${API}/vouchers/7/`, () => HttpResponse.json(voucher(7, { status }))));
    renderPage(<VoucherDetailPage />, { role, path: '/vouchers/:id', route: '/vouchers/7?edit=1' });
    await screen.findByRole('heading', { name: /WH10007/ });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('keeps loaded details with a warning after refresh fails', async () => {
    const user = userEvent.setup();
    server.use(http.get(`${API}/vouchers/7/`, () => HttpResponse.json(voucher(7))));
    renderPage(<VoucherDetailPage />, {
      role: 'owner',
      path: '/vouchers/:id',
      route: '/vouchers/7',
    });
    await screen.findByRole('heading', { name: /WH10007/ });
    expect(screen.getByRole('heading', { name: 'Voucher lifecycle' })).toBeInTheDocument();
    server.use(
      http.get(`${API}/vouchers/7/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Voucher could not be refreshed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /WH10007/ })).toBeInTheDocument();
  });

  it('renders a friendly not-found error', async () => {
    server.use(
      http.get(`${API}/vouchers/99/`, () =>
        HttpResponse.json(
          {
            detail: 'No Voucher matches the given query.',
            problem: { code: 'http_404', message: 'No Voucher matches the given query.' },
          },
          { status: 404 },
        ),
      ),
    );
    renderPage(<VoucherDetailPage />, {
      role: 'owner',
      path: '/vouchers/:id',
      route: '/vouchers/99',
      extraRoutes: <Route path="/vouchers" element={<div>list</div>} />,
    });
    expect(await screen.findByText('Voucher not found')).toBeInTheDocument();
  });
});

function PrintQuotaExample() {
  const printer = usePrintVouchers();
  return <button onClick={() => void printer.print([1, 2])}>Print selected vouchers</button>;
}

it('shows quota errors without loading or printing a partial batch', async () => {
  let credentialsRequested = false;
  server.use(
    http.post(`${API}/vouchers/authorize-print/`, () =>
      HttpResponse.json(
        { detail: 'Daily voucher printing limit reached: 1 of 1 used.' },
        { status: 403 },
      ),
    ),
    http.get(`${API}/vouchers/:id/print/`, () => {
      credentialsRequested = true;
      return HttpResponse.text(printPage(voucher(1)));
    }),
  );
  renderPage(<PrintQuotaExample />);
  await userEvent.click(screen.getByRole('button', { name: 'Print selected vouchers' }));
  expect(
    await screen.findByText('Daily voucher printing limit reached: 1 of 1 used.'),
  ).toBeInTheDocument();
  expect(credentialsRequested).toBe(false);
  expect(printed).toHaveLength(0);
});

it('submits device capacity separately from voucher batch quantity', async () => {
  let posted: Record<string, unknown> | null = null;
  server.use(
    http.get(`${API}/plans/`, () => HttpResponse.json(paginated([{ ...plan, max_devices: 10 }]))),
    http.post(`${API}/vouchers/generate/`, async ({ request }) => {
      posted = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json([voucher(123, { device_limit: 3 })], { status: 201 });
    }),
  );
  renderPage(<GenerateVouchersPage />, {
    role: 'manager',
    path: '/vouchers/generate',
    route: '/vouchers/generate?plan=1',
  });
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveValue('Daily 1GB'));
  await userEvent.selectOptions(screen.getByLabelText('Devices per voucher'), '3');
  await userEvent.click(screen.getByRole('button', { name: /Generate 20 vouchers/ }));
  await waitFor(() => expect(posted).toMatchObject({ plan_id: 1, quantity: 20, device_limit: 3 }));
});

describe('GenerateVouchersPage device ceiling', () => {
  const bigPlan = { ...plan, id: 1, name: 'Daily 1GB', max_devices: 5 };
  const smallPlan = { ...plan, id: 2, name: 'Hourly 500MB', price: 20000, max_devices: 2 };

  it('renders 1..max with singular/plural labels and sends the chosen limit', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([bigPlan]))),
      http.post(`${API}/vouchers/generate/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([voucher(124, { device_limit: 4 })], { status: 201 });
      }),
    );
    renderPage(<GenerateVouchersPage />, {
      role: 'manager',
      path: '/vouchers/generate',
      route: '/vouchers/generate?plan=1',
    });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveValue('Daily 1GB'));
    const select = screen.getByLabelText('Devices per voucher') as HTMLSelectElement;
    expect(select).toBeEnabled();
    expect(Array.from(select.options).map((o) => o.text)).toEqual([
      '1 device',
      '2 devices',
      '3 devices',
      '4 devices',
      '5 devices',
    ]);
    await userEvent.selectOptions(select, '4');
    await userEvent.click(screen.getByRole('button', { name: /Generate 20 vouchers/ }));
    await waitFor(() =>
      expect(posted).toMatchObject({ plan_id: 1, quantity: 20, device_limit: 4 }),
    );
  });

  it('disables the selector when the plan allows a single device', async () => {
    server.use(http.get(`${API}/plans/`, () => HttpResponse.json(paginated([plan]))));
    renderPage(<GenerateVouchersPage />, {
      role: 'manager',
      path: '/vouchers/generate',
      route: '/vouchers/generate?plan=1',
    });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveValue('Daily 1GB'));
    const select = screen.getByLabelText('Devices per voucher') as HTMLSelectElement;
    expect(select).toBeDisabled();
    expect(Array.from(select.options).map((o) => o.text)).toEqual(['1 device']);
    expect(screen.getByText(/raise Maximum devices in the plan’s Additional settings/)).toBeInTheDocument();
  });

  it('clamps the selection when switching to a plan with a lower ceiling', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([bigPlan, smallPlan]))),
      http.post(`${API}/vouchers/generate/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([voucher(125, { device_limit: 2 })], { status: 201 });
      }),
    );
    renderPage(<GenerateVouchersPage />, {
      role: 'manager',
      path: '/vouchers/generate',
      route: '/vouchers/generate?plan=1',
    });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveValue('Daily 1GB'));
    await userEvent.selectOptions(screen.getByLabelText('Devices per voucher'), '4');
    await userEvent.click(screen.getByRole('combobox', { name: 'Plan' }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Plan' }), 'Hourly');
    await userEvent.click(screen.getByRole('option', { name: /Hourly 500MB/ }));
    const select = screen.getByLabelText('Devices per voucher') as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('2'));
    await userEvent.click(screen.getByRole('button', { name: /Generate 20 vouchers/ }));
    await waitFor(() =>
      expect(posted).toMatchObject({ plan_id: 2, quantity: 20, device_limit: 2 }),
    );
  });
});

describe('Voucher portal styling', () => {
  it('renders the desk inside the scoped portal wrapper with a compact header', async () => {
    server.use(http.get(`${API}/vouchers/`, () => HttpResponse.json(paginated([voucher(1)]))));
    const { container } = renderPage(<VouchersPage />, { role: 'manager', path: '/vouchers' });
    await screen.findByRole('table', { name: 'Vouchers' });
    expect(container.querySelector('.rv-portal')).not.toBeNull();
    expect(container.querySelector('.rv-portal-header')).not.toBeNull();
    expect(container.querySelector('.router-page-hero')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Voucher Inventory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Voucher' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Activated voucher revenue' })).not.toBeInTheDocument();
    expect(screen.queryByText('Access Control & Sales')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Workspace-wide voucher counts' })).toBeInTheDocument();
  });

  it('keeps the detail header and portal cards with printable actions', async () => {
    server.use(http.get(`${API}/vouchers/7/`, () => HttpResponse.json(voucher(7))));
    const { container } = renderPage(<VoucherDetailPage />, {
      role: 'owner',
      path: '/vouchers/:id',
      route: '/vouchers/7',
    });
    await screen.findByRole('heading', { name: /WH10007/ });
    expect(container.querySelector('.rv-portal .rv-portal-header')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('keeps the simple generation form inside portal cards', async () => {
    const { container } = renderPage(<GenerateVouchersPage />, {
      role: 'manager',
      path: '/vouchers/generate',
    });
    expect(await screen.findByRole('combobox', { name: 'Plan' })).toHaveValue('');
    expect(container.querySelector('.rv-portal')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Generate Vouchers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate 20 vouchers/ })).toBeInTheDocument();
    expect(screen.queryByText('Quantity presets')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Username prefix')).not.toBeInTheDocument();
  });
});

describe('Voucher inventory structure', () => {
  it('opens a manual-code dialog and sends one normalized code without a separate password', async () => {
    let received: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API}/vouchers/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/vouchers/manual-code/`, async ({ request }) => {
        received = await request.json() as Record<string, unknown>;
        return HttpResponse.json(voucher(1, { username: 'MYCODE88' }), { status: 201 });
      }),
    );
    renderPage(<VouchersPage />, { role: 'manager', path: '/vouchers' });
    await userEvent.click(screen.getByRole('button', { name: 'Manual Voucher' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Access code' }), 'mycode88');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Hotspot plan' }), '1');
    expect(within(dialog).getByText(/Face value:/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create voucher' }));
    await waitFor(() => expect(received).toMatchObject({ code: 'MYCODE88', plan_id: 1, device_limit: 1 }));
    expect(received).not.toHaveProperty('password');
  });

  it('sequences a filters panel before a records card with a persistent selection bar', async () => {
    server.use(http.get(`${API}/vouchers/`, () => HttpResponse.json(paginated([voucher(1)]))));
    renderPage(<VouchersPage />, { role: 'manager', path: '/vouchers' });
    const table = await screen.findByRole('table', { name: 'Vouchers' });
    await within(table).findByText('WH10001');
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    const filters = screen.getByRole('region', { name: 'Filters' });
    const counts = screen.getByRole('region', { name: 'Workspace-wide voucher counts' });
    expect(filters.compareDocumentPosition(counts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filters.querySelector('details')).toBeNull();
    expect(within(filters).getByLabelText('Search vouchers')).toBeVisible();
    expect(screen.queryByText('Search and refine vouchers')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Voucher records' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search vouchers')).toBeInTheDocument();
    expect(within(filters).getByLabelText('Created from')).toBeVisible();
    expect(within(filters).getByLabelText('Created to')).toBeVisible();
    expect(within(filters).queryByLabelText('Plan')).not.toBeInTheDocument();
    expect(within(filters).queryByLabelText('Connection')).not.toBeInTheDocument();
    expect(filters.querySelector('.rv-voucher-filter-row')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByText('0 selected across pages')).toBeInTheDocument();
  });

  it('filters by search and creation dates, then clears those filters and the status tab', async () => {
    const seen: URL[] = [];
    server.use(http.get(`${API}/vouchers/`, ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json(paginated([voucher(1)]));
    }));
    renderPage(<VouchersPage />, { role: 'manager', path: '/vouchers' });
    await screen.findByRole('table', { name: 'Vouchers' });
    await userEvent.type(screen.getByLabelText('Search vouchers'), 'WH10001');
    fireEvent.change(screen.getByLabelText('Created from'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Created to'), { target: { value: '2026-09-30' } });
    await userEvent.click(screen.getByRole('tab', { name: 'Sold' }));
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('search')).toBe('WH10001'));
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('created_from_day')).toBe('2026-09-01'));
    expect(seen.at(-1)?.searchParams.get('created_to_day')).toBe('2026-09-30');
    expect(seen.at(-1)?.searchParams.get('status')).toBe('sold');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('search')).toBeNull());
    expect(seen.at(-1)?.searchParams.get('created_from_day')).toBeNull();
    expect(seen.at(-1)?.searchParams.get('created_to_day')).toBeNull();
    expect(seen.at(-1)?.searchParams.get('status')).toBeNull();
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });

  it('removes old plan and online URL filters without applying them', async () => {
    const seen: URL[] = [];
    server.use(http.get(`${API}/vouchers/`, ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json(paginated([voucher(1)]));
    }));
    renderPage(<><LocationProbe /><VouchersPage /></>, {
      role: 'manager', path: '/vouchers',
      route: '/vouchers?plan=1&online=true&status=sold&created_from_day=2026-09-01',
    });
    await screen.findByRole('table', { name: 'Vouchers' });
    await waitFor(() => expect(screen.getByTestId('voucher-location')).not.toHaveTextContent('plan='));
    expect(screen.getByTestId('voucher-location')).not.toHaveTextContent('online=');
    expect(screen.getByTestId('voucher-location')).toHaveTextContent('status=sold');
    expect(screen.getByTestId('voucher-location')).toHaveTextContent('created_from_day=2026-09-01');
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((url) => !url.searchParams.has('plan') && !url.searchParams.has('online'))).toBe(true);
  });

  it('keeps selection across pagination', async () => {
    const user = userEvent.setup({ delay: null });
    const pagePayload = (page: number) => ({
      count: 3,
      total_pages: 2,
      current_page: page,
      results: page === 1 ? [voucher(1), voucher(2)] : [voucher(3)],
    });
    server.use(
      http.get(`${API}/vouchers/`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
        return HttpResponse.json(pagePayload(page));
      }),
    );
    renderPage(<VouchersPage />, { role: 'manager', path: '/vouchers' });
    const table = await screen.findByRole('table', { name: 'Vouchers' });
    await within(table).findByText('WH10002');
    // The select column comes first in DOM order; the username cell carries a
    // second mobile-only checkbox with the same label that CSS hides on desktop.
    const rowBox = () =>
      within(table).getAllByRole('checkbox', { name: 'Select WH10001' })[0]!;
    await user.click(rowBox());
    expect(screen.getByText('1 selected across pages')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await within(table).findByText('WH10003');
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await within(table).findByText('WH10002');
    expect(rowBox()).toBeChecked();
  });

  it('gives generation-only staff a generate action without print selection', async () => {
    server.use(http.get(`${API}/vouchers/`, () => HttpResponse.json(paginated([voucher(1)]))));
    const principal = derivePrincipal(
      makeUser('platform_staff'),
      [makeAssignment(5, ['vouchers.generate'])],
      5,
    );
    renderPage(<VouchersPage />, { path: '/vouchers', principal });
    await screen.findByRole('table', { name: 'Vouchers' });
    expect(screen.getByRole('button', { name: 'Generate Voucher' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Select all vouchers on this page')).not.toBeInTheDocument();
  });
});

describe('GenerateVouchersPage permissions and retries', () => {
  it('lets generation-only staff generate without print actions', async () => {
    server.use(
      http.post(`${API}/vouchers/generate/`, () =>
        HttpResponse.json([voucher(11)], { status: 201 }),
      ),
    );
    const principal = derivePrincipal(
      makeUser('platform_staff'),
      [makeAssignment(5, ['vouchers.generate'])],
      5,
    );
    renderPage(<GenerateVouchersPage />, {
      path: '/vouchers/generate',
      route: '/vouchers/generate?plan=1',
      principal,
    });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveValue('Daily 1GB'));
    await userEvent.click(screen.getByRole('button', { name: /Generate 20 vouchers/ }));
    expect(await screen.findByRole('heading', { name: '1 voucher ready' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print all' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View in list' })).toBeInTheDocument();
  });

  it('shows a service error and retries the same batch successfully', async () => {
    const user = userEvent.setup({ delay: null });
    let calls = 0;
    server.use(
      http.post(`${API}/vouchers/generate/`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ detail: 'Generator unavailable' }, { status: 503 })
          : HttpResponse.json([voucher(11)], { status: 201 });
      }),
    );
    renderPage(<GenerateVouchersPage />, {
      role: 'manager',
      path: '/vouchers/generate',
      route: '/vouchers/generate?plan=1',
    });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveValue('Daily 1GB'));
    await user.click(screen.getByRole('button', { name: /Generate 20 vouchers/ }));
    expect(await screen.findByText('Generator unavailable')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveValue('Daily 1GB');
    await user.click(screen.getByRole('button', { name: /Generate 20 vouchers/ }));
    expect(await screen.findByRole('heading', { name: '1 voucher ready' })).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});

describe('VoucherDetailPage actions', () => {
  it('prints credentials through the authorized print flow', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      http.get(`${API}/vouchers/7/`, () => HttpResponse.json(voucher(7))),
      http.get(`${API}/vouchers/:id/print/`, () => HttpResponse.text(printPage(voucher(7)))),
    );
    renderPage(<VoucherDetailPage />, {
      role: 'owner',
      path: '/vouchers/:id',
      route: '/vouchers/7',
    });
    await screen.findByRole('heading', { name: /WH10007/ });
    await user.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(printed).toHaveLength(1));
    expect(printed[0]).toContain('pw-7');
    expect(printed[0]).toContain('Wuse Hotspot');
  });

  it('deletes an unused voucher after typing its name to confirm', async () => {
    const user = userEvent.setup({ delay: null });
    let deleted = false;
    server.use(
      http.get(`${API}/vouchers/7/`, () => HttpResponse.json(voucher(7))),
      http.delete(`${API}/vouchers/7/`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage(<VoucherDetailPage />, {
      role: 'owner',
      path: '/vouchers/:id',
      route: '/vouchers/7',
      extraRoutes: <Route path="/vouchers" element={<div>voucher list</div>} />,
    });
    await screen.findByRole('heading', { name: /WH10007/ });
    await user.click(screen.getByRole('button', { name: 'Delete voucher' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete WH10007?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete voucher' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Type WH10007 to continue/), 'WH10007');
    await user.click(within(dialog).getByRole('button', { name: 'Delete voucher' }));
    expect(await screen.findByText('voucher list')).toBeInTheDocument();
    expect(deleted).toBe(true);
  });
});

describe('Voucher inventory columns', () => {
  it('keeps the current inventory columns and selection inside Voucher', async () => {
    server.use(
      http.get(`${API}/vouchers/`, () =>
        HttpResponse.json(
          paginated([
            voucher(1, { device_limit: 1 }),
            voucher(2, { username: 'WH10002', device_limit: 3 }),
          ]),
        ),
      ),
    );
    renderPage(<VouchersPage />, { role: 'manager', path: '/vouchers' });
    const table = await screen.findByRole('table', { name: 'Vouchers' });
    await within(table).findByText('WH10001');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()))
      .toEqual(['Voucher', 'Plan', 'Price', 'Status', 'devices', 'Expires', 'Created', 'Actions']);
    expect(within(table).getByLabelText('Select all vouchers on this page')).toBeInTheDocument();
    expect(within(table).getAllByRole('checkbox', { name: 'Select WH10001' })).toHaveLength(1);
    expect(within(table).getByText('1 device')).toBeInTheDocument();
    expect(within(table).getByText('3 devices')).toBeInTheDocument();
  });
});

describe('Voucher detail usage', () => {
  it('shows details removed from the inventory with unknown telemetry kept distinct from offline', async () => {
    server.use(http.get(`${API}/vouchers/7/`, () => HttpResponse.json(voucher(7, {
      device_limit: 3,
      first_used_at: '2026-09-05T10:00:00Z',
      last_used_at: '2026-09-06T10:00:00Z',
      connection_status: 'unknown',
      last_session_at: '2026-09-06T10:00:00Z',
      device_mac: 'AA:BB:CC:DD:EE:FF',
      nas_ip: '10.101.100.9',
      bytes_in: 1024,
      bytes_out: 2048,
    }))));
    renderPage(<VoucherDetailPage />, { role: 'manager', path: '/vouchers/:id', route: '/vouchers/7' });
    expect(await screen.findByRole('heading', { name: 'Connection and usage' })).toBeInTheDocument();
    expect(screen.getByText('3 devices')).toBeInTheDocument();
    expect(screen.getByText('AA:BB:CC:DD:EE:FF')).toBeInTheDocument();
    expect(screen.getByText('10.101.100.9')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
  });
});

beforeEach(() => {
  server.use(http.get(`${API}/dashboard/stats/`, () => HttpResponse.json({}, { status: 503 })));
});
