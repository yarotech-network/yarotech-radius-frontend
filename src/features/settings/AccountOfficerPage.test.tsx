import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import TeamSettingsPage from './pages/TeamSettingsPage';
import AcceptOwnershipPage from './pages/AcceptOwnershipPage';

describe('tenant account officer and ownership', () => {
  it('shows assigned support contact and submits one tracked change request', async () => {
    let reason = '';
    server.use(
      http.get(`${API}/tenants/officer/`, () => HttpResponse.json({ name: 'Amina Yusuf', email: 'amina@example.com', phone: '08012345678', assigned: true })),
      http.get(`${API}/tenants/officer/change-requests/`, () => HttpResponse.json([])),
      http.post(`${API}/tenants/officer/change-requests/`, async ({ request }) => {
        reason = (await request.json() as { reason: string }).reason;
        return HttpResponse.json({ id: 1, status: 'pending' }, { status: 201 });
      }),
    );
    renderPage(<TeamSettingsPage />, { role: 'owner', path: '/settings/team' });
    expect(await screen.findByText('Amina Yusuf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'amina@example.com' })).toHaveAttribute('href', 'mailto:amina@example.com');
    await userEvent.type(screen.getByRole('textbox', { name: /request a different account officer/i }), 'We need a different contact');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(reason).toBe('We need a different contact'));
    expect(screen.queryByRole('button', { name: 'Add team member' })).not.toBeInTheDocument();
  });

  it('shows general support when no officer is assigned', async () => {
    server.use(
      http.get(`${API}/tenants/officer/`, () => HttpResponse.json({ name: 'Yarotech support', email: 'support@yarotech.com.ng', phone: '', assigned: false })),
      http.get(`${API}/tenants/officer/change-requests/`, () => HttpResponse.json([])),
    );
    renderPage(<TeamSettingsPage />, { role: 'owner', path: '/settings/team' });
    expect(await screen.findByText('Yarotech support')).toBeInTheDocument();
    expect(screen.getByText(/primary officer has not been assigned/i)).toBeInTheDocument();
  });

  it('accepts ownership through the emailed token without displaying it', async () => {
    let received = '';
    server.use(http.post(`${API}/tenants/owner-transfer/accept/`, async ({ request }) => {
      received = (await request.json() as { token: string }).token;
      return HttpResponse.json({ status: 'accepted', tenant_name: 'Wuse Hotspot' });
    }));
    renderPage(<AcceptOwnershipPage />, { path: '/accept-ownership', route: '/accept-ownership?token=private-token' });
    await userEvent.type(screen.getByRole('textbox', { name: /new username/i }), 'new-owner');
    await userEvent.type(screen.getByLabelText(/new password/i), 'Strong-pass-456');
    await userEvent.click(screen.getByRole('button', { name: 'Accept ownership' }));
    await waitFor(() => expect(received).toBe('private-token'));
    expect(await screen.findByText(/you now own wuse hotspot/i)).toBeInTheDocument();
    expect(window.location.search).not.toContain('private-token');
  });
});
