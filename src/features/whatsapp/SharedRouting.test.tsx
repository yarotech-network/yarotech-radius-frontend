import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import SharedEndpointPage, { TenantEntryLink } from './SharedRouting';

const endpoint = { exists: true, version: 'v1', phone_number_id: '998877', display_number: '+2348012345678',
  token_saved: true, is_active: false, provider_verified: false, routing_keys_ready: true,
  webhook_enabled: false, webhook_configured: false };
const entry = { exists: true, version: 'v1', revoked: false, shared_number: '+2348012345678',
  preview_url: 'https://wa.me/2348012345678?text=START%20preview', routing_keys_ready: true, sales_available: false };

describe('Shared WhatsApp routing', () => {
  it('distinguishes configured webhook reception from a verified provider connection', async () => {
    server.use(http.get(`${API}/platform/whatsapp/shared-endpoint/`, () => HttpResponse.json({
      ...endpoint, webhook_enabled: true, webhook_configured: true,
    })));
    renderPage(<SharedEndpointPage />, { role: 'platform_admin' });
    expect(await screen.findByText('Webhook reception: Enabled in server settings')).toBeInTheDocument();
    expect(screen.getByText('Webhook credentials: Configured')).toBeInTheDocument();
    expect(screen.getByText('Provider verification: Not verified')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp sales are not active yet')).toBeInTheDocument();
  });
  it('preserves saved credentials and uses the loaded version when saving', async () => {
    let payload: unknown;
    server.use(http.get(`${API}/platform/whatsapp/shared-endpoint/`, () => HttpResponse.json(endpoint)),
      http.put(`${API}/platform/whatsapp/shared-endpoint/`, async ({ request }) => {
        payload = await request.json(); return HttpResponse.json(endpoint);
      }));
    renderPage(<SharedEndpointPage />, { role: 'platform_admin' });
    await userEvent.click(await screen.findByRole('button', { name: 'Save shared number' }));
    await waitFor(() => expect(payload).toMatchObject({ expected_version: 'v1', phone_number_id: '998877' }));
    expect(payload).not.toHaveProperty('access_token');
    expect(screen.getByLabelText('Replace shared access token (optional)')).toHaveValue('');
    expect(screen.getByText('WhatsApp sales are not active yet')).toBeInTheDocument();
  });

  it('verifies saved credentials without sending token contents and disables verification for unsaved edits', async () => {
    let payload: unknown;
    server.use(http.get(`${API}/platform/whatsapp/shared-endpoint/`, () => HttpResponse.json(endpoint)),
      http.post(`${API}/platform/whatsapp/shared-endpoint/verify/`, async ({ request }) => {
        payload = await request.json(); return HttpResponse.json({ ...endpoint, provider_verified: true });
      }));
    renderPage(<SharedEndpointPage />, { role: 'platform_admin' });
    const verify = await screen.findByRole('button', { name: 'Verify saved connection' });
    await userEvent.click(verify);
    await waitFor(() => expect(payload).toEqual({ expected_version: 'v1' }));
    expect(await screen.findByText('Connection checked')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Replace shared access token (optional)'), 'replacement');
    expect(verify).toBeDisabled();
  });

  it('requires confirmation to replace a link and shows the refreshed preview', async () => {
    let current = entry;
    let payload: unknown;
    server.use(http.get(`${API}/whatsapp/entry-route/`, () => HttpResponse.json(current)),
      http.post(`${API}/whatsapp/entry-route/`, async ({ request }) => {
        payload = await request.json(); current = { ...entry, version: 'v2', preview_url: 'new-preview' };
        return HttpResponse.json(current);
      }));
    const user = userEvent.setup();
    renderPage(<TenantEntryLink scope={5} />);
    await user.click(screen.getByRole('button', { name: 'Manage business link' }));
    await user.click(await screen.findByRole('button', { name: 'Replace business link' }));
    expect(payload).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(payload).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Replace business link' }));
    await user.click(screen.getByRole('button', { name: /^Confirm$/ }));
    await waitFor(() => expect(payload).toEqual({ action: 'rotate', expected_version: 'v1' }));
    await waitFor(() => expect(screen.getByLabelText('Business link preview')).toHaveValue('new-preview'));
    expect(screen.getByText('Preview only')).toBeInTheDocument();
  });

  it('reports a stale settings conflict without claiming success', async () => {
    server.use(http.get(`${API}/platform/whatsapp/shared-endpoint/`, () => HttpResponse.json(endpoint)),
      http.put(`${API}/platform/whatsapp/shared-endpoint/`, () => HttpResponse.json({ detail: 'Settings changed. Reload.' }, { status: 409 })));
    renderPage(<SharedEndpointPage />, { role: 'platform_admin' });
    await userEvent.click(await screen.findByRole('button', { name: 'Save shared number' }));
    expect(await screen.findByText('Could not save settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload settings' })).toBeEnabled();
  });
});
