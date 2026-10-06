// TEMPORARY visual preview — delete after review.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import '@/styles/index.css';
import '@/styles/dashboard.css';
import { ToastProvider } from '@/components/feedback/Toaster';
import { AuthContext, type AuthContextValue } from '@/app/auth/authContext';
import { derivePrincipal } from '@/services/auth/principal';
import StorefrontManagementPage from '@/features/storefront/pages/StorefrontManagementPage';
import PaymentsPage from '@/features/payments/pages/PaymentsPage';

const q = new URLSearchParams(location.search);
if (q.get('theme') === 'dark') document.documentElement.classList.add('dark');
const page = q.get('page') ?? 'storefront';
const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const plan = (id: number, name: string, price: number, hours: number, rate: string, data: number, devices = 1) => ({ id, name, price, duration_hours: hours, rate_limit: rate, data_limit: data, max_devices: devices, plan_type: 'voucher' });
const plans = [plan(1, '1 Hour Quick', 10000, 1, '2M/5M', 0), plan(2, 'Daily Basic', 30000, 24, '3M/10M', 2048), plan(3, 'Daily Unlimited', 50000, 24, '5M/15M', 0), plan(4, 'Weekly Saver', 150000, 168, '5M/10M', 15360), plan(5, 'Monthly Home', 500000, 720, '10M/20M', 0, 3)];
const statuses = ['success', 'success', 'pending', 'success', 'failed', 'success', 'success', 'abandoned', 'success', 'success'];
const emails = ['amina.b@gmail.com', 'chidi.okeke@yahoo.com', 'fatima.yusuf@gmail.com', 'tunde.adeyemi@outlook.com', 'grace.eze@gmail.com', 'ibrahim.musa@gmail.com', 'ngozi.obi@yahoo.com', '', 'yusuf.bello@gmail.com', 'kemi.ade@gmail.com'];
const payments = statuses.map((status, i) => ({ id: 900 - i, reference: `YT-${String(900 - i).padStart(6, '0')}`, customer_email: emails[i], customer_phone: '', amount: [50000, 30000, 150000, 10000, 50000, 500000, 30000, 10000, 50000, 150000][i], status,
  provider: i % 3 === 0 ? 'opay' : 'paystack', plan: (i % 5) + 1, plan_name: plans[i % 5]!.name, created_at: ago(i * 37 + 3), verified_at: status === 'success' ? ago(i * 37) : null, voucher: status === 'success' ? 100 + i : null, display_status_code: status, display_status_label: null }));
window.fetch = async (input) => {
  const path = new URL(String(input), location.origin).pathname;
  const page1 = <T,>(r: T[], count = r.length) => ({ count, next: null, previous: null, total_pages: Math.ceil(count / 20), current_page: 1, results: r });
  const body = path.includes('/tenants/profile') ? { id: 5, name: 'Wuse Hotspot', slug: 'wuse-hotspot', phone: '+2348030000000', email: 'hello@wusehotspot.ng', address: 'Plot 12, Wuse Zone 2, Abuja', is_active: true, updated_at: ago(60) }
    : path.includes('/tenants/logo') ? { logo_url: null }
    : path.includes('/public/tenants/') && path.includes('plans') ? page1(plans)
    : path.includes('/public/tenants/') ? { name: 'Wuse Hotspot', slug: 'wuse-hotspot', logo_url: null }
    : path.includes('/payments/transactions') ? page1(payments, 4375)
    : path.includes('/dashboard/stats') ? { collected_revenue: { today: 3675000, month: 28900000, total: 389000000 }, successful_payments: 4120, failed_payments: 238, pending_payments: 17, paid_unfulfilled_payments: 2, revenue_sources: { online: 271000000, agent_wallet: 104000000, agent_credit_repayments: 14000000 }, total_vouchers: 0, active_vouchers: 0, total_revenue: 271000000, total_agents: 6, total_routers: 5, active_routers: 4, currency: 'NGN', amount_unit: 'kobo', observed_at: ago(0) }
    : path.includes('/plans/') ? page1(plans) : {};
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const user = { id: 1, username: 'owner', email: 'o@example.com', first_name: 'Ada', last_name: 'Obi', phone: '', role: 'owner', tenant_name: 'Wuse Hotspot', tenant_id: 5 } as const;
const noop = async () => {};
const auth = { status: 'authenticated', principal: derivePrincipal(user as never), signOutReason: null, signIn: noop, refreshPrincipal: noop, signOut: noop, selectTenant: noop, switchContext: noop } as unknown as AuthContextValue;
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}><ToastProvider><AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={[page === 'payments' ? '/payments' : '/storefront']}><Routes>
      <Route path="*" element={<div className="dashboard-shell min-h-screen bg-canvas p-6"><div className="mx-auto" style={{ maxWidth: q.get('w') ? Number(q.get('w')) : 1152 }}>
        {page === 'payments' ? <PaymentsPage /> : <StorefrontManagementPage />}</div></div>} />
    </Routes></MemoryRouter>
  </AuthContext.Provider></ToastProvider></QueryClientProvider>);
