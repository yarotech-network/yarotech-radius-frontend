import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import type { PublicPlan } from '@/types/api';
import StorefrontPage from './pages/StorefrontPage';
import PaymentResultPage from './pages/PaymentResultPage';
import PricingPage from './pages/PricingPage';
import { IoTCheckout } from './components/IoTCheckout';
import { pendingCheckout } from './pendingCheckout';
import { Route, Routes } from 'react-router';

const plans: PublicPlan[] = [
  {
    id: 1,
    name: 'Daily 1GB',
    price: 50000,
    duration_hours: 24,
    rate_limit: '5M/10M',
    data_limit: 1024,
  },
  {
    id: 2,
    name: 'Weekly Unlimited',
    price: 250000,
    duration_hours: 168,
    rate_limit: '10M/20M',
    data_limit: 0,
  },
];

function mockStore() {
  server.use(
    http.get(`${API}/public/tenants/wuse-hotspot/`, () =>
      HttpResponse.json({ id: 2, slug: 'wuse-hotspot', name: 'Wuse Hotspot' }),
    ),
    http.get(`${API}/public/tenants/wuse-hotspot/plans/`, () =>
      HttpResponse.json(paginated(plans)),
    ),
    http.get(`${API}/public/tenants/:slug/`, () =>
      HttpResponse.json({ detail: 'No Tenant matches the given query.' }, { status: 404 }),
    ),
  );
}

function renderStore(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/s/:slug/*" element={<StorefrontPage />} />
      <Route path="/pay/result" element={<PaymentResultPage />} />
    </Routes>,
    { route },
  );
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('storefront catalogue', () => {
  it('lists the operator plans with customer-friendly details and a Buy link', async () => {
    mockStore();
    renderStore('/s/wuse-hotspot');
    expect(await screen.findByRole('heading', { name: 'Wuse Hotspot' })).toBeInTheDocument();
    const weekly = await screen.findByRole('article', { name: 'Weekly Unlimited' });
    expect(within(weekly).getByText('₦2,500.00')).toBeInTheDocument();
    expect(within(weekly).getByText('7 days')).toBeInTheDocument();
    expect(within(weekly).getByText('Unlimited data')).toBeInTheDocument();
    expect(within(weekly).getByRole('link', { name: 'Buy' })).toHaveAttribute(
      'href',
      '/s/wuse-hotspot/checkout/2',
    );
  });

  it('shows a not-found screen for an unknown slug', async () => {
    mockStore();
    renderStore('/s/nope');
    expect(
      await screen.findByRole('heading', { name: 'This storefront does not exist' }),
    ).toBeInTheDocument();
  });

  it('shows an empty state when no plans are published', async () => {
    mockStore();
    server.use(
      http.get(`${API}/public/tenants/wuse-hotspot/plans/`, () => HttpResponse.json(paginated([]))),
    );
    renderStore('/s/wuse-hotspot');
    expect(await screen.findByText('No plans available right now')).toBeInTheDocument();
  });
});

describe('checkout', () => {
  it('validates the email, posts the order with an Idempotency-Key and redirects to Paystack', async () => {
    mockStore();
    let received: { body: unknown; key: string | null } | null = null;
    server.use(
      http.post(`${API}/buy/`, async ({ request }) => {
        received = { body: await request.json(), key: request.headers.get('Idempotency-Key') };
        return HttpResponse.json({
          authorization_url: 'https://checkout.paystack.com/abc',
          reference: 'yarotech-abc',
        });
      }),
    );
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign,
    } as unknown as Location);
    const user = userEvent.setup();
    renderStore('/s/wuse-hotspot/checkout/1');
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    // the order summary shows the chosen plan
    expect(await screen.findByRole('article', { name: 'Daily 1GB' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continue to payment/i }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(received).toBeNull();

    await user.type(screen.getByLabelText(/email address/i), 'buyer@example.com');
    await user.type(screen.getByLabelText(/^name/i), 'Buyer One');
    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/abc'));
    expect(received!.body).toEqual({ plan_id: 1, email: 'buyer@example.com', name: 'Buyer One' });
    expect(received!.key).toMatch(/^buy-/);
    expect(pendingCheckout.load()).toMatchObject({
      kind: 'voucher',
      reference: 'yarotech-abc',
      slug: 'wuse-hotspot',
    });
  });

  it('explains a 503 from the provider without pretending the order went through', async () => {
    mockStore();
    server.use(
      http.post(`${API}/buy/`, () =>
        HttpResponse.json(
          { error: 'Payment provider unavailable', reference: 'yarotech-dead' },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderStore('/s/wuse-hotspot/checkout/1');
    await user.type(await screen.findByLabelText(/email address/i), 'buyer@example.com');
    await user.click(screen.getByRole('button', { name: /continue to payment/i }));
    expect(await screen.findByText('Payments are temporarily unavailable')).toBeInTheDocument();
      expect(screen.getByText('yarotech-dead')).toBeInTheDocument();
      expect(screen.queryByText(/you have not been charged/i)).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Check this payment' })).toHaveAttribute(
        'href', '/pay/result?reference=yarotech-dead',
      );
  });

  it('handles a plan that no longer exists', async () => {
    mockStore();
    renderStore('/s/wuse-hotspot/checkout/999');
    expect(await screen.findByText('This plan is no longer available')).toBeInTheDocument();
  });
});

describe('payment result', () => {
  it('verifies a pending payment and then shows the access code with connection steps', async () => {
    let calls = 0;
    let verificationCalls = 0;
    server.use(
      http.post(`${API}/payments/verify/`, () => {
        verificationCalls += 1;
        return HttpResponse.json(verificationCalls === 1
          ? { status: 'pending', reference: 'yarotech-abc', voucher: null, fulfilled: false }
          : {
            status: 'success', reference: 'yarotech-abc', fulfilled: true,
            voucher: 'WH84QRKP', access_code: 'WH84QRKP', code_revealed: true,
            plan: { name: 'Daily 1GB', duration_hours: 24, data_limit: 1024 },
            tenant_name: 'Wuse Hotspot', customer_email_masked: 'a\u2022\u2022\u2022@example.com',
          });
      }),
      http.get(`${API}/payments/callback/`, ({ request }) => {
        const ref = new URL(request.url).searchParams.get('reference');
        calls += 1;
        return HttpResponse.json(
          calls < 2
            ? { status: 'pending', reference: ref, voucher: null }
            : {
                status: 'success',
                reference: ref,
                voucher: 'WH84QRKP',
                access_code: 'WH84QRKP',
                code_revealed: true,
                plan: { name: 'Daily 1GB', duration_hours: 24, data_limit: 1024 },
                tenant_name: 'Wuse Hotspot',
                customer_email_masked: 'a•••@example.com',
              },
        );
      }),
    );
    pendingCheckout.save({ kind: 'voucher', reference: 'yarotech-abc', slug: 'wuse-hotspot' });
    const user = userEvent.setup();
    renderStore('/pay/result?reference=yarotech-abc');
    expect(await screen.findByText('Waiting for confirmation')).toBeInTheDocument();
    await waitFor(() => expect(verificationCalls).toBe(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText('Payment successful')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Access code' })).toHaveTextContent('WH84QRKP');
    expect(screen.getByRole('button', { name: 'Copy access code' })).toBeInTheDocument();
    expect(screen.getByText('Daily 1GB · 1 day · 1 GB')).toBeInTheDocument();
    expect(screen.getByText('How to connect')).toBeInTheDocument();
    expect(screen.getByText(/Join the Wuse Hotspot Wi-Fi network/)).toBeInTheDocument();
    expect(screen.getByText(/A copy is on its way to a•••@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to plans' })).toHaveAttribute(
      'href',
      '/s/wuse-hotspot',
    );
    // settled → the remembered checkout is cleared
    await waitFor(() => expect(pendingCheckout.load()).toBeNull());
  });

  it.each([null, 'WH84QRKP'])('hides fulfilled credentials including legacy voucher value %s', async (voucher) => {
    const verify = vi.fn(() => HttpResponse.json({}));
    server.use(
      http.post(`${API}/payments/verify/`, verify),
      http.get(`${API}/payments/callback/`, ({ request }) =>
        HttpResponse.json({
          status: 'success',
          reference: new URL(request.url).searchParams.get('reference'),
          voucher,
          fulfilled: true,
          access_code: 'WH84QRKP',
          code_revealed: false,
          plan: { name: 'Daily 1GB', duration_hours: 24, data_limit: 1024 },
          tenant_name: 'Wuse Hotspot',
          customer_email_masked: 'a•••@example.com',
        }),
      ),
    );
    pendingCheckout.save({ kind: 'voucher', reference: 'yarotech-used', slug: 'wuse-hotspot' });
    renderStore('/pay/result?reference=yarotech-used');
    expect(await screen.findByText('Payment successful')).toBeInTheDocument();
    expect(screen.queryByText('WH84QRKP')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy username' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument();
    expect(screen.getByText(/Your voucher has been issued/)).toBeInTheDocument();
    await waitFor(() => expect(pendingCheckout.load()).toBeNull());
    expect(verify).not.toHaveBeenCalled();
    expect(screen.queryByRole('status', { name: 'Access code' })).not.toBeInTheDocument();
  });

  it('recovers an unfulfilled payment and settles without exposing credentials', async () => {
    const verify = vi.fn(() => HttpResponse.json({
      status: 'success', reference: 'recover-order', fulfilled: true,
      voucher: null, access_code: null, code_revealed: false,
    }));
    server.use(
      http.get(`${API}/payments/callback/`, () => HttpResponse.json({
        status: 'success', reference: 'recover-order', fulfilled: false, voucher: null,
      })),
      http.post(`${API}/payments/verify/`, verify),
    );
    pendingCheckout.save({ kind: 'voucher', reference: 'recover-order' });
    renderStore('/pay/result?reference=recover-order');
    expect(await screen.findByText(/Your voucher has been issued/)).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument();
    await waitFor(() => expect(pendingCheckout.load()).toBeNull());
  });

  it('handles an older callback without displaying its username', async () => {
    server.use(
      http.get(`${API}/payments/callback/`, ({ request }) =>
        HttpResponse.json({
          status: 'success',
          reference: new URL(request.url).searchParams.get('reference'),
          voucher: 'legacyuser',
        }),
      ),
    );
    renderStore('/pay/result?reference=yarotech-legacy');
    expect(await screen.findByText('Payment successful')).toBeInTheDocument();
    expect(screen.queryByText('legacyuser')).not.toBeInTheDocument();
    expect(screen.getByText(/contact the business with this reference/)).toBeInTheDocument();
  });

  it('falls back to the remembered reference when Paystack drops the query string', async () => {
    server.use(
      http.get(`${API}/payments/callback/`, ({ request }) =>
        HttpResponse.json({
          status: 'failed',
          reference: new URL(request.url).searchParams.get('reference'),
          voucher: null,
        }),
      ),
    );
    pendingCheckout.save({ kind: 'voucher', reference: 'yarotech-lost', slug: 'wuse-hotspot' });
    renderStore('/pay/result');
    expect(await screen.findByText('Payment failed')).toBeInTheDocument();
    expect(screen.getByText('yarotech-lost')).toBeInTheDocument();
  });

  it('shows a clear message for an unknown reference and when there is nothing to check', async () => {
    server.use(
      http.get(`${API}/payments/callback/`, () =>
        HttpResponse.json({ error: 'Payment not found' }, { status: 404 }),
      ),
    );
    const { unmount } = renderStore('/pay/result?reference=zzz');
    expect(await screen.findByText('We could not find this payment')).toBeInTheDocument();
    unmount();
    renderStore('/pay/result');
    expect(await screen.findByText('No payment to check')).toBeInTheDocument();
  });
});

describe('pricing', () => {
  it('renders active platform plans only', async () => {
    server.use(
      http.get(`${API}/pricing/`, () =>
        HttpResponse.json(
          paginated([
            {
              id: 1,
              name: 'Starter',
              price: 1500000,
              price_display: '₦15,000',
              duration_days: 30,
              features: ['1 router'],
              max_routers: 1,
              whatsapp_enabled: false,
              daily_voucher_print_limit: 75,
              is_active: true,
            },
            {
              id: 2,
              name: 'Legacy',
              price: 1,
              price_display: '₦0.01',
              duration_days: 30,
              features: [],
              is_active: false,
            },
          ]),
        ),
      ),
    );
    renderWithProviders(<PricingPage />, { route: '/pricing' });
    expect(await screen.findByRole('heading', { name: 'Starter' })).toBeInTheDocument();
    expect(screen.getByText('₦15,000.00')).toBeInTheDocument();
    expect(screen.getByText('1 router')).toBeInTheDocument();
    expect(screen.getByText('1 active routers')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp not included')).toBeInTheDocument();
    expect(screen.getByText('75 vouchers prepared for printing per day')).toBeInTheDocument();
    expect(screen.queryByText('Legacy')).not.toBeInTheDocument();
  });
});

it('shows the device total and remembers the authoritative reserved price', async () => {
  mockStore();
  let posted: Record<string, unknown> | null = null;
  server.use(
    http.get(`${API}/public/tenants/wuse-hotspot/plans/`, () => HttpResponse.json(paginated([{...plans[0], max_devices:10}]))),
    http.post(`${API}/buy/`, async ({request}) => {
      posted = await request.json() as Record<string, unknown>;
      return HttpResponse.json({authorization_url:'https://checkout.paystack.com/devices', reference:'device-order', amount:180000, device_limit:3});
    }),
  );
  const assign = vi.fn();
  vi.spyOn(window, 'location', 'get').mockReturnValue({...window.location, assign} as unknown as Location);
  renderStore('/s/wuse-hotspot/checkout/1');
  await userEvent.selectOptions(await screen.findByLabelText('Devices per voucher'), '3');
  expect(screen.getByText(/1,500/)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/Email address/), 'buyer@example.com');
  await userEvent.click(screen.getByRole('button', {name:/Continue to payment/}));
  await waitFor(()=>expect(assign).toHaveBeenCalled());
  expect(posted).toMatchObject({plan_id:1, device_limit:3});
  expect(pendingCheckout.load()).toMatchObject({amount:180000, deviceLimit:3});
});

it('uses a new request key when the selected device count changes after rejection', async () => {
  mockStore();
  const keys: (string | null)[] = [];
  server.use(
    http.get(`${API}/public/tenants/wuse-hotspot/plans/`, () => HttpResponse.json(paginated([{...plans[0], max_devices:10}]))),
    http.post(`${API}/buy/`, ({request}) => {
      keys.push(request.headers.get('Idempotency-Key'));
      return HttpResponse.json({device_limit:['Try another device count.']}, {status:400});
    }),
  );
  renderStore('/s/wuse-hotspot/checkout/1');
  await userEvent.selectOptions(await screen.findByLabelText('Devices per voucher'), '2');
  await userEvent.type(screen.getByLabelText(/Email address/), 'buyer@example.com');
  await userEvent.click(screen.getByRole('button', {name:/Continue to payment/}));
  await screen.findByText('Try another device count.');
  await userEvent.selectOptions(screen.getByLabelText('Devices per voucher'), '3');
  await userEvent.click(screen.getByRole('button', {name:/Continue to payment/}));
  await waitFor(()=>expect(keys).toHaveLength(2));
  expect(keys[0]).not.toBe(keys[1]);
});


describe('public IoT checkout', () => {
  it('retains the original request and payment reference after uncertain initialization', async () => {
    const requests: { key: string | null; body: unknown }[] = [];
    server.use(http.post(`${API}/buy/iot/`, async ({ request }) => {
      requests.push({ key: request.headers.get('Idempotency-Key'), body: await request.json() });
      return HttpResponse.json({ detail: 'Check original payment.', reference: 'iot-safe-reference' }, { status: 503 });
    }));
    renderWithProviders(<IoTCheckout plan={{ ...plans[0]!, plan_type: 'iot_mac' }} slug="wuse-hotspot" />);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'iot@example.test');
    await user.type(screen.getByRole('textbox', { name: 'Device name' }), 'Camera');
    await user.type(screen.getByRole('textbox', { name: 'MAC address' }), 'AA:BB:CC:DD:EE:FF');
    await user.click(screen.getByRole('button', { name: /^Pay / }));
    expect(await screen.findByRole('link', { name: 'Check this payment' })).toHaveAttribute('href', '/pay/result?reference=iot-safe-reference');
    expect(screen.getByRole('textbox', { name: 'MAC address' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry same purchase' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0]?.key).toBeTruthy();
    expect(requests[1]).toEqual(requests[0]);
    expect(pendingCheckout.load()?.kind).toBe('iot');
  });

  it('shows the renewal capability for a fulfilled device without claiming a voucher', async () => {
    server.use(http.get(`${API}/payments/callback/`, () => HttpResponse.json({
      kind: 'iot', status: 'success', fulfilled: true, payment_verified: true,
      reference: 'iot-paid', voucher: null, access_code: null, code_revealed: false,
      device_status: 'suspended', expires_at: '2030-01-01T00:00:00Z', renewal_token: 'private-renewal-token',
    })));
    renderStore('/pay/result?reference=iot-paid');
    expect(await screen.findByLabelText('Renewal token')).toHaveValue('private-renewal-token');
    expect(screen.getByText(/Registration status: suspended/)).toBeInTheDocument();
    expect(screen.queryByText('Your voucher has been issued.')).not.toBeInTheDocument();
  });
});
