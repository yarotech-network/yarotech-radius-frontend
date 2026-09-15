import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { WorkflowControls } from './WorkflowControls';

const defaults = { version: 'v1', enabled: false, unused_enabled: false, expiry_enabled: false,
  unused_hours: 24, short_lead_hours: 2, medium_lead_hours: 24, long_lead_hours: 72,
  unused_template: '', expiry_template: '', language: 'en' };
function handlers(version: string | null = 'v1') {
  server.use(http.get(`${API}/whatsapp/reminders/`, () => HttpResponse.json({ ...defaults, version })),
    http.get(`${API}/whatsapp/orders/`, () => HttpResponse.json({ count: 1, current_page: 1, total_pages: 1,
      results: [{ id: 9, state: 'fulfilled', payment_status: 'success', fulfilled: true, error_code: '', delivery_state: 'unknown', created_at: '' }] })));
}
describe('WhatsApp workflow controls', () => {
  it('starts reminders disabled and saves using the loaded settings version', async () => {
    handlers();
    let payload: unknown;
    server.use(http.put(`${API}/whatsapp/reminders/`, async ({ request }) => {
      payload = await request.json(); return HttpResponse.json(defaults);
    }));
    renderPage(<WorkflowControls scope={5} />);
    await userEvent.click(screen.getByRole('button', { name: 'Manage orders and reminders' }));
    const enabled = await screen.findByRole('checkbox', { name: 'Enable reminders' });
    expect(enabled).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Save reminder settings' }));
    await waitFor(() => expect(payload).toMatchObject({ expected_version: 'v1', enabled: false, unused_hours: 24 }));
  });
  it('uses the API page metadata to load the next order page', async () => {
    handlers();
    server.use(http.get(`${API}/whatsapp/orders/`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page'));
      return HttpResponse.json({ count: 21, current_page: page, total_pages: 2, results: [
        { id: page, state: 'pending', payment_status: 'pending', fulfilled: false, error_code: '', delivery_state: null, created_at: '' },
      ] });
    }));
    renderPage(<WorkflowControls scope={5} />);
    await userEvent.click(screen.getByRole('button', { name: 'Manage orders and reminders' }));
    await screen.findByRole('button', { name: 'Recheck order #1' });
    expect(screen.getByRole('button', { name: 'Previous orders' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next orders' }));
    await screen.findByRole('button', { name: 'Recheck order #2' });
    expect(screen.getByRole('button', { name: 'Next orders' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous orders' })).toBeEnabled();
  });
  it('requires a business link before displaying the reminder settings form', async () => {
    handlers(null);
    renderPage(<WorkflowControls scope={5} />);
    await userEvent.click(screen.getByRole('button', { name: 'Manage orders and reminders' }));
    expect(await screen.findByText('Create your shared-number business link before configuring reminders.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save reminder settings' })).not.toBeInTheDocument();
  });
  it('requires explicit resend confirmation and retains its request identity after a failed response', async () => {
    handlers();
    const calls: Array<{ request_id: string; acknowledge_duplicate_risk: boolean }> = [];
    server.use(http.post(`${API}/whatsapp/orders/9/recover/`, async ({ request }) => {
      calls.push(await request.json() as typeof calls[number]);
      return calls.length === 1 ? HttpResponse.json({ detail: 'Please retry.' }, { status: 503 }) : HttpResponse.json({});
    }));
    renderPage(<WorkflowControls scope={5} />);
    await userEvent.click(screen.getByRole('button', { name: 'Manage orders and reminders' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Resend voucher #9' }));
    expect(calls).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm resend' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm resend' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Confirm resend' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]?.acknowledge_duplicate_risk).toBe(true);
    expect(calls[1]?.request_id).toBe(calls[0]?.request_id);
    expect(await screen.findByText('Request recorded')).toBeInTheDocument();
  });
});
