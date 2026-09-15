import { useState } from 'react';
import { useAuth } from '@/app/auth/useAuth';
import { AuthContext } from '@/app/auth/authContext';
import { derivePrincipal } from '@/services/auth/principal';
import { describe, expect, it } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API, paginated, makeUser } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import CustomersPage from './ContactRecordsPage';

const customer = {
  id: 1,
  reference: 'C-001',
  name: 'Ada Obi',
  email: 'ada@example.com',
  phone: '',
  address: 'Lagos',
  notes: 'Call ahead',
  archived_at: null,
  created_at: '2026-09-09T10:00:00Z',
  updated_at: '2026-09-09T10:00:00Z',
};
const endpoint = `${API}/customers/`;

describe('Customer directory', () => {
  it('shows read-only records for staff and fetches customer details separately', async () => {
    server.use(
      http.get(`${API}/pppoe-services/`, () => HttpResponse.json(paginated([]))),
      http.get(endpoint, () => HttpResponse.json(paginated([customer]))),
      http.get(`${endpoint}1/`, () => HttpResponse.json({ ...customer, notes: 'Fresh detail' })),
    );
    renderPage(<CustomersPage />, { role: 'staff', path: '/customers' });
    expect(await screen.findByText('Ada Obi')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add customer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(await screen.findByText('Fresh detail')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Customer purchase history' }),
    ).not.toBeInTheDocument();
    expect(
      await within(screen.getByRole('dialog')).findByRole('link', { name: 'IoT / MAC Devices' }),
    ).toBeVisible();
  });
  it('creates a customer with an idempotency key and displays server field errors', async () => {
    let payload: unknown;
    let key: string | null = null;
    server.use(
      http.get(`${API}/pppoe-services/`, () => HttpResponse.json(paginated([]))),
      http.get(endpoint, () => HttpResponse.json(paginated([]))),
      http.post(endpoint, async ({ request }) => {
        payload = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ reference: ['Reference already exists.'] }, { status: 400 });
      }),
    );
    renderPage(<CustomersPage />, { role: 'manager', path: '/customers' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add customer' }));
    const form = within(screen.getByRole('dialog'));
    await user.type(form.getByLabelText('Customer reference'), 'C-002');
    await user.type(form.getByLabelText('Full name or business name'), 'New customer');
    await user.click(form.getByRole('button', { name: 'Create customer' }));
    expect(await form.findByText('Reference already exists.')).toBeVisible();
    expect(payload).toEqual({
      reference: 'C-002',
      name: 'New customer',
      email: '',
      phone: '',
      address: '',
      notes: '',
      mac_address: '',
    });
    expect(key).toBeTruthy();
    expect(form.getByLabelText('Customer reference')).toHaveAttribute('aria-invalid', 'true');
  });
  it('edits without changing the reference, then archives through a retained-record action', async () => {
    let payload: unknown;
    let archived = false;
    server.use(
      http.get(`${API}/pppoe-services/`, () => HttpResponse.json(paginated([]))),
      http.get(endpoint, () => HttpResponse.json(paginated([customer]))),
      http.patch(`${endpoint}1/`, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(customer);
      }),
      http.post(`${endpoint}1/archive/`, () => {
        archived = true;
        return HttpResponse.json(customer);
      }),
    );
    renderPage(<CustomersPage />, { role: 'owner', path: '/customers' });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = within(screen.getByRole('dialog'));
    expect(form.getByLabelText('Customer reference')).toHaveAttribute('readonly');
    await user.clear(form.getByLabelText('Full name or business name'));
    await user.type(form.getByLabelText('Full name or business name'), 'Ada Network');
    await user.click(form.getByRole('button', { name: 'Save customer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(payload).toMatchObject({ name: 'Ada Network', reference: 'C-001' });
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    await user.click(screen.getByRole('button', { name: 'Archive customer' }));
    await waitFor(() => expect(archived).toBe(true));
  });
  it('saves an unnamed contact and shows a reference fallback', async () => {
    let payload: unknown;
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json(paginated([{ ...customer, name: '', email: '', reference: 'ANON' }])),
      ),
      http.post(endpoint, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(customer);
      }),
    );
    renderPage(<CustomersPage />, { role: 'manager' });
    expect(await screen.findByRole('button', { name: 'ANON' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Add customer' }));
    const form = within(screen.getByRole('dialog'));
    expect(form.getByLabelText('Full name or business name')).not.toBeRequired();
    await userEvent.type(form.getByLabelText('Customer reference'), 'ANON-2');
    await userEvent.click(form.getByRole('button', { name: 'Create customer' }));
    await waitFor(() => expect(payload).toMatchObject({ reference: 'ANON-2', name: '' }));
  });
  it('shows paginated purchase history to a manager without voucher credentials', async () => {
    server.use(
      http.get(endpoint, () => HttpResponse.json(paginated([customer]))),
      http.get(`${endpoint}1/`, () => HttpResponse.json(customer)),
      http.get(`${endpoint}1/purchases/`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json({
          count: 11,
          current_page: page,
          total_pages: 2,
          results: [
            {
              id: page,
              amount: 50000,
              status: 'success',
              plan_name: 'Day pass',
              fulfilled: true,
              created_at: customer.created_at,
              paid_at: customer.created_at,
            },
          ],
        });
      }),
    );
    renderPage(<CustomersPage />, { role: 'manager' });
    await userEvent.click(await screen.findByRole('button', { name: 'View details' }));
    const history = await screen.findByRole('region', { name: 'Customer purchase history' });
    expect(await within(history).findByText('Purchase #1: Day pass')).toBeVisible();
    expect(within(history).getByRole('button', { name: 'Previous purchases' })).toBeDisabled();
    await userEvent.click(within(history).getByRole('button', { name: 'Next purchases' }));
    expect(await within(history).findByText('Purchase #2: Day pass')).toBeVisible();
    expect(within(history).getByRole('button', { name: 'Next purchases' })).toBeDisabled();
  });
  it('closes the old customer detail and ignores its late response after switching workspace', async () => {
    let activeTenant = 5;
    let requested = false;
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json(
          paginated([
            {
              ...customer,
              id: activeTenant,
              name: activeTenant === 5 ? 'First workspace contact' : 'Second workspace contact',
            },
          ]),
        ),
      ),
      http.get(`${endpoint}5/`, async () => {
        requested = true;
        await pending;
        return HttpResponse.json({ ...customer, id: 5, notes: 'Old private detail' });
      }),
    );
    function SwitchingWorkspace() {
      const auth = useAuth();
      const [tenant, setTenant] = useState(5);
      return (
        <AuthContext.Provider
          value={{
            ...auth,
            principal: derivePrincipal(makeUser('manager', { tenant_id: tenant })),
          }}
        >
          <button
            onClick={() => {
              activeTenant = 6;
              setTenant(6);
            }}
          >
            Switch workspace
          </button>
          <CustomersPage />
        </AuthContext.Provider>
      );
    }
    renderPage(<SwitchingWorkspace />);
    const switchButton = screen.getByRole('button', { name: 'Switch workspace' });
    await userEvent.click(await screen.findByRole('button', { name: 'View details' }));
    await waitFor(() => expect(requested).toBe(true));
    await userEvent.click(switchButton);
    expect(await screen.findByRole('button', { name: 'Second workspace contact' })).toBeVisible();
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('Old private detail')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'First workspace contact' }),
    ).not.toBeInTheDocument();
  });
  it('requires a preview and clears it when import content changes', async () => {
    let committed: unknown;
    let key: string | null = null;
    server.use(
      http.get(`${API}/pppoe-services/`, () => HttpResponse.json(paginated([]))),
      http.get(endpoint, () => HttpResponse.json(paginated([]))),
      http.post(`${endpoint}import-preview/`, () =>
        HttpResponse.json({ count: 1, rows: [customer], preview_token: 'signed-preview' }),
      ),
      http.post(`${endpoint}import-confirm/`, async ({ request }) => {
        committed = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ count: 1 }, { status: 201 });
      }),
    );
    renderPage(<CustomersPage />, { role: 'manager', path: '/customers' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Import CSV' }));
    const form = within(screen.getByRole('dialog'));
    expect(form.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
    await user.type(form.getByLabelText('CSV content'), 'reference,name\nC-001,Ada');
    await user.click(form.getByRole('button', { name: 'Preview import' }));
    expect(await form.findByText('1 customers ready to import')).toBeVisible();
    await user.type(form.getByLabelText('CSV content'), ' Obi');
    expect(form.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
    await user.click(form.getByRole('button', { name: 'Preview import' }));
    await form.findByText('1 customers ready to import');
    await user.click(form.getByRole('button', { name: 'Confirm import' }));
    await waitFor(() =>
      expect(committed).toEqual({
        csv: 'reference,name\nC-001,Ada Obi',
        preview_token: 'signed-preview',
      }),
    );
    expect(key).toBeTruthy();
  });
  it('keeps a failed import open and shows row validation errors', async () => {
    server.use(
      http.get(`${API}/pppoe-services/`, () => HttpResponse.json(paginated([]))),
      http.get(endpoint, () => HttpResponse.json(paginated([]))),
      http.post(`${endpoint}import-preview/`, () =>
        HttpResponse.json(
          { csv: ['Row 3: duplicate reference within this file.'] },
          { status: 400 },
        ),
      ),
    );
    renderPage(<CustomersPage />, { role: 'manager', path: '/customers' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Import CSV' }));
    const form = within(screen.getByRole('dialog'));
    await user.type(form.getByLabelText('CSV content'), 'reference,name\nA,Test');
    await user.click(form.getByRole('button', { name: 'Preview import' }));
    expect(await form.findByText('Row 3: duplicate reference within this file.')).toBeVisible();
    expect(form.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
  });
});
