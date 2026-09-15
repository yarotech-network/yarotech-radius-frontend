import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import { SubscriptionGate } from './SubscriptionGate';
vi.mock('@/features/settings/pages/SubscriptionSettingsPage', () => ({default:()=> <div>Owner renewal form</div>}));
function mount(role: 'owner' | 'agent' = 'owner') {
  return renderPage(<SubscriptionGate><h1>Operational dashboard</h1></SubscriptionGate>, {
    role, path:'/dashboard',
    extraRoutes:<Route path="/renew-subscription" element={<SubscriptionGate><div /></SubscriptionGate>} />,
  });
}
function status(required: boolean, can_renew = true, expires_at: string | null = null) {
  server.use(http.get(`${API}/subscriptions/access/`, ()=>HttpResponse.json({required,can_renew,status:'active',expires_at})));
}
describe('subscription access before dashboard layout', ()=>{
  it('sends expired owners to standalone renewal without mounting the dashboard', async()=>{
    status(true); mount();
    expect(await screen.findByText('Payment required to continue')).toBeInTheDocument();
    expect(screen.getByText('Owner renewal form')).toBeInTheDocument();
    expect(screen.queryByText('Operational dashboard')).not.toBeInTheDocument();
  });
  it('asks agents to contact the owner without granting billing access', async()=>{
    status(true,false); mount('agent');
    expect(await screen.findByText(/Contact your workspace owner/)).toBeInTheDocument();
    expect(screen.queryByText('Owner renewal form')).not.toBeInTheDocument();
    expect(screen.queryByText('Operational dashboard')).not.toBeInTheDocument();
  });
  it('allows an active subscription', async()=>{
    status(false); mount();
    expect(await screen.findByText('Operational dashboard')).toBeInTheDocument();
  });
  it('blocks at the expiry deadline even if a cached response says active', async()=>{
    status(false,true,'2020-01-01T00:00:00Z'); mount();
    expect(await screen.findByText('Payment required to continue')).toBeInTheDocument();
    expect(screen.queryByText('Operational dashboard')).not.toBeInTheDocument();
  });
  it('fails closed when status cannot be checked', async()=>{
    server.use(http.get(`${API}/subscriptions/access/`,()=>new HttpResponse(null,{status:503})));
    mount();
    expect(await screen.findByText('Unable to check subscription',{}, {timeout:5000})).toBeInTheDocument();
    expect(screen.queryByText('Operational dashboard')).not.toBeInTheDocument();
  });
  it('returns to the dashboard after renewal is confirmed', async()=>{
    status(true); mount();
    await screen.findByText('Payment required to continue');
    status(false);
    await userEvent.click(screen.getByRole('button',{name:'Check payment status'}));
    expect(await screen.findByText('Operational dashboard')).toBeInTheDocument();
  });
});
