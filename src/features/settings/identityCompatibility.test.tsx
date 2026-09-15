import { http, HttpResponse } from 'msw';
import { expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { ChangeEmailForm } from './components/ChangeEmailForm';
import { MembershipStatusControl } from './components/MembershipStatusControl';
import { OwnerSetupNotice } from '@/features/platform/components/OwnerSetupNotice';

it('waits for email proof before refreshing the signed-in identity', async () => {
  const user = userEvent.setup();
  const requests: unknown[] = [];
  server.use(
    http.post(`${API}/auth/email-change/`, async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({});
    }),
    http.post(`${API}/auth/email-change/confirm/`, async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({});
    }),
  );
  const { auth } = renderPage(<ChangeEmailForm />);
  await user.type(screen.getByLabelText(/New email/), 'new@example.test');
  await user.type(screen.getByLabelText(/Current password/), 'current-password');
  await user.click(screen.getByRole('button', { name: 'Send verification code' }));
  await screen.findByLabelText(/Email verification code/);
  expect(auth.refreshPrincipal).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText(/Email verification code/), '123456');
  await user.click(screen.getByRole('button', { name: 'Confirm new email' }));
  await waitFor(() => expect(auth.refreshPrincipal).toHaveBeenCalledOnce());
  expect(requests).toEqual([
    { email: 'new@example.test', password: 'current-password' },
    { code: '123456' },
  ]);
});

it('keeps a final owner active when the server rejects suspension', async () => {
  server.use(
    http.patch(`${API}/tenant-memberships/9/`, () =>
      HttpResponse.json({ detail: 'The final tenant owner cannot be removed.' }, { status: 400 }),
    ),
  );
  renderPage(
    <MembershipStatusControl
      member={{
        id: 9,
        user: 42,
        tenant: 5,
        role: 'owner',
        is_active: true,
        user_display: 'Owner',
        tenant_display: 'Shop',
        created_at: '',
      }}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('final tenant owner');
  expect(screen.getByText('Active')).toBeInTheDocument();
});

it('reports owner email delivery failure without claiming success', async () => {
  server.use(
    http.post(`${API}/tenants/5/resend-owner-setup/`, () =>
      HttpResponse.json({ detail: 'Email delivery unavailable.' }, { status: 503 }),
    ),
  );
  renderPage(<OwnerSetupNotice tenantId={5} />);
  await userEvent.click(screen.getByRole('button', { name: 'Resend setup email' }));
  expect(await screen.findByText('Email delivery unavailable.')).toBeInTheDocument();
  expect(screen.queryByText(/Setup email sent/)).not.toBeInTheDocument();
});
