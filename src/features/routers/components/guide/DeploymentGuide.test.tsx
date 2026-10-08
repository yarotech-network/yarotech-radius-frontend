import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADD_ROUTER_DEFAULTS, validateAddRouter, type AddRouterValues } from '../addRouter/model';
import { DeploymentGuide } from './DeploymentGuide';
import { DEPLOYMENT_GUIDES } from './deploymentGuides';

/** Applies a guide's "Enter" values the way a person would fill the Add router form. */
function formValues(fields: [string, string][]): AddRouterValues {
  const values: AddRouterValues = {
    ...ADD_ROUTER_DEFAULTS,
    name: 'Guide router',
    network_reviewed: true,
  };
  for (const [label, value] of fields) {
    if (label === 'Customer port') values.hotspot_interface = value;
    else if (label === 'Customer network (gateway)') values.gateway_cidr = value;
    else if (label === 'Advanced → DHCP setup')
      values.network_mode = value.startsWith('Reuse') ? 'reuse' : 'create';
    else if (label === 'Existing address pool') values.reuse_pool = value;
    else if (label === 'Existing DHCP server') values.reuse_dhcp = value;
    else if (label === 'How should Yarotech set up this router?')
      values.complete_hotspot_setup = value === 'Set up a new HotSpot';
    else if (label === 'Internet sharing (NAT)') values.nat_mode = 'existing';
    else if (label === 'Existing HotSpot profile') values.hotspot_profile = value;
    else throw new Error(`Unmapped guide field: ${label}`);
  }
  return values;
}

describe('Deployment guides', () => {
  it.each(DEPLOYMENT_GUIDES.map((guide) => [guide.id, guide] as const))(
    'the %s guide gives values the Add router form accepts',
    (_, guide) => {
      const fields = guide.steps.flatMap((step) => step.fields ?? []);
      expect(fields.length).toBeGreaterThan(0);
      expect(validateAddRouter(formValues(fields))).toEqual({});
    },
  );

  it('switches between the default and WAVLINK guides', async () => {
    render(<DeploymentGuide />);
    const steps = () => screen.getByRole('list', { name: /steps$/ });
    expect(within(steps()).getByText('192.168.88.1/24', { selector: 'code' })).toBeInTheDocument();
    expect(within(steps()).getByText('defconf', { selector: 'code' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Custom: WAVLINK on ether2/ }));
    const wiring = screen.getByRole('region', { name: 'Wiring' });
    expect(within(wiring).getByText('WAVLINK access point (customers)')).toBeInTheDocument();
    expect(within(wiring).getByText('Your laptop (management)')).toBeInTheDocument();
    expect(within(steps()).getByText('ether2', { selector: 'code' })).toBeInTheDocument();
    expect(
      within(steps()).getByText(/\/interface bridge port remove \[find interface=ether2\]/),
    ).toBeInTheDocument();
    expect(within(steps()).getByText(/interface=wg-yarotech/)).toBeInTheDocument();
  });

  it('covers other layouts and common situations', async () => {
    render(<DeploymentGuide />);
    expect(screen.getAllByRole('radio')).toHaveLength(DEPLOYMENT_GUIDES.length);
    await userEvent.click(screen.getByRole('radio', { name: /Built-in Wi-Fi for customers/ }));
    const steps = screen.getByRole('list', { name: /steps$/ });
    expect(
      within(steps).getByText(/bridge port set \[find interface=wifi1\] bridge=bridge-hotspot/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Router already has a HotSpot/ }));
    expect(screen.getByText('hsprof1', { selector: 'code' })).toBeInTheDocument();
    const tips = screen.getByRole('region', { name: 'Good to know' });
    await userEvent.click(within(tips).getByText(/Internet over PPPoE/));
    expect(within(tips).getByText(/list=WAN interface=pppoe-out1/)).toBeVisible();
  });
});
