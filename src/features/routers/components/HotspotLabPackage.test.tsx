import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type { NasDevice } from '@/types/api';
import { HotspotLabPackage } from './HotspotLabPackage';
import type { HotspotSetupResult } from './HotspotSetupPanel';

const router = { id: 'lab-router', updated_at: '2026-09-08T10:00:00Z' } as NasDevice;
const data = {
  intent: {
    id: 'review1',
    state: 'review',
    configuration: { mode: 'fresh', inventory_id: 'snapshot1' },
  },
  discovery: { id: 'snapshot1', state: 'current' },
} as HotspotSetupResult;
const url = `${API}/routers/${router.id}/hotspot-setup/lab-package/`;

describe('Laboratory package', () => {
  it('requires a discovered fresh review and explicit lab acknowledgement', async () => {
    renderPage(<HotspotLabPackage router={router} data={data} />);
    expect(screen.getByRole('button', { name: 'Generate lab package' })).toBeDisabled();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Client DNS server'), '1.1.1.1');
    expect(screen.getByRole('button', { name: 'Generate lab package' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Generate lab package' })).toBeEnabled();
  });

  it('exports the authoritative review with a DNS server and offers all four files', async () => {
    let body: unknown;
    server.use(
      http.post(url, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          id: 'review1',
          generator: 'lab-v1',
          lab_only: true,
          hardware_validated: false,
          files: {
            'README.txt': 'Lab guide',
            'stage.rsc': 'stage',
            'activate.rsc': 'activate',
            'cleanup.rsc': 'cleanup',
          },
          sha256: {},
        });
      }),
    );
    renderPage(<HotspotLabPackage router={router} data={data} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Client DNS server'), '1.1.1.1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate lab package' }));
    expect(await screen.findByRole('button', { name: 'Download stage.rsc' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download cleanup.rsc' })).toBeVisible();
    expect(body).toEqual({
      expected_updated_at: router.updated_at,
      intent_id: 'review1',
      lab_acknowledged: true,
      dns_server: '1.1.1.1',
    });
    // An edited DNS value invalidates local export controls rather than mislabelling old files.
    await user.clear(screen.getByLabelText('Client DNS server'));
    expect(screen.queryByRole('button', { name: 'Download stage.rsc' })).not.toBeInTheDocument();
  });

  it('shows server conflicts without download controls or a deployment success claim', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json({ detail: 'Router changed. Refresh before exporting.' }, { status: 409 }),
      ),
    );
    renderPage(<HotspotLabPackage router={router} data={data} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Client DNS server'), '1.1.1.1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate lab package' }));
    expect(await screen.findByText('Router changed. Refresh before exporting.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Download stage.rsc' })).not.toBeInTheDocument();
  });

  it.each(['stale', 'revoked'])('disables export for a %s review', (state) => {
    renderPage(
      <HotspotLabPackage
        router={router}
        data={{ ...data, intent: { ...data.intent!, state: state as 'stale' | 'revoked' } }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Generate lab package' })).toBeDisabled();
  });
});
