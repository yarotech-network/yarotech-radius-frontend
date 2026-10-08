import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type { NasDevice } from '@/types/api';
import { RouterSetup } from './RouterSetup';

const ID = 'd856aee7-5ca8-471f-ad58-9250e94f8e44';
const SCRIPT = ':put "private router credentials"';

function router(
  registration: Partial<NonNullable<NasDevice['registration']>> = {},
  extra: Partial<NasDevice> = {},
): NasDevice {
  return {
    id: ID,
    name: 'mikrotik-wuse-01',
    ip_address: '10.100.100.12',
    wireguard_ip: '10.100.100.12',
    wireguard_public_key: '',
    wireguard_port: 51820,
    routeros_username: '',
    location: 'Wuse 2',
    tenant: 5,
    tenant_name: 'Wuse Hotspot',
    onboarding_state: 'waiting_for_vpn',
    deployment_status: 'deployed',
    is_active: true,
    last_seen_at: null,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-02T10:00:00Z',
    registration: {
      nas_identifier: 'branch',
      hotspot_interface: 'bridge-lan',
      hotspot_profile: 'yaro-profile',
      notes: '',
      setup: {},
      status: 'ready',
      error_code: '',
      script_sha256: 'digest',
      ...registration,
    },
    ...extra,
  } as NasDevice;
}

function checks(passed: string[] = []) {
  return http.get(`${API}/routers/${ID}/checks/`, () =>
    HttpResponse.json(
      passed.map((type) => ({
        check_type: type,
        passed: true,
        checked_at: '2026-09-02T10:00:00Z',
        details: {},
      })),
    ),
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Router setup', () => {
  it('issues a one-time install command without ever showing the script', async () => {
    let scriptReads = 0;
    server.use(
      checks(),
      http.get(`${API}/routers/${ID}/setup-script/`, () => {
        scriptReads += 1;
        return HttpResponse.json({ filename: 'x.rsc', script: SCRIPT });
      }),
      http.post(`${API}/routers/${ID}/install-command/`, () =>
        HttpResponse.json({
          command:
            '/tool fetch url="https://x.ng/api/v1/router-install/" http-header-field="Authorization: Bearer yrt_abc" dst-path="yarotech.rsc"',
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        }),
      ),
    );
    renderPage(<RouterSetup router={router()} refresh={vi.fn()} />, { role: 'owner' });
    await userEvent.click(screen.getByRole('button', { name: 'Get install command' }));
    expect(await screen.findByLabelText('Install command')).toHaveTextContent('/tool fetch');
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeInTheDocument();
    expect(screen.getByText(/Works once · expires/)).toBeInTheDocument();
    expect(scriptReads).toBe(0);
    expect(screen.queryByText(/private router credentials/)).not.toBeInTheDocument();
  });

  it('falls back to the setup file when one-command install is not configured', async () => {
    const createObjectURL = vi.fn(() => 'blob:setup');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    server.use(
      checks(),
      http.post(`${API}/routers/${ID}/install-command/`, () =>
        HttpResponse.json(
          { detail: 'Not configured', code: 'install_url_not_configured' },
          { status: 409 },
        ),
      ),
      http.get(`${API}/routers/${ID}/setup-script/`, () =>
        HttpResponse.json({ filename: 'yarotech.rsc', script: SCRIPT }),
      ),
    );
    renderPage(<RouterSetup router={router()} refresh={vi.fn()} />, { role: 'owner' });
    await userEvent.click(screen.getByRole('button', { name: 'Get install command' }));
    expect(
      await screen.findByText('One-command install isn’t enabled on this server'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download setup file' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(screen.queryByText(/private router credentials/)).not.toBeInTheDocument();
    expect(screen.getByText(`/import file-name="yarotech-${ID}.rsc"`)).toBeInTheDocument();
  });

  it('explains a preparation problem in plain words and retries', async () => {
    const refresh = vi.fn();
    let retried = false;
    server.use(
      checks(),
      http.post(`${API}/routers/${ID}/setup-script/retry/`, () => {
        retried = true;
        return HttpResponse.json({});
      }),
    );
    renderPage(
      <RouterSetup
        router={router({ status: 'needs_attention', error_code: 'server_provisioning_disabled' })}
        refresh={refresh}
      />,
      { role: 'owner' },
    );
    expect(screen.getByText(/Automatic server preparation is switched off/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get install command' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry preparation' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(retried).toBe(true);
  });

  it('shows progress while preparing', () => {
    server.use(checks());
    renderPage(<RouterSetup router={router({ status: 'preparing' })} refresh={vi.fn()} />, {
      role: 'owner',
    });
    expect(screen.getByText(/preparing the VPN for this router/)).toBeInTheDocument();
  });

  it('turns green when the VPN and a voucher login pass', async () => {
    server.use(checks(['wireguard_peer', 'radius_auth']));
    renderPage(<RouterSetup router={router()} refresh={vi.fn()} />, { role: 'owner' });
    expect(await screen.findByText('Router is live')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Setup checks' });
    expect(within(list).getAllByText('passed')).toHaveLength(2);
    expect(within(list).getAllByText('not yet')).toHaveLength(1);
  });

  it('lists troubleshooting help for every script error code', async () => {
    server.use(checks());
    renderPage(<RouterSetup router={router()} refresh={vi.fn()} />, { role: 'owner' });
    const help = screen.getByRole('region', { name: 'If the terminal shows an error' });
    await userEvent.click(
      within(help).getByText('The customer network clashes with existing settings'),
    );
    expect(within(help).getByText(/Choose an unused network/)).toBeVisible();
  });
});
