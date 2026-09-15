import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import WhatsAppPage from './WhatsAppPage';

const connection = {
  id: 1,
  tenant: 5,
  phone_number_id: '998877',
  display_number: '+2348012345678',
  token_saved: true,
  is_active: false,
  created_at: '2026-09-15T00:00:00Z',
};

describe('WhatsApp setup', () => {
  it('saves distinct public number and provider ID without claiming a verified connection', async () => {
    let payload: unknown;
    server.use(
      http.get(`${API}/whatsapp/routes/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/whatsapp/routes/`, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(connection, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage(<WhatsAppPage />, { role: 'owner' });
    await user.type(await screen.findByLabelText('Meta phone number ID'), '998877');
    await user.type(screen.getByLabelText('Public WhatsApp number'), '+2348012345678');
    await user.type(screen.getByLabelText('Access token'), 'private-test-token');
    await user.click(screen.getByRole('button', { name: 'Save connection details' }));
    await waitFor(() =>
      expect(payload).toEqual({
        phone_number_id: '998877',
        display_number: '+2348012345678',
        access_token_encrypted: 'private-test-token',
        is_active: false,
      }),
    );
    await screen.findByText('Saved securely', { exact: false });
    expect(screen.getByText('WhatsApp activation')).toBeInTheDocument();
    expect(screen.getByLabelText('Replace access token (optional)')).toHaveValue('');
  });

  it('preserves a saved token when updating other fields', async () => {
    let payload: unknown;
    server.use(
      http.get(`${API}/whatsapp/routes/`, () => HttpResponse.json(paginated([connection]))),
      http.patch(`${API}/whatsapp/routes/1/`, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(connection);
      }),
    );
    renderPage(<WhatsAppPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Save connection details' }));
    await waitFor(() => expect(payload).toMatchObject({ phone_number_id: '998877' }));
    expect(payload).not.toHaveProperty('access_token_encrypted');
  });

  it('gives ordinary staff a read-only view without a token input', async () => {
    server.use(
      http.get(`${API}/whatsapp/routes/`, () => HttpResponse.json(paginated([connection]))),
    );
    renderPage(<WhatsAppPage />, { role: 'staff' });
    expect(await screen.findByLabelText('Meta phone number ID')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Save connection details' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Replace access token (optional)')).not.toBeInTheDocument();
  });
});
