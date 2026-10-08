import { dhcpRangeProblem, isIpv4, lanGatewayProblem, parseCidr } from '@/lib/network/ipv4';

/** Form values for POST /routers/register/ (the payload shape is unchanged; see buildRegisterPayload). */
export interface AddRouterValues {
  name: string;
  hotspot_interface: string;
  location: string;
  nas_identifier: string;
  model: string;
  routeros_version: string;
  notes: string;
  /** true: Yarotech creates the customer network and HotSpot; false: connect an existing HotSpot. */
  complete_hotspot_setup: boolean;
  hotspot_profile: string;
  gateway_cidr: string;
  network_mode: 'create' | 'reuse';
  reuse_pool: string;
  reuse_dhcp: string;
  custom_dhcp: boolean;
  dhcp_range: string;
  dns_servers: string;
  hotspot_dns_name: string;
  reuse_hotspot: string;
  nat_mode: 'existing' | 'interface' | 'interface-list';
  wan_interface: string;
  network_reviewed: boolean;
}

export const DEFAULT_LAN = '10.20.0.1/24';

export const ADD_ROUTER_DEFAULTS: AddRouterValues = {
  name: '',
  hotspot_interface: '',
  location: '',
  nas_identifier: '',
  model: '',
  routeros_version: '',
  notes: '',
  complete_hotspot_setup: true,
  hotspot_profile: '',
  gateway_cidr: DEFAULT_LAN,
  network_mode: 'create',
  reuse_pool: '',
  reuse_dhcp: '',
  custom_dhcp: false,
  dhcp_range: '',
  dns_servers: '1.1.1.1,8.8.8.8',
  hotspot_dns_name: 'login.hotspot.lan',
  reuse_hotspot: '',
  nat_mode: 'existing',
  wan_interface: '',
  network_reviewed: false,
};

export type AddRouterField = keyof AddRouterValues;

/** Which wizard step owns each field; used to validate a step and to jump to server errors. */
export const STEP_FIELDS: readonly (readonly AddRouterField[])[] = [
  ['name', 'hotspot_interface', 'location', 'nas_identifier', 'model', 'routeros_version', 'notes'],
  [
    'complete_hotspot_setup',
    'hotspot_profile',
    'gateway_cidr',
    'network_mode',
    'reuse_pool',
    'reuse_dhcp',
    'custom_dhcp',
    'dhcp_range',
    'dns_servers',
    'hotspot_dns_name',
    'reuse_hotspot',
    'nat_mode',
    'wan_interface',
  ],
  ['network_reviewed'],
];

export const ADVANCED_ROUTER_FIELDS: readonly AddRouterField[] = [
  'nas_identifier',
  'model',
  'routeros_version',
  'notes',
];
export const ADVANCED_NETWORK_FIELDS: readonly AddRouterField[] = [
  'network_mode',
  'reuse_pool',
  'reuse_dhcp',
  'custom_dhcp',
  'dhcp_range',
  'dns_servers',
  'hotspot_dns_name',
  'reuse_hotspot',
  'nat_mode',
  'wan_interface',
];

export function stepOf(field: string): number {
  const index = STEP_FIELDS.findIndex((fields) => (fields as readonly string[]).includes(field));
  return index === -1 ? 2 : index;
}

const NAME = /^[A-Za-z0-9 ._:-]{1,64}$/;
const NAS = /^[A-Za-z0-9._:-]{1,120}$/;
const OBJECT = /^[A-Za-z0-9._-]{1,64}$/;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9 +_.-]{0,79}$/;
const ROUTEROS = /^[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:[A-Za-z0-9.-]*)?$/;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const exactName = (what: string) =>
  `Use the exact ${what} name: letters, digits, dot, dash or underscore.`;

/** All rules in one place; mirrors the backend RegistrationSerializer so errors appear before submit. */
export function validateAddRouter(
  values: AddRouterValues,
): Partial<Record<AddRouterField, string>> {
  const errors: Partial<Record<AddRouterField, string>> = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Give the router a name.';
  else if (!NAME.test(name))
    errors.name = 'Use up to 64 letters, numbers, spaces, dots, dashes, colons or underscores.';
  const port = values.hotspot_interface.trim();
  if (!port)
    errors.hotspot_interface = 'Enter the port customers connect to, exactly as WinBox shows it.';
  else if (!OBJECT.test(port)) errors.hotspot_interface = exactName('interface');
  if (values.location.trim().length > 200) errors.location = 'At most 200 characters.';
  if (values.nas_identifier.trim() && !NAS.test(values.nas_identifier.trim()))
    errors.nas_identifier = 'Use 1–120 letters, numbers, dots, dashes, colons or underscores.';
  if (values.model.trim() && !MODEL.test(values.model.trim()))
    errors.model = 'Enter the model as shown on the router.';
  if (values.routeros_version.trim() && !ROUTEROS.test(values.routeros_version.trim()))
    errors.routeros_version = 'Enter an exact RouterOS version, for example 7.20.1.';
  if (values.notes.length > 2000) errors.notes = 'At most 2000 characters.';

  if (!values.complete_hotspot_setup) {
    const profile = values.hotspot_profile.trim();
    if (!profile)
      errors.hotspot_profile = 'Enter the name of the HotSpot profile already on the router.';
    else if (!OBJECT.test(profile)) errors.hotspot_profile = exactName('profile');
  } else {
    const gatewayProblem = lanGatewayProblem(values.gateway_cidr);
    if (gatewayProblem) errors.gateway_cidr = gatewayProblem;
    if (values.custom_dhcp) {
      const problem = dhcpRangeProblem(values.dhcp_range, values.gateway_cidr);
      if (problem) errors.dhcp_range = problem;
    }
    const gatewayIp = parseCidr(values.gateway_cidr)?.ip;
    const dns = values.dns_servers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const badDns = (s: string) => {
      if (!isIpv4(s) || s === '0.0.0.0' || s === gatewayIp) return true;
      const first = Number(s.split('.')[0]);
      return first === 127 || (first >= 224 && first <= 239);
    };
    if (dns.length < 1 || dns.length > 3 || dns.some(badDns))
      errors.dns_servers =
        'Enter 1–3 internet DNS addresses separated by commas, e.g. 1.1.1.1,8.8.8.8.';
    const domain = values.hotspot_dns_name.trim().toLowerCase();
    if (
      domain.length > 253 ||
      !domain.includes('.') ||
      !domain.split('.').every((l) => DNS_LABEL.test(l))
    )
      errors.hotspot_dns_name = 'Enter a local name with a dot, for example login.hotspot.lan.';
    if (values.network_mode === 'reuse') {
      if (!values.reuse_pool.trim()) errors.reuse_pool = 'Enter the existing address pool name.';
      else if (!OBJECT.test(values.reuse_pool.trim())) errors.reuse_pool = exactName('pool');
      if (!values.reuse_dhcp.trim()) errors.reuse_dhcp = 'Enter the existing DHCP server name.';
      else if (!OBJECT.test(values.reuse_dhcp.trim())) errors.reuse_dhcp = exactName('DHCP server');
    }
    if (values.reuse_hotspot.trim() && !OBJECT.test(values.reuse_hotspot.trim()))
      errors.reuse_hotspot = exactName('HotSpot server');
    if (values.nat_mode !== 'existing') {
      const wan = values.wan_interface.trim();
      if (!wan) errors.wan_interface = 'Enter the internet (WAN) interface or interface-list name.';
      else if (!OBJECT.test(wan)) errors.wan_interface = exactName('WAN');
      else if (wan === port)
        errors.wan_interface = 'The internet port must differ from the customer port.';
    }
  }
  if (!values.network_reviewed)
    errors.network_reviewed = 'Confirm the router and network details are correct.';
  return errors;
}

export function buildRegisterPayload(values: AddRouterValues): Record<string, string | boolean> {
  const payload: Record<string, string | boolean> = {
    name: values.name.trim(),
    nas_identifier: values.nas_identifier.trim(),
    hotspot_interface: values.hotspot_interface.trim(),
    hotspot_profile: values.complete_hotspot_setup ? '' : values.hotspot_profile.trim(),
    location: values.location.trim(),
    model: values.model.trim(),
    routeros_version: values.routeros_version.trim(),
    notes: values.notes,
    complete_hotspot_setup: values.complete_hotspot_setup,
    network_reviewed: values.network_reviewed,
    dhcp_range_mode: values.custom_dhcp ? 'custom' : 'automatic',
  };
  if (values.complete_hotspot_setup) {
    payload.network_mode = values.network_mode;
    payload.gateway_cidr = values.gateway_cidr.trim();
    if (values.custom_dhcp) payload.dhcp_range = values.dhcp_range.trim();
    payload.dns_servers = values.dns_servers.trim();
    payload.hotspot_dns_name = values.hotspot_dns_name.trim().toLowerCase();
    if (values.network_mode === 'reuse') {
      payload.reuse_pool = values.reuse_pool.trim();
      payload.reuse_dhcp = values.reuse_dhcp.trim();
    }
    payload.reuse_hotspot = values.reuse_hotspot.trim();
    payload.nat_mode = values.nat_mode;
    if (values.nat_mode !== 'existing') payload.wan_interface = values.wan_interface.trim();
  }
  return payload;
}
