import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type { NasDevice, RouterOperation } from '@/types/api';
import RouterOperationsPage from './RouterOperationsPage';
import RoutersPage from './RoutersPage';
import RouterDetailPage from './RouterDetailPage';
import NewRouterPage from './NewRouterPage';

const router = (extra: Partial<NasDevice> = {}): NasDevice => ({
  id: 'd856aee7-5ca8-471f-ad58-9250e94f8e44',
  name: 'mikrotik-wuse-01',
  ip_address: '10.100.100.12',
  wireguard_ip: null,
  wireguard_public_key: '',
  wireguard_port: 51820,
  routeros_username: '',
  location: 'Wuse 2',
  tenant: 5,
  tenant_name: 'Wuse Hotspot',
  onboarding_state: 'waiting_for_vpn',
  deployment_status: 'not_deployed',
  is_active: true,
  last_seen_at: null,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-02T10:00:00Z',
  ...extra,
});
const emptyDetailEndpoints = (r: NasDevice) => [
  http.get(`${API}/routers/:id/`, () => HttpResponse.json(r)),
  http.get(`${API}/routers/:id/checks/`, () => HttpResponse.json([])),
  http.get(`${API}/routers/:id/health/`, () =>
    HttpResponse.json({
      router: r.id,
      is_active: true,
      onboarding_state: r.onboarding_state,
      deployment_status: r.deployment_status,
      last_seen_at: null,
      observed_at: '2026-09-02T10:00:00Z',
      checks: [],
      online: null,
      telemetry_available: false,
    }),
  ),
  http.get(`${API}/routers/:id/audit/`, () => HttpResponse.json(paginated([]))),
  http.get(`${API}/router-operations/`, () => HttpResponse.json(paginated([]))),
];

describe('RoutersPage', () => {
  it('opens the in-page setup guide and limits creation to managers', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/routers/`, () => HttpResponse.json(paginated([]))),
      http.get(`${API}/subscriptions/`, () => HttpResponse.json(paginated([]))),
    );
    renderPage(<RoutersPage />, { path: '/routers', role: 'staff' });

    const toggle = screen.getByRole('button', { name: 'Setup guide' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('heading', { name: 'Set up a MikroTik HotSpot router' }),
    ).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('heading', { name: 'Set up a MikroTik HotSpot router' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Add the router' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Paste one command' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '3. Log in with a test voucher' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ask an owner or router manager/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add router' })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('heading', { name: 'Set up a MikroTik HotSpot router' }),
    ).not.toBeInTheDocument();
  });

  it('links managers from the guide to the router registration form', async () => {
    server.use(
      http.get(`${API}/routers/`, () => HttpResponse.json(paginated([]))),
      http.get(`${API}/subscriptions/`, () => HttpResponse.json(paginated([]))),
    );
    renderPage(<RoutersPage />, { path: '/routers', role: 'manager' });
    await userEvent.click(screen.getByRole('button', { name: 'Setup guide' }));

    const guide = screen.getByRole('region', { name: 'Set up a MikroTik HotSpot router' });
    expect(within(guide).getByRole('link', { name: 'Add router' })).toHaveAttribute(
      'href',
      '/routers/new',
    );
    expect(screen.queryByRole('link', { name: 'Setup guide' })).not.toBeInTheDocument();
  });

  it('lists routers with state badges and forwards filters to the API', async () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${API}/routers/`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json(
          paginated([
            router(),
            router({
              id: 'r2',
              name: 'mikrotik-wuse-02',
              onboarding_state: 'active',
              deployment_status: 'deployed',
            }),
          ]),
        );
      }),
    );
    renderPage(<RoutersPage />, { path: '/routers' });
    const table = await screen.findByRole('table', { name: 'Routers' });
    expect(await within(table).findByText('mikrotik-wuse-01')).toBeInTheDocument();
    expect(within(table).getByText('mikrotik-wuse-02')).toBeInTheDocument();
    expect(within(table).getByText('Waiting for VPN')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Onboarding state'), 'active');
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('onboarding_state')).toBe('active'));
    expect(seen[0]?.searchParams.get('ordering')).toBe('name');
  });

  it('links to the actual router and retains observations when refresh fails', async () => {
    const user = userEvent.setup();
    const device = router();
    server.use(
      http.get(`${API}/subscriptions/`, () => HttpResponse.json(paginated([]))),
      http.get(`${API}/routers/`, () => HttpResponse.json(paginated([device]))),
    );
    renderPage(<RoutersPage />, { path: '/routers', role: 'manager' });
    const table = await screen.findByRole('table', { name: 'Routers' });
    expect(await within(table).findByRole('link', { name: device.name })).toHaveAttribute(
      'href',
      `/routers/${device.id}`,
    );
    expect(within(table).getByText('No observation recorded')).toBeInTheDocument();
    server.use(
      http.get(`${API}/routers/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh routers' }));
    expect(await screen.findByText('Routers could not be refreshed')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: `Open ${device.name}` })).toHaveAttribute(
      'href',
      `/routers/${device.id}`,
    );
  });

  it('hides management actions from staff', async () => {
    server.use(http.get(`${API}/routers/`, () => HttpResponse.json(paginated([router()]))));
    renderPage(<RoutersPage />, { path: '/routers', role: 'staff' });
    await screen.findByRole('table', { name: 'Routers' });
    expect(screen.queryByRole('link', { name: /add router/i })).not.toBeInTheDocument();
  });
});

describe('RouterDetailPage', () => {
  it('retains the device and reports an unknown health state after refresh failure', async () => {
    const user = userEvent.setup();
    const device = router();
    server.use(...emptyDetailEndpoints(device));
    renderPage(<RouterDetailPage />, {
      role: 'owner',
      path: '/routers/:id',
      route: `/routers/${device.id}`,
    });
    await screen.findByText(/Telemetry unavailable/);
    expect(await screen.findByText('Monitor checked')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Refresh router' })).toBeEnabled(),
    );
    server.use(
      http.get(`${API}/routers/:id/health/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh router' }));
    expect(
      await screen.findByText('Health information could not be refreshed'),
    ).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /mikrotik-wuse-01/ })).toBeInTheDocument();
  });

  it('shows only the transitions the state machine allows and applies one', async () => {
    let current = router();
    const posted: unknown[] = [];
    server.use(
      // Overrides must precede the defaults: MSW uses the first matching handler.
      http.get(`${API}/routers/:id/`, () => HttpResponse.json(current)),
      http.post(`${API}/routers/:id/transition/`, async ({ request }) => {
        const body = (await request.json()) as { to_state: NasDevice['onboarding_state'] };
        posted.push(body);
        current = router({ onboarding_state: body.to_state });
        return HttpResponse.json({ correlation_id: 'c1' });
      }),
      ...emptyDetailEndpoints(current),
    );
    renderPage(<RouterDetailPage />, { path: '/routers/:id', route: `/routers/${current.id}` });
    await screen.findByRole('heading', { name: /mikrotik-wuse-01/ });
    expect(await screen.findByText(/Telemetry unavailable/)).toBeInTheDocument();
    // waiting_for_vpn → [vpn_failed, testing_radius]
    expect(screen.getByRole('button', { name: /Mark as Testing RADIUS/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record VPN failed/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark as Active/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Mark as Testing RADIUS/ }));
    await waitFor(() => expect(posted).toEqual([{ to_state: 'testing_radius' }]));
    await screen.findByRole('button', { name: /Mark as Active/ });
  });

  it('surfaces a 409 from provisioning as a busy notice and shows the operation list', async () => {
    const r = router({ wireguard_ip: '10.100.100.12', wireguard_public_key: 'a'.repeat(43) + '=' });
    const op: RouterOperation = {
      id: 'op-1',
      router: r.id,
      action: 'provision',
      status: 'failed',
      attempts: 3,
      error_code: 'ssh_unreachable',
      created_at: '2026-09-02T10:00:00Z',
      completed_at: '2026-09-02T10:05:00Z',
    };
    server.use(
      http.get(`${API}/router-operations/`, () => HttpResponse.json(paginated([op]))),
      http.post(`${API}/routers/:id/provisioning/`, () =>
        HttpResponse.json({ error: 'A router operation is already pending.' }, { status: 409 }),
      ),
      ...emptyDetailEndpoints(r),
    );
    renderPage(<RouterDetailPage />, { path: '/routers/:id', route: `/routers/${r.id}?tab=vpn` });
    expect(await screen.findByText('ssh_unreachable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Provision' }));
    expect(await screen.findByText(/already pending/)).toBeInTheDocument();
  });

  it('prompts to reload when secrets replacement hits a stale version (409)', async () => {
    const r = router();
    server.use(
      http.post(`${API}/routers/:id/replace-secrets/`, () =>
        HttpResponse.json(
          { error: 'Router changed; reload before replacing secrets.' },
          { status: 409 },
        ),
      ),
      ...emptyDetailEndpoints(r),
    );
    renderPage(<RouterDetailPage />, {
      path: '/routers/:id',
      route: `/routers/${r.id}?tab=secrets`,
    });
    await userEvent.click(await screen.findByRole('button', { name: /Replace secrets/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace secrets' });
    await userEvent.type(
      within(dialog).getByLabelText(/New RADIUS shared secret/),
      'brand-new-secret',
    );
    await userEvent.type(within(dialog).getByLabelText(/Your password/), 'Passw0rd!2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace secrets' }));
    expect(await within(dialog).findByText(/changed since you opened it/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Reload router' })).toBeInTheDocument();
  });

  it('shows the RADIUS test outcome and handles the service being down', async () => {
    const r = router();
    let calls = 0;
    server.use(
      http.post(`${API}/routers/:id/test/`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ passed: false })
          : HttpResponse.json(
              { error: 'RADIUS authentication service unavailable.' },
              { status: 503 },
            );
      }),
      ...emptyDetailEndpoints(r),
    );
    renderPage(<RouterDetailPage />, { path: '/routers/:id', route: `/routers/${r.id}?tab=test` });
    await userEvent.type(await screen.findByLabelText(/Username/), 'WH10001');
    await userEvent.type(screen.getByLabelText(/^Password/), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Run test' }));
    expect(await screen.findByText('Access rejected')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Password/), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Run test' }));
    expect(await screen.findByText('RADIUS service unavailable')).toBeInTheDocument();
  });
});

describe('Add router popup', () => {
  const fleetHandlers = () => [
    http.get(`${API}/routers/`, () => HttpResponse.json(paginated([]))),
    http.get(`${API}/subscriptions/`, () => HttpResponse.json(paginated([]))),
  ];

  it('opens from the hero and guide entry points and preserves filters', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(...fleetHandlers());
    renderPage(<RoutersPage />, {
      path: '/routers',
      route: '/routers?search=branch&onboarding_state=active',
      role: 'manager',
      extraRoutes: <Route path="/routers/new" element={<RoutersPage />} />,
    });
    await screen.findByText('No routers match');
    const heroLink = screen.getByRole('link', { name: 'Add router' });
    expect(heroLink.getAttribute('href')).toContain('/routers/new');
    expect(heroLink.getAttribute('href')).toContain('search=branch');
    expect(heroLink.getAttribute('href')).toContain('onboarding_state=active');

    await user.click(screen.getByRole('button', { name: 'Setup guide' }));
    const guide = screen.getByRole('region', { name: 'Set up a MikroTik HotSpot router' });
    expect(within(guide).getByRole('link', { name: 'Add router' }).getAttribute('href')).toContain(
      '/routers/new',
    );
    // Opening via the hero link shows the popup over the fleet.
    await user.click(heroLink);
    expect(await screen.findByRole('dialog', { name: 'Add router' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Router Fleet' })).toBeInTheDocument();
  });

  it('opens from the empty state entry point', async () => {
    server.use(...fleetHandlers());
    renderPage(<RoutersPage />, { path: '/routers', route: '/routers', role: 'manager' });
    expect(await screen.findByText('No routers yet')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Add router' });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('/routers/new');
    }
  });

  /** Step 1 → 2: name the router and its customer port. */
  async function fillRouter(
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    name = 'Branch router',
  ) {
    await user.type(within(dialog).getByLabelText(/Router name/), name);
    await user.type(within(dialog).getByLabelText(/Customer port/), 'bridge-lan');
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await within(dialog).findByText('Step 2 of 3: Network');
  }

  /** Step 2 → 3 with the suggested customer network, then confirm and create. */
  async function reviewAndCreate(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await within(dialog).findByText('Step 3 of 3: Review');
    await user.click(within(dialog).getByLabelText(/are correct for this router/));
    await user.click(within(dialog).getByRole('button', { name: 'Create router' }));
  }

  it('displays the fleet with the popup open on a direct URL', async () => {
    server.use(...fleetHandlers());
    renderPage(<NewRouterPage />, { path: '/routers/new', route: '/routers/new', role: 'owner' });
    expect(await screen.findByRole('heading', { name: 'Router Fleet' })).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    expect(
      within(dialog).getByText(/generates its VPN keys and RADIUS secret/),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3: Router')).toBeInTheDocument();
    // Technical fields are tucked away until asked for.
    expect(within(dialog).getByText('More router details (optional)')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/NAS identifier/)).not.toBeVisible();
  });

  it('focuses the first field on open and the first invalid field on Next', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(...fleetHandlers());
    renderPage(<NewRouterPage />, { path: '/routers/new', role: 'owner' });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await waitFor(() => expect(within(dialog).getByLabelText(/Router name/)).toHaveFocus());
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(await within(dialog).findByText(/Give the router a name/)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText(/Router name/)).toHaveFocus());
    expect(screen.getByText('Step 1 of 3: Router')).toBeInTheDocument();
  });

  it('preserves values across steps, suggests a network and previews customer addresses', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(...fleetHandlers());
    renderPage(<NewRouterPage />, { path: '/routers/new', role: 'owner' });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await fillRouter(user, dialog);
    const gateway = within(dialog).getByLabelText(/Customer network/);
    expect(gateway).toHaveValue('10.20.0.1/24');
    expect(within(dialog).getByText('10.20.0.2')).toBeInTheDocument();
    await user.clear(gateway);
    await user.type(gateway, '8.8.8.1/24');
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(await within(dialog).findByText(/Use a private network/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(within(dialog).getByLabelText(/Router name/)).toHaveValue('Branch router');
    expect(within(dialog).getByLabelText(/Customer port/)).toHaveValue('bridge-lan');
  });

  it('connects an existing HotSpot with only its profile name', async () => {
    const user = userEvent.setup({ delay: null });
    let received: Record<string, unknown> | undefined;
    server.use(
      ...fleetHandlers(),
      http.post(`${API}/routers/register/`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(router(), { status: 201 });
      }),
    );
    renderPage(<NewRouterPage />, {
      path: '/routers/new',
      role: 'owner',
      extraRoutes: <Route path="/routers/:id" element={<div>router detail setup</div>} />,
    });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await fillRouter(user, dialog, 'Existing router');
    await user.click(within(dialog).getByRole('radio', { name: /Connect an existing HotSpot/ }));
    expect(within(dialog).queryByLabelText(/Customer network/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(
      await within(dialog).findByText(/Enter the name of the HotSpot profile/),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Existing HotSpot profile/), 'hsprof1');
    await reviewAndCreate(user, dialog);
    await waitFor(() => expect(received).toBeDefined(), { timeout: 5000 });
    expect(received).toMatchObject({ complete_hotspot_setup: false, hotspot_profile: 'hsprof1' });
    expect(received).not.toHaveProperty('gateway_cidr');
  }, 15000);

  it('keeps DHCP reuse, custom range and NAT under advanced network settings', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(...fleetHandlers());
    renderPage(<NewRouterPage />, { path: '/routers/new', role: 'owner' });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await fillRouter(user, dialog);
    expect(within(dialog).getByLabelText(/DHCP setup/)).not.toBeVisible();
    await user.click(within(dialog).getByText('Advanced network settings'));
    await user.selectOptions(within(dialog).getByLabelText(/DHCP setup/), 'reuse');
    expect(await within(dialog).findByLabelText(/Existing address pool/)).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText(/Use my own DHCP address range/));
    expect(await within(dialog).findByLabelText(/^DHCP address range/)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText(/Internet sharing/), 'interface');
    expect(await within(dialog).findByLabelText(/Internet \(WAN\) interface/)).toBeInTheDocument();
  });

  it('registers through POST /routers/register/ without client-side secrets', async () => {
    const user = userEvent.setup({ delay: null });
    let received: Record<string, unknown> | undefined;
    let key: string | null = null;
    server.use(
      ...fleetHandlers(),
      http.post(`${API}/routers/register/`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json(router(), { status: 201 });
      }),
    );
    renderPage(<NewRouterPage />, {
      path: '/routers/new',
      role: 'owner',
      extraRoutes: <Route path="/routers/:id" element={<div>router detail setup</div>} />,
    });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    expect(within(dialog).queryByLabelText(/RADIUS secret/i)).not.toBeInTheDocument();
    await fillRouter(user, dialog);
    await reviewAndCreate(user, dialog);
    await waitFor(() => expect(received).toBeDefined(), { timeout: 5000 });
    expect(key).toMatch(/^[A-Za-z0-9_.:-]{16,128}$/);
    expect(received).toMatchObject({
      name: 'Branch router',
      hotspot_interface: 'bridge-lan',
      complete_hotspot_setup: true,
      network_reviewed: true,
      gateway_cidr: '10.20.0.1/24',
      dhcp_range_mode: 'automatic',
      nat_mode: 'existing',
    });
    expect(received).not.toHaveProperty('nas_secret');
    expect(received).not.toHaveProperty('wireguard_ip');
    expect(received).not.toHaveProperty('wireguard_public_key');
    expect(
      await screen.findByText('router detail setup', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  }, 15000);

  it('retains entered details when server preparation rejects the request', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      ...fleetHandlers(),
      http.post(`${API}/routers/register/`, () =>
        HttpResponse.json({ detail: 'Router capacity reached.' }, { status: 400 }),
      ),
    );
    renderPage(<NewRouterPage />, { path: '/routers/new', role: 'owner' });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await fillRouter(user, dialog, 'Keep my details');
    await reviewAndCreate(user, dialog);
    expect(
      await within(dialog).findByText('Router capacity reached.', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(within(dialog).getByLabelText(/Router name/)).toHaveValue('Keep my details');
  }, 15000);

  it('maps API field errors onto inputs and returns to their step', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      ...fleetHandlers(),
      http.post(`${API}/routers/register/`, () =>
        HttpResponse.json({ name: ['A router with this name already exists.'] }, { status: 400 }),
      ),
    );
    renderPage(<NewRouterPage />, { path: '/routers/new', role: 'owner' });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await fillRouter(user, dialog);
    await reviewAndCreate(user, dialog);
    expect(await screen.findByText('A router with this name already exists.')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3: Router')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Router name/)).toHaveValue('Branch router');
  }, 15000);

  it('guards duplicate submissions with a single idempotency key', async () => {
    const user = userEvent.setup({ delay: null });
    const keys: (string | null)[] = [];
    let calls = 0;
    server.use(
      ...fleetHandlers(),
      http.post(`${API}/routers/register/`, async ({ request }) => {
        calls += 1;
        keys.push(request.headers.get('Idempotency-Key'));
        await new Promise((resolve) => window.setTimeout(resolve, 80));
        return HttpResponse.json(router(), { status: 201 });
      }),
    );
    renderPage(<NewRouterPage />, {
      path: '/routers/new',
      role: 'owner',
      extraRoutes: <Route path="/routers/:id" element={<div>router detail setup</div>} />,
    });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await fillRouter(user, dialog);
    await reviewAndCreate(user, dialog);
    // Second click lands while the first submission is in flight and must be ignored.
    await user
      .click(within(dialog).getByRole('button', { name: /Create router/ }))
      .catch(() => undefined);
    expect(
      await screen.findByText('router detail setup', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls).toBe(1), { timeout: 5000 });
    expect(keys[0]).toMatch(/^[A-Za-z0-9_.:-]{16,128}$/);
  }, 20000);

  it('closes cleanly without edits', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(...fleetHandlers());
    renderPage(<RoutersPage />, {
      path: '/routers/new',
      route: '/routers/new',
      role: 'manager',
      extraRoutes: <Route path="/routers" element={<div>fleet without popup</div>} />,
    });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('fleet without popup')).toBeInTheDocument();
  });

  it('confirms before discarding an edited draft', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(...fleetHandlers());
    renderPage(<RoutersPage />, {
      path: '/routers/new',
      route: '/routers/new',
      role: 'manager',
      extraRoutes: <Route path="/routers" element={<div>fleet without popup</div>} />,
    });
    const edited = await screen.findByRole('dialog', { name: 'Add router' });
    await user.type(within(edited).getByLabelText(/Router name/), 'Draft router');
    await user.click(within(edited).getByRole('button', { name: 'Cancel' }));
    const confirm = await screen.findByRole('dialog', { name: 'Discard new router?' });
    await user.click(within(confirm).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('dialog', { name: 'Add router' })).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('dialog', { name: 'Add router' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    const confirmAgain = await screen.findByRole('dialog', { name: 'Discard new router?' });
    await user.click(within(confirmAgain).getByRole('button', { name: 'Discard' }));
    expect(await screen.findByText('fleet without popup')).toBeInTheDocument();
  });

  it('keeps router creation manager-only on the fleet', async () => {
    server.use(...fleetHandlers());
    renderPage(<RoutersPage />, { path: '/routers', role: 'staff' });
    await screen.findByRole('heading', { name: 'Router Fleet' });
    expect(screen.queryByRole('link', { name: 'Add router' })).not.toBeInTheDocument();
  });

  it('does not open the popup for staff on a direct URL', async () => {
    server.use(...fleetHandlers());
    renderPage(<RoutersPage />, { path: '/routers/new', route: '/routers/new', role: 'staff' });
    await screen.findByRole('heading', { name: 'Router Fleet' });
    expect(screen.queryByRole('dialog', { name: 'Add router' })).not.toBeInTheDocument();
  });

  it('navigates to the Setup tab on success for preparation recovery', async () => {
    const user = userEvent.setup({ delay: null });
    const saved = router();
    server.use(
      ...fleetHandlers(),
      http.post(`${API}/routers/register/`, async () => HttpResponse.json(saved, { status: 201 })),
    );
    renderPage(<NewRouterPage />, {
      path: '/routers/new',
      role: 'owner',
      extraRoutes: (
        <>
          <Route path="/routers/:id" element={<div>setup tab for {saved.id}</div>} />
        </>
      ),
    });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await user.type(within(dialog).getByLabelText(/Router name/), 'Branch router');
    await user.type(within(dialog).getByLabelText(/Customer port/), 'bridge-lan');
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await reviewAndCreate(user, dialog);
    expect(
      await screen.findByText(`setup tab for ${saved.id}`, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  }, 15000);

  it('uses keyboard operation: Enter advances steps', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(...fleetHandlers());
    renderPage(<NewRouterPage />, { path: '/routers/new', role: 'owner' });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    await user.type(within(dialog).getByLabelText(/Router name/), 'Branch router');
    await user.type(within(dialog).getByLabelText(/Customer port/), 'bridge-lan');
    await user.keyboard('{Enter}');
    expect(await within(dialog).findByText('Step 2 of 3: Network')).toBeInTheDocument();
  });
});

describe('Router portal styling', () => {
  const fleetHandlers = () => [
    http.get(`${API}/routers/`, () => HttpResponse.json(paginated([]))),
    http.get(`${API}/subscriptions/`, () => HttpResponse.json(paginated([]))),
  ];

  it('renders the fleet inside the scoped portal wrapper with a compact header', async () => {
    server.use(...fleetHandlers());
    const { container } = renderPage(<RoutersPage />, { path: '/routers', role: 'manager' });
    await screen.findByRole('heading', { name: 'Router Fleet' });
    expect(container.querySelector('.rv-portal')).not.toBeNull();
    expect(container.querySelector('.rv-portal-header')).not.toBeNull();
    expect(container.querySelector('.router-page-hero')).toBeNull();
    expect(screen.getByRole('button', { name: 'Refresh routers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add router' })).toBeInTheDocument();
  });

  it('keeps the detail tabs inside portal cards', async () => {
    const device = router();
    server.use(...emptyDetailEndpoints(device));
    renderPage(<RouterDetailPage />, {
      role: 'owner',
      path: '/routers/:id',
      route: `/routers/${device.id}`,
    });
    await screen.findByRole('heading', { name: /mikrotik-wuse-01/ });
    const tablist = await screen.findByRole('tablist', { name: 'Router sections' });
    expect(within(tablist).getByRole('tab', { name: 'Onboarding' })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: 'VPN & provisioning' })).toBeInTheDocument();
    expect(document.querySelector('.rv-portal .rv-portal-header')).not.toBeNull();
  });

  it('aligns the Add Router popup with the portal card style without changing its workflow', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(...fleetHandlers());
    renderPage(<NewRouterPage />, { path: '/routers/new', role: 'owner' });
    const dialog = await screen.findByRole('dialog', { name: 'Add router' });
    expect(dialog.querySelector('.rv-add-dialog, .rv-add-review') ?? dialog).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Router name/), 'Branch router');
    await user.type(within(dialog).getByLabelText(/Customer port/), 'bridge-lan');
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(await within(dialog).findByText('Step 2 of 3: Network')).toBeInTheDocument();
  });
});

describe('RouterOperationsPage', () => {
  it('filters operation history, links to the router and preserves failed records on refresh error', async () => {
    const user = userEvent.setup();
    const device = router();
    const seen: URL[] = [];
    const op: RouterOperation = {
      id: 'op-history',
      router: device.id,
      action: 'provision',
      status: 'failed',
      attempts: 2,
      error_code: 'ssh_unreachable',
      created_at: '2026-09-01T10:00:00Z',
      completed_at: '2026-09-01T10:01:00Z',
    };
    server.use(
      http.get(`${API}/routers/`, () => HttpResponse.json(paginated([device]))),
      http.get(`${API}/router-operations/`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json(paginated([op]));
      }),
    );
    renderPage(<RouterOperationsPage />, { path: '/routers/operations', role: 'manager' });
    expect(await screen.findByRole('link', { name: device.name })).toHaveAttribute(
      'href',
      `/routers/${device.id}?tab=vpn`,
    );
    expect(screen.getByText('ssh_unreachable')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Status'), 'failed');
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('status')).toBe('failed'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Refresh operations' })).toBeEnabled(),
    );
    server.use(
      http.get(`${API}/router-operations/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh operations' }));
    expect(await screen.findByText('Operations could not be refreshed')).toBeInTheDocument();
    expect(screen.getByText('ssh_unreachable')).toBeInTheDocument();
  });
});

beforeEach(() => {
  server.use(http.get(`${API}/dashboard/network/`, () => HttpResponse.json({}, { status: 503 })));
});
