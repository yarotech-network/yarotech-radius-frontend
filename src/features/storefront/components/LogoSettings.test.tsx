import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogoSettings } from './LogoSettings';

const mocks = vi.hoisted(() => ({
  principal: { kind: 'member', role: 'owner', tenantId: 1 },
  get: vi.fn(), put: vi.fn(), remove: vi.fn(),
}));
vi.mock('@/app/auth/useAuth', () => ({ usePrincipal: () => mocks.principal }));
vi.mock('@/services/api/http', () => ({ http: { get: mocks.get, put: mocks.put, delete: mocks.remove } }));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><LogoSettings /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.principal.role = 'owner';
  mocks.get.mockResolvedValue({ logo_url: '/old-logo/' });
  mocks.put.mockResolvedValue({ logo_url: '/new-logo/' });
  mocks.remove.mockResolvedValue(undefined);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Logo settings', () => {
  it('uploads multipart data and removes the saved logo', async () => {
    mount();
    const input = await screen.findByLabelText('Choose logo');
    const file = new File(['image'], 'logo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save logo' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledOnce());
    expect(mocks.put.mock.calls[0]?.[1].get('logo')).toBe(file);
    await screen.findByText('Storefront logo updated.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo' }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('/tenants/logo/'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove logo' })).toBeDisabled());
  });
  it('rejects unsupported input before upload', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Choose logo'), {
      target: { files: [new File(['<svg/>'], 'bad.svg', { type: 'image/svg+xml' })] },
    });
    expect(screen.getByText(/Choose a PNG/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save logo' })).toBeDisabled();
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('does not offer management to staff', () => {
    mocks.principal.role = 'staff';
    mount();
    expect(screen.queryByText('Storefront logo')).not.toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
