import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { LocalLabVerification, type LocalLabResult } from './LocalLabVerification';

const result: LocalLabResult = {
  eligible: true,
  status: 'not_verified',
  checked_at: null,
  code: null,
  checks: [],
};
describe('Local lab verification', () => {
  it('shows Wi-Fi as the existing Hotspot clients role with a wireless type', () => {
    renderPage(
      <LocalLabVerification
        routerId="r1"
        intentId="package1"
        result={{
          ...result,
          client_interfaces: [
            {
              name: 'ether3',
              kind: 'ethernet',
              role: 'client',
              bridge: 'yarotech-hotspot',
              source: 'package',
            },
            {
              name: 'wlan1',
              kind: 'wireless',
              role: 'client',
              bridge: 'yarotech-hotspot',
              source: 'reviewed_extension',
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole('table')).toHaveTextContent('ether3');
    expect(screen.getByRole('table')).toHaveTextContent('wlan1');
    expect(screen.getByRole('table')).toHaveTextContent('Wireless (Wi-Fi)');
    expect(screen.getAllByRole('cell', { name: 'Hotspot clients' })).toHaveLength(2);
    expect(screen.getByText('Reviewed Wi-Fi addition')).toBeInTheDocument();
  });
  it('shows saved configuration success separately from a pending customer login', () => {
    renderPage(
      <LocalLabVerification
        routerId="r1"
        intentId="package1"
        result={{
          ...result,
          status: 'incomplete',
          progress: {
            configuration: { passed: true, fresh: true, checked_at: '2026-09-13T20:25:33Z' },
            customer_login: { passed: false, fresh: true, checked_at: '2026-09-13T20:25:33Z' },
          },
        }}
      />,
    );
    expect(screen.getByText('Router configuration verified')).toBeInTheDocument();
    expect(screen.getByText('Seven configuration checks passed.')).toBeInTheDocument();
    expect(screen.getByText('Customer login awaiting live confirmation')).toBeInTheDocument();
    expect(screen.getByText('RADIUS and production testing pending')).toBeInTheDocument();
  });
  it('preserves a dated observation after a connection failure without claiming live success', () => {
    renderPage(
      <LocalLabVerification
        routerId="r1"
        intentId="package1"
        result={{
          ...result,
          status: 'unreachable',
          code: 'unreachable',
          progress: {
            configuration: { passed: true, fresh: false, checked_at: '2026-09-13T20:25:33Z' },
            customer_login: { passed: false, fresh: false, checked_at: '2026-09-13T20:25:33Z' },
          },
        }}
      />,
    );
    expect(screen.getByText('Router configuration previously verified')).toBeInTheDocument();
    expect(screen.queryByText('Router configuration verified')).not.toBeInTheDocument();
    expect(
      screen.getByText('Saved observation; current state requires a new check.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Management check failed');
  });
  it('requires an explicit check and reports request failures', async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/routers/r1/hotspot-setup/verify-local-lab/`, async ({ request }) => {
        calls++;
        expect(await request.json()).toEqual({ intent_id: 'package1' });
        return HttpResponse.json({ detail: 'Router changed. Refresh and retry.' }, { status: 409 });
      }),
    );
    renderPage(<LocalLabVerification routerId="r1" intentId="package1" result={result} />);
    expect(calls).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Verify local lab' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Router changed');
    expect(calls).toBe(1);
  });
  it('distinguishes expired evidence from a current success', () => {
    renderPage(
      <LocalLabVerification
        routerId="r1"
        intentId="package1"
        result={{
          ...result,
          eligible: false,
          status: 'stale',
          checks: [{ check_type: 'local_login', passed: true }],
        }}
      />,
    );
    expect(screen.getByText('Local lab evidence expired')).toBeInTheDocument();
    expect(screen.getByText('Fresh check required')).toBeInTheDocument();
    expect(screen.queryByText('Observed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify local lab' })).toBeDisabled();
  });
  it('states the scope of a successful local check', () => {
    renderPage(
      <LocalLabVerification
        routerId="r1"
        intentId="package1"
        result={{ ...result, status: 'verified' }}
      />,
    );
    expect(screen.getByText('Local lab verified')).toBeInTheDocument();
    expect(
      screen.getByText(/system vouchers, payments and RADIUS remain unverified/),
    ).toBeInTheDocument();
  });
});
