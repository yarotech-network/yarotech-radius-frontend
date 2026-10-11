import { http, HttpResponse } from 'msw';
import { expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import ActivateOfficerPage from './ActivateOfficerPage';

it('requires a token and does not show the activation form without one', () => {
  renderPage(<ActivateOfficerPage />, { path: '/activate-officer' });
  expect(screen.getByText(/missing its token/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Activate account' })).not.toBeInTheDocument();
});

it('submits both passwords, handles a provider error, then shows sign in after activation', async () => {
  const submitted: unknown[] = [];
  let attempts = 0;
  server.use(http.post(`${API}/auth/staff-activate/`, async ({ request }) => {
    submitted.push(await request.json()); attempts += 1;
    return attempts === 1 ? HttpResponse.json({ detail: 'This activation link is invalid or expired.' }, { status: 400 }) :
      HttpResponse.json({ detail: 'Account activated.' });
  }));
  renderPage(<ActivateOfficerPage />, { path: '/activate-officer', route: '/activate-officer?token=test-token' });
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Temporary password/), 'Temporary-123!');
  await user.type(screen.getByLabelText(/^New password/), 'New-password-456!');
  await user.type(screen.getByLabelText(/^Confirm new password/), 'New-password-456!');
  await user.click(screen.getByRole('button', { name: 'Activate account' }));
  expect(await screen.findByText(/invalid or expired/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Activate account' }));
  await waitFor(() => expect(submitted).toHaveLength(2));
  expect(submitted[0]).toMatchObject({ token: 'test-token', temporary_password: 'Temporary-123!', new_password: 'New-password-456!' });
  expect(await screen.findByText(/Your work email is verified/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
});
