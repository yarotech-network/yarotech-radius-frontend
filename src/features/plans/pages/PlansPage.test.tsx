import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/server';
import { API, paginated } from '@/test/fixtures';
import { renderPage } from '@/test/renderPage';
import type { InternetPlan } from '@/types/api';
import PlansPage from './PlansPage';
import PPPoEPlansPage from './PPPoEPlansPage';

const plans: InternetPlan[] = [
  {
    id: 1,
    name: 'Daily 1GB',
    price: 50000,
    price_display: '₦500',
    duration_hours: 24,
    rate_limit: '5M/10M',
    data_limit: 1024,
    voucher_prefix: 'WH',
    is_active: true,
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 2,
    name: 'Weekly Unlimited',
    price: 250000,
    price_display: '₦2,500',
    duration_hours: 168,
    rate_limit: '10M/20M',
    data_limit: 0,
    voucher_prefix: '',
    is_active: false,
    created_at: '2026-09-02T10:00:00Z',
  },
];

async function nextPlanStep(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(within(dialog).getByText('Step 2 of 2: Access and availability')).toBeInTheDocument());
}

describe('PlansPage', () => {
  it('shows a skeleton, then the plan list with filters reflected in the query string', async () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${API}/plans/`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json(paginated(plans));
      }),
    );
    renderPage(<PlansPage />, { role: 'manager', path: '/plans' });
    expect(screen.getByRole('heading', { name: 'Hotspot Plans' })).toBeInTheDocument();
    // DataTable renders a table (≥md) and a card list (<md); assert inside the table.
    const table = await screen.findByRole('table', { name: 'Internet plans' });
    expect(await within(table).findByText('Daily 1GB')).toBeInTheDocument();
    expect(within(table).getByText('Weekly Unlimited')).toBeInTheDocument();
    expect(within(table).getByText('Inactive')).toBeInTheDocument();
    expect(seen[0]?.searchParams.get('ordering')).toBe('price');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'true');
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('is_active')).toBe('true'));
    await userEvent.type(screen.getByLabelText('Search plans'), 'week');
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('search')).toBe('week'), {
      timeout: 2000,
    });
  });

  it('renders an error state with retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/plans/`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { problem: { code: 'http_503', message: 'Database unavailable' } },
              { status: 503 },
            )
          : HttpResponse.json(paginated(plans));
      }),
    );
    renderPage(<PlansPage />, { path: '/plans' });
    expect(await screen.findByText(/Database unavailable/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findAllByText('Daily 1GB')).not.toHaveLength(0);
  });

  it('staff see no management actions; managers can create a plan (with field errors mapped)', async () => {
    server.use(http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))));
    const { unmount } = renderPage(<PlansPage />, { role: 'staff', path: '/plans' });
    expect(await screen.findByText('No plans yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New plan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View storefront' })).not.toBeInTheDocument();
    unmount();

    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API}/plans/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        if (posted.name === 'dup')
          return HttpResponse.json(
            {
              problem: {
                code: 'validation_error',
                message: 'Invalid input.',
                fields: { name: ['Plan with this name already exists.'] },
              },
            },
            { status: 400 },
          );
        return HttpResponse.json(
          { ...plans[0]!, id: 9, name: String(posted.name) },
          { status: 201 },
        );
      }),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    await userEvent.click(await screen.findByRole('button', { name: 'Create a plan' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Plan name/), 'dup');
    await userEvent.type(within(dialog).getByLabelText(/Price/), '500');
    await nextPlanStep(dialog);
    await userEvent.click(within(dialog).getByText('Additional settings'));
    await userEvent.selectOptions(within(dialog).getByLabelText('Voucher code format'), 'numeric');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    expect(
      await within(dialog).findByText('Plan with this name already exists.'),
    ).toBeInTheDocument();
    // A server error on a first-step field returns to that step.
    await userEvent.clear(within(dialog).getByLabelText(/Plan name/));
    await userEvent.type(within(dialog).getByLabelText(/Plan name/), 'Night Owl');
    await userEvent.clear(within(dialog).getByLabelText(/Duration amount/));
    await userEvent.type(within(dialog).getByLabelText(/Duration amount/), '0.5');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Duration unit/), 'hours');
    await nextPlanStep(dialog);
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Public sales/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Agent sales/ }));
    await userEvent.click(within(dialog).getByText('Additional settings'));
    await userEvent.selectOptions(within(dialog).getByLabelText('Voucher code format'), 'numeric');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posted).toMatchObject({
      name: 'Night Owl',
      voucher_code_format: 'numeric',
      price: 50000,
      duration_hours: 0.5,
      is_public: false,
      agent_enabled: false,
      rate_limit: '5000k/10000k',
      bandwidth_profile: null,
      data_limit: 0,
      is_active: true,
    });
    expect(await screen.findByText('Plan created')).toBeInTheDocument();
  });
  it('shows authoritative prices and preserves rows after a failed refresh', async () => {
    const user = userEvent.setup();
    server.use(http.get(`${API}/plans/`, () => HttpResponse.json(paginated(plans))));
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    const table = await screen.findByRole('table', { name: 'Internet plans' });
    expect(await within(table).findByText('Daily 1GB')).toBeInTheDocument();
    expect(within(table).getByText('\u20a6500.00')).toBeInTheDocument();
    expect(within(table).getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Build your internet catalogue')).not.toBeInTheDocument();
    expect(screen.getByText('2 total plans')).toBeInTheDocument();
    server.use(
      http.get(`${API}/plans/`, () =>
        HttpResponse.json({ detail: 'Unavailable' }, { status: 503 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh plans' }));
    expect(await screen.findByText('Plans could not be refreshed')).toBeInTheDocument();
    expect(within(table).getByText('Daily 1GB')).toBeInTheDocument();
  });
});

it('archives a plan and exposes its retained read-only history', async () => {
  let archived = false;
  server.use(
    http.get(`${API}/plans/`, ({ request }) => {
      const history = new URL(request.url).searchParams.get('archived') === 'true';
      return HttpResponse.json(
        paginated(
          history
            ? archived
              ? [{ ...plans[0]!, is_active: false, archived_at: '2026-09-14T10:00:00Z' }]
              : []
            : archived
              ? []
              : [plans[0]!],
        ),
      );
    }),
    http.delete(`${API}/plans/1/`, () => {
      archived = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
  const table = await screen.findByRole('table', { name: 'Internet plans' });
  await userEvent.click(
    await within(table).findByRole('button', { name: 'Actions for Daily 1GB' }),
  );
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Archive' }));
  const dialog = await screen.findByRole('dialog', { name: 'Archive Daily 1GB?' });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Archive plan' }));
  expect(await screen.findByText('Plan archived')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'archived');
  const history = await screen.findByRole('table', { name: 'Internet plans' });
  expect(await within(history).findByText('Archived')).toBeInTheDocument();
  expect(within(history).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
});

it('creates a plan with a device ceiling and edits it 1 -> 5 -> 2', async () => {
  let posted: Record<string, unknown> | null = null;
  let patched: Record<string, unknown> | null = null;
  server.use(
    http.get(`${API}/plans/`, () =>
      HttpResponse.json(paginated([{ ...plans[0]!, max_devices: 1 }])),
    ),
    http.post(`${API}/plans/`, async ({ request }) => {
      posted = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        { ...plans[0]!, id: 9, max_devices: posted.max_devices ?? 1 },
        { status: 201 },
      );
    }),
    http.patch(`${API}/plans/9/`, async ({ request }) => {
      patched = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...plans[0]!, id: 9, max_devices: patched.max_devices ?? 1 });
    }),
  );
  renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
  await userEvent.click(await screen.findByRole('button', { name: 'New plan' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText(/Plan name/), 'Family');
  await userEvent.type(within(dialog).getByLabelText(/Price/), '1000');
  await nextPlanStep(dialog);
  const select = within(dialog).getByLabelText('Maximum devices') as HTMLSelectElement;
  expect(select.value).toBe('1');
  expect(Array.from(select.options).map((o) => o.text)).toEqual([
    '1 device',
    '2 devices',
    '3 devices',
    '4 devices',
    '5 devices',
    '6 devices',
    '7 devices',
    '8 devices',
    '9 devices',
    '10 devices',
  ]);
  await userEvent.selectOptions(select, '5');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }));
  await waitFor(() => expect(posted).toMatchObject({ name: 'Family', max_devices: 5 }));
  expect(await screen.findByText('Plan created')).toBeInTheDocument();
});

it('edit populates the stored ceiling and persists a new value', async () => {
  let patched: Record<string, unknown> | null = null;
  server.use(
    http.get(`${API}/plans/`, () =>
      HttpResponse.json(paginated([{ ...plans[0]!, max_devices: 1, configured_max_devices: 5 }])),
    ),
    http.patch(`${API}/plans/1/`, async ({ request }) => {
      patched = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...plans[0]!, max_devices: 1, configured_max_devices: patched.max_devices ?? 5 });
    }),
  );
  renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
  const table = await screen.findByRole('table', { name: 'Internet plans' });
  await within(table).findByText('Daily 1GB');
  await userEvent.click(within(table).getByRole('button', { name: 'Actions for Daily 1GB' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog');
  await nextPlanStep(dialog);
  const select = within(dialog).getByLabelText('Maximum devices') as HTMLSelectElement;
  expect(select.value).toBe('5');
  expect(within(dialog).getByText(/Platform policy currently limits new vouchers to 1/)).toBeInTheDocument();
  await userEvent.selectOptions(select, '2');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(patched).toMatchObject({ max_devices: 2 }));
  expect(await screen.findByText('Plan updated')).toBeInTheDocument();
});

it('keeps step two open when choosing the maximum-device option or pressing Enter', async () => {
  let patched = 0;
  server.use(
    http.get(`${API}/plans/`, () => HttpResponse.json(paginated([{ ...plans[0]!, max_devices: 1 }]))),
    http.patch(`${API}/plans/1/`, () => { patched += 1; return HttpResponse.json(plans[0]!); }),
  );
  renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
  const table = await screen.findByRole('table', { name: 'Internet plans' });
  await within(table).findByText('Daily 1GB');
  await userEvent.click(within(table).getByRole('button', { name: 'Actions for Daily 1GB' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Daily 1GB' });
  await nextPlanStep(dialog);
  const select = within(dialog).getByLabelText('Maximum devices');
  await userEvent.selectOptions(select, '5');
  fireEvent.click(dialog);
  select.focus();
  await userEvent.keyboard('{Enter}');
  expect(select).toHaveValue('5');
  expect(screen.getByRole('dialog', { name: 'Edit Daily 1GB' })).toBeInTheDocument();
  expect(patched).toBe(0);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(patched).toBe(1));
});

it('requires Next before saving and keeps the first step editable', async () => {
  let posts = 0;
  server.use(
    http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
    http.post(`${API}/plans/`, () => { posts += 1; return HttpResponse.json({ ...plans[0]!, id: 9 }, { status: 201 }); }),
  );
  renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
  await userEvent.click(await screen.findByRole('button', { name: 'New plan' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
  expect(await within(dialog).findByText('Give the plan a name')).toBeInTheDocument();
  expect(posts).toBe(0);
  await userEvent.type(within(dialog).getByLabelText(/Plan name/), 'Two step');
  await userEvent.type(within(dialog).getByLabelText(/Price/), '200');
  await nextPlanStep(dialog);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
  expect(within(dialog).getByLabelText(/Plan name/)).toHaveValue('Two step');
  expect(posts).toBe(0);
});

describe('PlanDialog behavior', () => {
  it('creates a 3-day limited plan in a single-column form without a preview', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/plans/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...plans[0]!, id: 9 }, { status: 201 });
      }),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    await userEvent.click(await screen.findByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create New Hotspot Plan' });
    expect(within(dialog).queryByLabelText(/Data limit/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Plan summary')).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Plan name/), 'Weekend');
    await userEvent.type(within(dialog).getByLabelText(/Price/), '750');
    await userEvent.clear(within(dialog).getByLabelText(/Duration amount/));
    await userEvent.type(within(dialog).getByLabelText(/Duration amount/), '3');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Duration unit/), 'days');
    await userEvent.click(within(dialog).getByLabelText('Limited data'));
    await userEvent.type(within(dialog).getByLabelText(/Data limit/), '1024');
    await nextPlanStep(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    await waitFor(() =>
      expect(posted).toMatchObject({ duration_hours: 72, data_limit: 1024 }),
    );
    expect(await screen.findByText('Plan created')).toBeInTheDocument();
  });

  it('saves an existing fractional plan unchanged without altering its duration', async () => {
    let patched: Record<string, unknown> | null = null;
    const fractional = { ...plans[0]!, duration_hours: 0.333333, data_limit: 512 };
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([fractional]))),
      http.patch(`${API}/plans/1/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(fractional);
      }),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    const table = await screen.findByRole('table', { name: 'Internet plans' });
    await within(table).findByText('Daily 1GB');
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Daily 1GB' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Daily 1GB' });
    expect(within(dialog).getByLabelText(/Duration amount/)).toHaveValue(20);
    expect(within(dialog).getByLabelText(/Duration unit/)).toHaveValue('minutes');
    expect(within(dialog).getByLabelText('Limited data')).toBeChecked();
    await nextPlanStep(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(patched).toMatchObject({ duration_hours: 0.333333, data_limit: 512 }),
    );
    expect(await screen.findByText('Plan updated')).toBeInTheDocument();
  });

  it('confirms before discarding a changed plan', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))));
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    await user.click(await screen.findByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create New Hotspot Plan' });
    await user.type(within(dialog).getByLabelText(/Plan name/), 'Draft plan');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const confirm = await screen.findByRole('dialog', { name: 'Discard new plan?' });
    await user.click(within(confirm).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('dialog', { name: 'Create New Hotspot Plan' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Plan name/)).toHaveValue('Draft plan');
    await user.click(
      within(screen.getByRole('dialog', { name: 'Create New Hotspot Plan' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    const confirmAgain = await screen.findByRole('dialog', { name: 'Discard new plan?' });
    await user.click(within(confirmAgain).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('blocks dismissal while saving', async () => {
    const user = userEvent.setup({ delay: null });
    let resolvePost!: (value: unknown) => void;
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
      http.post(
        `${API}/plans/`,
        () =>
          new Promise((resolve) => {
            resolvePost = resolve as (value: unknown) => void;
          }),
      ),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    await user.click(await screen.findByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create New Hotspot Plan' });
    await user.type(within(dialog).getByLabelText(/Plan name/), 'Saving plan');
    await user.type(within(dialog).getByLabelText(/Price/), '500');
    await nextPlanStep(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Create plan' })).toBeDisabled(),
    );
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.queryByRole('dialog', { name: 'Discard new plan?' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Create New Hotspot Plan' })).toBeInTheDocument();
    resolvePost(HttpResponse.json({ ...plans[0]!, id: 9 }, { status: 201 }));
    expect(await screen.findByText('Plan created')).toBeInTheDocument();
  });

  it('expands Additional settings and focuses a server field error there', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/plans/`, () =>
        HttpResponse.json(
          {
            problem: {
              code: 'validation_error',
              message: 'Invalid input.',
              fields: { voucher_prefix: ['Enter a shorter prefix.'] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    const { container } = renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    await user.click(await screen.findByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create New Hotspot Plan' });
    await user.type(within(dialog).getByLabelText(/Plan name/), 'Prefixed');
    await user.type(within(dialog).getByLabelText(/Price/), '500');
    await nextPlanStep(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    expect(await within(dialog).findByText('Enter a shorter prefix.')).toBeInTheDocument();
    await waitFor(() =>
      expect(container.querySelector('details.plan-advanced')).toHaveAttribute('open'),
    );
    await waitFor(() =>
      expect(within(dialog).getByLabelText(/Voucher prefix/)).toHaveFocus(),
    );
  });
});

describe('PlanDialog speeds', () => {
  it('creates a plan with converted upload/download speeds and no profile link', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/plans/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...plans[0]!, id: 9 }, { status: 201 });
      }),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    await userEvent.click(await screen.findByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create New Hotspot Plan' });
    expect(within(dialog).queryByRole('button', { name: 'Use bandwidth profile' })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Bandwidth profile')).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Plan name/), 'Speedy');
    await userEvent.type(within(dialog).getByLabelText(/Price/), '500');
    await nextPlanStep(dialog);
    expect(within(dialog).getByLabelText('Upload speed amount')).toHaveValue('5');
    expect(within(dialog).getByLabelText('Download speed amount')).toHaveValue('10');
    await userEvent.clear(within(dialog).getByLabelText('Upload speed amount'));
    await userEvent.type(within(dialog).getByLabelText('Upload speed amount'), '1');
    await userEvent.selectOptions(within(dialog).getByLabelText('Upload speed unit'), 'Gbps');
    await userEvent.clear(within(dialog).getByLabelText('Download speed amount'));
    await userEvent.type(within(dialog).getByLabelText('Download speed amount'), '2.5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    await waitFor(() =>
      expect(posted).toMatchObject({
        rate_limit: '1000000k/2500k',
        bandwidth_profile: null,
      }),
    );
    expect(await screen.findByText('Plan created')).toBeInTheDocument();
  });

  it('edits a profile-linked plan and detaches the profile on save', async () => {
    let patched: Record<string, unknown> | null = null;
    const linked = { ...plans[0]!, bandwidth_profile: 7, bandwidth_profile_name: 'Gold' };
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([linked]))),
      http.patch(`${API}/plans/1/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(linked);
      }),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    const table = await screen.findByRole('table', { name: 'Internet plans' });
    await within(table).findByText('Daily 1GB');
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Daily 1GB' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Daily 1GB' });
    await nextPlanStep(dialog);
    expect(within(dialog).getByLabelText('Upload speed amount')).toHaveValue('5');
    expect(within(dialog).getByLabelText('Download speed amount')).toHaveValue('10');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(patched).toMatchObject({ bandwidth_profile: null, rate_limit: '5000k/10000k' }),
    );
    expect(await screen.findByText('Plan updated')).toBeInTheDocument();
  });

  it('preserves a complex stored expression until explicitly replaced', async () => {
    let patched: Record<string, unknown> | null = null;
    const complex = { ...plans[0]!, rate_limit: '5M/10M 1M/2M' };
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([complex]))),
      http.patch(`${API}/plans/1/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(complex);
      }),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    const table = await screen.findByRole('table', { name: 'Internet plans' });
    await within(table).findByText('Daily 1GB');
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Daily 1GB' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Daily 1GB' });
    await nextPlanStep(dialog);
    expect(await within(dialog).findByText(/cannot represent/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Upload speed amount')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(patched).toMatchObject({ rate_limit: '5M/10M 1M/2M', bandwidth_profile: null }),
    );
    expect(await screen.findByText('Plan updated')).toBeInTheDocument();
  });

  it('replaces a complex expression with upload/download values on request', async () => {
    let patched: Record<string, unknown> | null = null;
    const complex = { ...plans[0]!, rate_limit: '5M/10M 1M/2M' };
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([complex]))),
      http.patch(`${API}/plans/1/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(complex);
      }),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    const table = await screen.findByRole('table', { name: 'Internet plans' });
    await within(table).findByText('Daily 1GB');
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Daily 1GB' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Daily 1GB' });
    await nextPlanStep(dialog);
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Enter upload and download speeds' }),
    );
    await userEvent.type(await within(dialog).findByLabelText('Upload speed amount'), '5');
    await userEvent.type(within(dialog).getByLabelText('Download speed amount'), '10');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(patched).toMatchObject({ rate_limit: '5000k/10000k' }));
    expect(await screen.findByText('Plan updated')).toBeInTheDocument();
  });

  it('keeps an unchanged decimal-unit plan at its effective speeds', async () => {
    let patched: Record<string, unknown> | null = null;
    const decimal = { ...plans[0]!, rate_limit: '2500k/10000k' };
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([decimal]))),
      http.patch(`${API}/plans/1/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(decimal);
      }),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    const table = await screen.findByRole('table', { name: 'Internet plans' });
    await within(table).findByText('Daily 1GB');
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Daily 1GB' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Daily 1GB' });
    await nextPlanStep(dialog);
    expect(within(dialog).getByLabelText('Upload speed amount')).toHaveValue('2.5');
    expect(within(dialog).getByLabelText('Upload speed unit')).toHaveValue('Mbps');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(patched).toMatchObject({ rate_limit: '2500k/10000k' }));
    expect(await screen.findByText('Plan updated')).toBeInTheDocument();
  });

  it('allows blank speeds for no limit but rejects only one side blank', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/plans/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...plans[0]!, id: 9 }, { status: 201 });
      }),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    await userEvent.click(await screen.findByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create New Hotspot Plan' });
    await userEvent.type(within(dialog).getByLabelText(/Plan name/), 'No limit');
    await userEvent.type(within(dialog).getByLabelText(/Price/), '100');
    await nextPlanStep(dialog);
    await userEvent.clear(within(dialog).getByLabelText('Upload speed amount'));
    await userEvent.clear(within(dialog).getByLabelText('Download speed amount'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(posted).toMatchObject({ rate_limit: '' }));
    expect(await screen.findByText('Plan created')).toBeInTheDocument();
  });

  it('rejects a one-sided blank and an over-limit speed', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))));
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    await user.click(await screen.findByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create New Hotspot Plan' });
    await user.type(within(dialog).getByLabelText(/Plan name/), 'Speed check');
    await user.type(within(dialog).getByLabelText(/Price/), '100');
    await nextPlanStep(dialog);
    await user.clear(within(dialog).getByLabelText('Download speed amount'));
    await user.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    expect(
      await within(dialog).findByText(/Enter both upload and download speeds/),
    ).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Upload speed amount'));
    await user.type(within(dialog).getByLabelText('Upload speed amount'), '11');
    await user.selectOptions(within(dialog).getByLabelText('Upload speed unit'), 'Gbps');
    await user.type(within(dialog).getByLabelText('Download speed amount'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    expect(await within(dialog).findByText(/1 Kbps to 10 Gbps/)).toBeInTheDocument();
  });

  it('maps a backend rate_limit error onto the upload control', async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      http.get(`${API}/plans/`, () => HttpResponse.json(paginated([]))),
      http.post(`${API}/plans/`, () =>
        HttpResponse.json(
          {
            problem: {
              code: 'validation_error',
              message: 'Invalid input.',
              fields: { rate_limit: ['Speed must match the selected profile.'] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    await user.click(await screen.findByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create New Hotspot Plan' });
    await user.type(within(dialog).getByLabelText(/Plan name/), 'Speedy');
    await user.type(within(dialog).getByLabelText(/Price/), '500');
    await nextPlanStep(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    expect(
      await within(dialog).findByText('Speed must match the selected profile.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Create New Hotspot Plan' })).toBeInTheDocument();
  });
});

describe('PPPoE plans navigation', () => {
  it('keeps both section tabs and the bandwidth route available', async () => {
    server.use(http.get(`${API}/pppoe-plans/`, () => HttpResponse.json(paginated([]))));
    renderPage(<PPPoEPlansPage />, { role: 'owner', path: '/plans/pppoe' });
    await screen.findByRole('heading', { name: 'PPPoE Plans' });
    expect(screen.getByRole('link', { name: 'Hotspot plans' })).toHaveAttribute('href', '/plans');
    expect(screen.getByRole('link', { name: 'Bandwidth control' })).toHaveAttribute(
      'href',
      '/plans/bandwidth',
    );
  });
});

describe('Hotspot plans navigation', () => {
  it('shows no Bandwidth Control tab, profiles link, or profile labels', async () => {
    server.use(http.get(`${API}/plans/`, () => HttpResponse.json(paginated(plans))));
    renderPage(<PlansPage />, { role: 'owner', path: '/plans' });
    const table = await screen.findByRole('table', { name: 'Internet plans' });
    await within(table).findByText('Daily 1GB');
    expect(screen.queryByRole('link', { name: 'Bandwidth profiles' })).not.toBeInTheDocument();
    expect(screen.queryByText('Bandwidth control')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom speed')).not.toBeInTheDocument();
    expect(screen.queryByText(/Profile:/)).not.toBeInTheDocument();
  });
});

beforeEach(() => {
  server.use(http.get(`${API}/dashboard/stats/`, () => HttpResponse.json({}, { status: 503 })));
});
