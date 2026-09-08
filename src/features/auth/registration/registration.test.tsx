import { afterEach, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import RegisterPage from '../pages/RegisterPage';
import { CreateWorkspace } from './CreateWorkspace';
import { WorkspaceReady } from './WorkspaceReady';

afterEach(() => vi.unstubAllEnvs());

it('keeps invalid email verification on the first step and allows correcting the code', async () => {
  server.use(
    http.post(`${API}/auth/registration/email/`, () =>
      HttpResponse.json({ message: 'Sent', resend_after: 60 }),
    ),
    http.post(`${API}/auth/registration/email/verify/`, () =>
      HttpResponse.json({ detail: 'Incorrect code.' }, { status: 400 }),
    ),
  );
  renderWithProviders(<RegisterPage />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email address/i), 'owner@example.com');
  await user.click(screen.getByRole('button', { name: /send email verification/i }));
  await user.type(await screen.findByLabelText(/^verification code/i), '123456');
  await user.click(screen.getByRole('button', { name: /verify email & continue/i }));
  expect(await screen.findByText('Incorrect code.')).toBeInTheDocument();
  expect(screen.queryByLabelText(/business name/i)).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^verification code/i)).toHaveValue('123456');
  await user.click(screen.getByRole('button', { name: 'Change email' }));
  expect(screen.getByLabelText(/email address/i)).not.toHaveAttribute('readonly');
});

it('preserves a custom workspace ID and entered fields when the server rejects a duplicate ID', async () => {
  server.use(
    http.post(`${API}/auth/registration/`, () =>
      HttpResponse.json({ workspace_id: ['This workspace ID is already taken.'] }, { status: 400 }),
    ),
  );
  renderWithProviders(
    <CreateWorkspace
      proof={{ email: 'owner@example.com', token: 'proof' }}
      onReady={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/business name/i), 'Example Network');
  expect(screen.getByLabelText(/workspace id/i)).toHaveValue('example-network');
  await user.clear(screen.getByLabelText(/workspace id/i));
  await user.type(screen.getByLabelText(/workspace id/i), 'custom-id');
  await user.type(screen.getByLabelText(/business name/i), ' Limited');
  expect(screen.getByLabelText(/workspace id/i)).toHaveValue('custom-id');
  await user.type(screen.getByLabelText(/first name/i), 'Ada');
  await user.type(screen.getByLabelText(/last name/i), 'Owner');
  await user.type(screen.getByLabelText(/username/i), 'ownername');
  await user.type(screen.getByLabelText(/contact phone/i), '08012345678');
  await user.type(screen.getByLabelText(/^password/i), 'NetworkSecret-2639');
  await user.type(screen.getByLabelText(/confirm password/i), 'NetworkSecret-2639');
  await user.click(screen.getByRole('button', { name: 'Create workspace' }));
  expect(await screen.findByText('This workspace ID is already taken.')).toBeInTheDocument();
  expect(screen.getByLabelText(/workspace id/i)).toHaveValue('custom-id');
  expect(screen.getByLabelText(/business name/i)).toHaveValue('Example Network Limited');
});

it('shows only configured safe community links and the user guide on completion', () => {
  vi.stubEnv('VITE_WHATSAPP_COMMUNITY_URL', 'https://chat.whatsapp.com/example');
  renderWithProviders(
    <WorkspaceReady
      result={{ workspace: { name: 'Example', slug: 'example' }, username: 'owner' }}
    />,
  );
  expect(screen.getByRole('link', { name: /join whatsapp/i })).toHaveAttribute(
    'href',
    'https://chat.whatsapp.com/example',
  );
  expect(screen.getByRole('link', { name: /user guide/i })).toHaveAttribute('href', '/guide');
  expect(screen.queryByText(/telegram|what best describes/i)).not.toBeInTheDocument();
});
