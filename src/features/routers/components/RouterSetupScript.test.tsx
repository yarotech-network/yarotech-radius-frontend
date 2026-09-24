import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderPage } from '@/test/renderPage';
import type { NasDevice } from '@/types/api';
import { RouterSetupScript } from './RouterSetupScript';

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

const registration = {
  nas_identifier: 'branch',
  hotspot_interface: 'bridge-lan',
  hotspot_profile: 'yaro-profile',
  notes: '',
  setup: {},
  status: 'ready' as const,
  error_code: '',
  script_sha256: 'digest',
};

describe('Router setup script', () => {
  it('loads credentials only after explicit reveal and offers the import command', async () => {
    let requests = 0;
    const device = { ...router(), registration };
    server.use(
      http.get(`*/api/v1/routers/${device.id}/setup-script/`, () => {
        requests += 1;
        return HttpResponse.json({
          filename: 'router.rsc',
          script: ':put "test"',
          sha256: 'digest',
          import_command: '/import file-name="router.rsc"',
        });
      }),
    );
    renderPage(<RouterSetupScript router={device} refresh={vi.fn()} />, { role: 'owner' });
    expect(requests).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'View setup script' }));
    expect(await screen.findByRole('textbox', { name: 'Router setup script' })).toHaveValue(
      ':put "test"',
    );
    expect(screen.getByText('/import file-name="router.rsc"')).toBeInTheDocument();
    expect(requests).toBe(1);
  });

  it('allows a ready router setup script to be regenerated', async () => {
    const refresh = vi.fn();
    const device = { ...router(), registration };
    let retries = 0;

    server.use(
      http.post(`*/api/v1/routers/${device.id}/setup-script/retry/`, () => {
        retries += 1;
        return HttpResponse.json({
          ...registration,
          script_sha256: 'new-digest',
        });
      }),
    );

    renderPage(<RouterSetupScript router={device} refresh={refresh} />, { role: 'owner' });

    await userEvent.click(screen.getByRole('button', { name: 'Regenerate setup script' }));

    expect(retries).toBe(1);
    expect(refresh).toHaveBeenCalled();
  });

  it('offers retry but no script when infrastructure is disabled', () => {
    const device = {
      ...router(),
      registration: {
        ...registration,
        status: 'needs_attention' as const,
        error_code: 'server_provisioning_disabled',
      },
    };
    renderPage(<RouterSetupScript router={device} refresh={vi.fn()} />, { role: 'owner' });
    expect(screen.getByRole('button', { name: 'Retry preparation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View setup script' })).not.toBeInTheDocument();
    expect(screen.getByText(/Automatic server preparation is not enabled/)).toBeInTheDocument();
  });
});
