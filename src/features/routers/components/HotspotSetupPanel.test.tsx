import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type { NasDevice } from '@/types/api';
import { HotspotSetupPanel, type HotspotSetupResult } from './HotspotSetupPanel';

const router = { id: 'r1', name: 'Lab router', updated_at: '2026-09-08T10:00:00Z' } as NasDevice;
const config = {
  model: 'Lab model',
  routeros_version: '7.20.1',
  service: 'hotspot' as const,
  mode: 'fresh' as const,
  bridge: 'yr-hotspot',
  hotspot_name: 'yr-hotspot',
  profile_name: 'yr-profile',
  gateway: '10.40.0.1/24',
  radius_server: '10.8.0.1',
  inventory_confirmed: true,
  interfaces: [
    { name: 'ether1', kind: 'ethernet' as const, role: 'wan' as const, bridge: '' },
    { name: 'ether2', kind: 'ethernet' as const, role: 'management' as const, bridge: '' },
    { name: 'wifi1', kind: 'wireless' as const, role: 'client' as const, bridge: '' },
  ],
};
const empty: HotspotSetupResult = {
  version: 'hotspot-review-v1',
  execution_enabled: false,
  supported_targets: [],
  gate: 'Lab validation required',
  inventory_source: 'operator_confirmed',
  ready: false,
  intent: null,
  evidence: [{ check_type: 'radius_auth', passed: false, checked_at: null, fresh: false }],
};
const saved: HotspotSetupResult = {
  ...empty,
  intent: {
    id: 'intent1',
    version: empty.version,
    state: 'review',
    created_at: router.updated_at,
    expires_at: '2099-09-08T11:00:00Z',
    configuration: config,
    script_preview: ':error "REVIEW ONLY"\n# candidate changes',
  },
};
const endpoint = `${API}/routers/r1/hotspot-setup/`;

describe('Hotspot setup workspace', () => {
  it('discovers without overwriting the draft, then adopts protected interfaces explicitly', async () => {
    const observed = {
      ...empty,
      discovery: {
        id: 'snapshot1',
        state: 'current',
        observed_at: router.updated_at,
        source: 'routeros_https',
        version: 'routeros-rest-inventory-v1',
        model: 'Observed model',
        routeros_version: '7.20.1',
        reported_version: '7.20.1 (stable)',
        architecture: 'arm64',
        bridges: [],
        packages: [],
        hotspots: [],
        hotspot_allowed: true,
        unavailable_sections: [],
        interfaces: config.interfaces.map((port) => ({
          ...port,
          type: port.kind === 'wireless' ? 'wifi' : 'ether',
          disabled: false,
          protected_reasons:
            port.role === 'wan' ? ['wan'] : port.role === 'management' ? ['management'] : [],
        })),
      },
      compatibility: {
        status: 'unverified',
        reason: 'Executable generator not validated',
        reasons: ['Executable generator not validated'],
      },
    };
    let requestBody: unknown;
    server.use(
      http.get(endpoint, () => HttpResponse.json(empty)),
      http.post(endpoint + 'discover/', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(observed);
      }),
    );
    renderPage(
      <HotspotSetupPanel
        router={{ ...router, deployment_status: 'deployed', wireguard_ip: '10.8.0.20' }}
      />,
    );
    await userEvent.type(await screen.findByLabelText('Router model'), 'Unsaved model');
    await userEvent.click(screen.getByRole('button', { name: 'Discover router' }));
    expect(await screen.findByText('Observed model')).toBeInTheDocument();
    expect(screen.getByLabelText('Router model')).toHaveValue('Unsaved model');
    expect(requestBody).toEqual({ expected_updated_at: router.updated_at });
    await userEvent.click(screen.getByRole('button', { name: 'Use discovered interfaces' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use inventory' }));
    expect(screen.getByLabelText('Router model')).toHaveValue('Observed model');
    expect(screen.getByLabelText('Role for ether1')).toHaveValue('wan');
    expect(screen.getByLabelText('Role for ether2')).toHaveValue('management');
    expect(screen.getByLabelText('Role for wifi1')).toHaveValue('unused');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows discovery failure without deleting manual draft fields', async () => {
    server.use(
      http.get(endpoint, () => HttpResponse.json(empty)),
      http.post(endpoint + 'discover/', () =>
        HttpResponse.json({ detail: 'Router certificate verification failed.' }, { status: 503 }),
      ),
    );
    renderPage(
      <HotspotSetupPanel
        router={{ ...router, deployment_status: 'deployed', wireguard_ip: '10.8.0.20' }}
      />,
    );
    await userEvent.type(await screen.findByLabelText('Router model'), 'Keep this draft');
    await userEvent.click(screen.getByRole('button', { name: 'Discover router' }));
    expect(await screen.findByText('Discovery could not finish')).toBeInTheDocument();
    expect(screen.getByLabelText('Router model')).toHaveValue('Keep this draft');
  });

  it('disables discovery before a management VPN exists', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(empty)));
    renderPage(<HotspotSetupPanel router={router} />);
    expect(await screen.findByRole('button', { name: 'Discover router' })).toBeDisabled();
  });

  it('uses each registered router profile and flags unsupported versions', async () => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({
          ...empty,
          device_profile: { model: 'RB951', routeros_version: '6.49.18' },
        }),
      ),
    );
    renderPage(<HotspotSetupPanel router={router} />);
    expect(await screen.findByLabelText('Router model')).toHaveValue('RB951');
    expect(screen.getByLabelText('RouterOS version')).toHaveValue('6.49.18');
    expect(
      screen.getByText('Hotspot review is not supported for this RouterOS version'),
    ).toBeInTheDocument();
  });

  it('loads saved review, revokes it and removes download controls', async () => {
    server.use(
      http.get(endpoint, () => HttpResponse.json(saved)),
      http.post(endpoint + 'revoke/', () =>
        HttpResponse.json({
          ...saved,
          intent: { ...saved.intent, state: 'revoked', script_preview: null },
        }),
      ),
    );
    renderPage(<HotspotSetupPanel router={router} />);
    expect(await screen.findByRole('button', { name: 'Download review' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Revoke review' }));
    expect(await screen.findByText('Review unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download review' })).not.toBeInTheDocument();
  });
  it('does not treat saved configuration or observations as deployment', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(saved)));
    renderPage(<HotspotSetupPanel router={router} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Review verification checks' }),
    );
    expect(screen.getByText('Awaiting verified deployment')).toBeInTheDocument();
    expect(screen.getByText('Not verified')).toBeInTheDocument();
    expect(screen.queryByText('Workspace Ready!')).not.toBeInTheDocument();
  });
  it('keeps an edited inventory unconfirmed and sends the current router version', async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get(endpoint, () => HttpResponse.json(saved)),
      http.post(endpoint, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(saved);
      }),
    );
    renderPage(<HotspotSetupPanel router={router} />);
    await userEvent.click(await screen.findByRole('button', { name: /Identity & services/ }));
    await userEvent.type(screen.getByLabelText('Router model'), ' revised');
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save configuration review' })).toBeDisabled();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: 'Save configuration review' }));
    await waitFor(() => expect(posted?.expected_updated_at).toBe(router.updated_at));
    expect(posted?.service).toBe('hotspot');
  });
  it('adds interfaces unselected and rejects duplicate names', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(empty)));
    renderPage(<HotspotSetupPanel router={router} />);
    await userEvent.type(await screen.findByLabelText('Interface name'), 'ether1');
    await userEvent.click(screen.getByRole('button', { name: 'Add interface' }));
    expect(screen.getByLabelText('Role for ether1')).toHaveValue('unused');
    await userEvent.type(screen.getByLabelText('Interface name'), 'ether1');
    await userEvent.click(screen.getByRole('button', { name: 'Add interface' }));
    expect(screen.getByText(/Use a unique interface name/)).toBeInTheDocument();
  });
  it('handles the API being unavailable without presenting a fake preview', async () => {
    server.use(
      http.get(endpoint, () => HttpResponse.json({ detail: 'Unavailable' }, { status: 503 })),
    );
    renderPage(<HotspotSetupPanel router={router} />);
    expect(await screen.findByText('Hotspot setup is unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download review' })).not.toBeInTheDocument();
  });
});
