import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/feedback/Alert';
import { http } from '@/services/api/http';
import { errorMessage, isApiError } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type { NasDevice } from '@/types/api';
import { routerKeys } from '../queries';

export interface AddRouterValues {
  name: string;
  nas_identifier: string;
  hotspot_interface: string;
  hotspot_profile: string;
  location: string;
  model: string;
  routeros_version: string;
  notes: string;
  complete_hotspot_setup: boolean;
  network_mode: 'create' | 'reuse';
  gateway_cidr: string;
  custom_dhcp: boolean;
  dhcp_range: string;
  dns_servers: string;
  hotspot_dns_name: string;
  reuse_pool: string;
  reuse_dhcp: string;
  reuse_hotspot: string;
  nat_mode: 'existing' | 'interface' | 'interface-list';
  wan_interface: string;
  network_reviewed: boolean;
}

export const ADD_ROUTER_DEFAULTS: AddRouterValues = {
  name: '',
  nas_identifier: '',
  hotspot_interface: '',
  hotspot_profile: '',
  location: '',
  model: '',
  routeros_version: '',
  notes: '',
  complete_hotspot_setup: true,
  network_mode: 'create',
  gateway_cidr: '',
  custom_dhcp: false,
  dhcp_range: '',
  dns_servers: '1.1.1.1,8.8.8.8',
  hotspot_dns_name: 'login.hotspot.lan',
  reuse_pool: '',
  reuse_dhcp: '',
  reuse_hotspot: '',
  nat_mode: 'existing',
  wan_interface: '',
  network_reviewed: false,
};

const NAME_PATTERN = /^[A-Za-z0-9 ._:-]{1,64}$/;
const NAS_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
const OBJECT_NAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 +_.-]{0,79}$/;
const ROUTEROS_PATTERN = /^[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:[A-Za-z0-9.-]*)?$/;
const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function isValidIpv4(value: string): boolean {
  return IPV4_PATTERN.test(value);
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

function parseGateway(value: string): { ip: string; prefix: number } | null {
  const trimmed = value.trim();
  const match = /^([0-9.]+)\/([0-9]{1,2})$/.exec(trimmed);
  if (!match) return null;
  const ip = match[1] ?? '';
  const prefix = Number(match[2]);
  if (!isValidIpv4(ip) || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  return { ip, prefix };
}

function isPrivateNetwork(networkAddress: number, prefix: number): boolean {
  const privates: { base: number; prefix: number }[] = [
    { base: ipToNumber('10.0.0.0'), prefix: 8 },
    { base: ipToNumber('172.16.0.0'), prefix: 12 },
    { base: ipToNumber('192.168.0.0'), prefix: 16 },
  ];
  for (const p of privates) {
    const mask = p.prefix === 0 ? 0 : (0xffffffff << (32 - p.prefix)) >>> 0;
    const netMask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    // A network is private when its network address falls inside a private block
    // and its prefix is at least as specific as the block.
    if ((networkAddress & mask) === (p.base & mask) && prefix >= p.prefix) return true;
    void netMask;
  }
  return false;
}

function networkRange(ip: string, prefix: number): { network: number; broadcast: number } {
  const addr = ipToNumber(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (addr & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { network, broadcast };
}

export function validateAddRouterStep1(values: AddRouterValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Give the router a name.';
  else if (!NAME_PATTERN.test(name))
    errors.name = 'Use 1–64 characters: letters, numbers, space, dot, underscore, colon or dash.';

  const nas = values.nas_identifier.trim();
  if (nas && !NAS_PATTERN.test(nas))
    errors.nas_identifier =
      'Use 1–120 characters: letters, numbers, dot, underscore, colon or dash.';

  const iface = values.hotspot_interface.trim();
  if (!iface) errors.hotspot_interface = 'Enter the customer-facing HotSpot interface.';
  else if (!OBJECT_NAME_PATTERN.test(iface))
    errors.hotspot_interface =
      'Use the exact interface name: letters, digits, dot, dash or underscore.';

  const profile = values.hotspot_profile.trim();
  if (!values.complete_hotspot_setup && !profile)
    errors.hotspot_profile = 'Enter the existing HotSpot profile.';
  else if (profile && !OBJECT_NAME_PATTERN.test(profile))
    errors.hotspot_profile =
      'Use the exact profile name: letters, digits, dot, dash or underscore.';

  if (values.location.trim().length > 200) errors.location = 'At most 200 characters.';
  const model = values.model.trim();
  if (model && !MODEL_PATTERN.test(model))
    errors.model = 'Enter the model as shown on the router.';
  const ros = values.routeros_version.trim();
  if (ros && !ROUTEROS_PATTERN.test(ros))
    errors.routeros_version = 'Enter an exact RouterOS version, for example 7.20.1.';
  if (values.notes.length > 2000) errors.notes = 'At most 2000 characters.';
  return errors;
}

export function validateAddRouterStep2(values: AddRouterValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.complete_hotspot_setup) {
    const gatewayRaw = values.gateway_cidr.trim();
    if (!gatewayRaw)
      errors.gateway_cidr = 'Enter the LAN gateway with its prefix, for example 192.168.50.1/24.';
    else {
      const parsed = parseGateway(gatewayRaw);
      if (!parsed)
        errors.gateway_cidr =
          'Enter a valid IPv4 gateway and subnet prefix (for example, /24).';
      else if (parsed.prefix >= 31)
        errors.gateway_cidr =
          '/31 and /32 networks have no usable DHCP range after excluding the gateway.';
      else {
        const { network, broadcast } = networkRange(parsed.ip, parsed.prefix);
        const gwNum = ipToNumber(parsed.ip) >>> 0;
        if (gwNum === network || gwNum === broadcast)
          errors.gateway_cidr = 'The gateway cannot be the network or broadcast address.';
        else if (!isPrivateNetwork(network, parsed.prefix))
          errors.gateway_cidr =
            'Use a private LAN subnet, not a public, loopback or reserved network.';
      }
    }

    if (values.custom_dhcp) {
      const raw = values.dhcp_range.trim();
      if (!raw)
        errors.dhcp_range = 'Enter the DHCP range as first IP-last IP inside the subnet.';
      else {
        const parts = raw.split('-').map((p) => p.trim());
        if (parts.length !== 2 || !parts[0] || !parts[1] || !isValidIpv4(parts[0]) || !isValidIpv4(parts[1]))
          errors.dhcp_range =
            'Enter a DHCP range inside the LAN subnet excluding network, broadcast and gateway addresses.';
        else {
          const start = ipToNumber(parts[0]) >>> 0;
          const end = ipToNumber(parts[1]) >>> 0;
          const gatewayParsed = parseGateway(gatewayRaw);
          if (start > end)
            errors.dhcp_range =
              'Enter a DHCP range inside the LAN subnet excluding network, broadcast and gateway addresses.';
          else if (gatewayParsed) {
            const { network, broadcast } = networkRange(gatewayParsed.ip, gatewayParsed.prefix);
            const gwNum = ipToNumber(gatewayParsed.ip) >>> 0;
            if (!(network < start && start <= end && end < broadcast) || (start <= gwNum && gwNum <= end))
              errors.dhcp_range =
                'Enter a DHCP range inside the LAN subnet excluding network, broadcast and gateway addresses.';
          }
        }
      }
    }

    const dnsRaw = values.dns_servers.trim();
    if (!dnsRaw) errors.dns_servers = 'Enter 1–3 upstream DNS IPv4 addresses.';
    else {
      const servers = dnsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const gatewayIp = parseGateway(gatewayRaw)?.ip;
      const bad =
        servers.length < 1 ||
        servers.length > 3 ||
        servers.some((s) => {
          if (!isValidIpv4(s)) return true;
          if (s === '0.0.0.0') return true;
          const first = Number(s.split('.')[0]);
          if (first === 127) return true;
          if (first >= 224 && first <= 239) return true;
          if (gatewayIp && s === gatewayIp) return true;
          return false;
        });
      if (bad)
        errors.dns_servers =
          'Enter 1–3 valid upstream DNS IPv4 addresses, separated by commas.';
    }

    const domain = values.hotspot_dns_name.trim().toLowerCase();
    if (!domain)
      errors.hotspot_dns_name = 'Enter a valid local HotSpot DNS name, for example login.example.lan.';
    else if (
      domain.length > 253 ||
      !domain.includes('.') ||
      !domain.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    )
      errors.hotspot_dns_name =
        'Enter a valid local HotSpot DNS name, for example login.example.lan.';

    if (values.network_mode === 'reuse') {
      const pool = values.reuse_pool.trim();
      if (!pool) errors.reuse_pool = 'Enter the existing DHCP pool name.';
      else if (!OBJECT_NAME_PATTERN.test(pool))
        errors.reuse_pool =
          'Use the exact pool name: letters, digits, dot, dash or underscore.';
      const dhcp = values.reuse_dhcp.trim();
      if (!dhcp) errors.reuse_dhcp = 'Enter the existing DHCP server name.';
      else if (!OBJECT_NAME_PATTERN.test(dhcp))
        errors.reuse_dhcp =
          'Use the exact DHCP server name: letters, digits, dot, dash or underscore.';
    }
    const reuseHotspot = values.reuse_hotspot.trim();
    if (reuseHotspot && !OBJECT_NAME_PATTERN.test(reuseHotspot))
      errors.reuse_hotspot =
        'Use the exact HotSpot server name: letters, digits, dot, dash or underscore.';

    if (values.nat_mode !== 'existing') {
      const wan = values.wan_interface.trim();
      if (!wan) errors.wan_interface = 'Enter the WAN interface or interface-list name.';
      else if (!OBJECT_NAME_PATTERN.test(wan))
        errors.wan_interface =
          'Use the exact WAN name: letters, digits, dot, dash or underscore.';
      else if (wan === values.hotspot_interface.trim())
        errors.wan_interface = 'WAN and HotSpot LAN interfaces must differ.';
    }
  }
  if (!values.network_reviewed)
    errors.network_reviewed = 'Confirm the router network settings.';
  return errors;
}

export const ADD_ROUTER_STEP1_FIELDS = [
  'name',
  'nas_identifier',
  'hotspot_interface',
  'hotspot_profile',
  'location',
  'model',
  'routeros_version',
  'notes',
] as const;

export const ADD_ROUTER_STEP2_FIELDS = [
  'gateway_cidr',
  'dhcp_range',
  'dns_servers',
  'hotspot_dns_name',
  'reuse_pool',
  'reuse_dhcp',
  'reuse_hotspot',
  'wan_interface',
  'network_reviewed',
] as const;

function fieldToInputId(field: string): string {
  return `add-router-${field.replaceAll('_', '-')}`;
}

export function buildRegisterPayload(values: AddRouterValues): Record<string, string | boolean> {
  const payload: Record<string, string | boolean> = {
    name: values.name.trim(),
    nas_identifier: values.nas_identifier.trim(),
    hotspot_interface: values.hotspot_interface.trim(),
    hotspot_profile: values.hotspot_profile.trim(),
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
    // Preserve the historical shape: the form always rendered the optional
    // HotSpot server field during automatic setup, even when blank.
    payload.reuse_hotspot = values.reuse_hotspot.trim();
    payload.nat_mode = values.nat_mode;
    if (values.nat_mode !== 'existing') payload.wan_interface = values.wan_interface.trim();
  }
  return payload;
}

interface AddRouterDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddRouterDialog({ open, onClose }: AddRouterDialogProps) {
  const navigate = useNavigate();
  const queries = useQueryClient();
  const request = useRef({ payload: '', key: '' });
  const submitting = useRef(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<AddRouterValues>(ADD_ROUTER_DEFAULTS);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(ADD_ROUTER_DEFAULTS) || step !== 0,
    [values, step],
  );

  // The dialog remounts on every `/routers/new` navigation (see RoutersPage key),
  // so initial state is always a fresh draft. No reset effect is needed here.
  // Focus the first field when the dialog opens.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => nameInputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  function set<K extends keyof AddRouterValues>(key: K, value: AddRouterValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function focusFirstError(errors: Record<string, string>) {
    const order =
      step === 0
        ? [...ADD_ROUTER_STEP1_FIELDS]
        : [...ADD_ROUTER_STEP2_FIELDS, ...ADD_ROUTER_STEP1_FIELDS];
    // When submitting from step 2, step-1 errors take precedence (jump back).
    const keys = Object.keys(errors);
    const step1Hit = keys.find((k) => (ADD_ROUTER_STEP1_FIELDS as readonly string[]).includes(k));
    if (step === 1 && step1Hit) {
      setStep(0);
      window.setTimeout(() => document.getElementById(fieldToInputId(step1Hit))?.focus(), 60);
      return;
    }
    for (const field of order) {
      if (errors[field]) {
        window.setTimeout(() => document.getElementById(fieldToInputId(field))?.focus(), 60);
        return;
      }
    }
  }

  function requestClose() {
    if (busy) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function goNext() {
    const errors = validateAddRouterStep1(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('');
      const first = (ADD_ROUTER_STEP1_FIELDS as readonly string[]).find((f) => errors[f]);
      if (first) window.setTimeout(() => document.getElementById(fieldToInputId(first))?.focus(), 60);
      return;
    }
    setFieldErrors({});
    setFormError('');
    setStep(1);
    window.setTimeout(() => stepHeadingRef.current?.focus(), 60);
  }

  function goBack() {
    setFieldErrors({});
    setFormError('');
    setStep(0);
    window.setTimeout(() => stepHeadingRef.current?.focus(), 60);
  }

  async function submit() {
    if (submitting.current) return;
    const step1Errors = validateAddRouterStep1(values);
    if (Object.keys(step1Errors).length > 0) {
      setFieldErrors(step1Errors);
      setStep(0);
      focusFirstError(step1Errors);
      return;
    }
    const step2Errors = validateAddRouterStep2(values);
    if (Object.keys(step2Errors).length > 0) {
      setFieldErrors(step2Errors);
      setFormError('');
      focusFirstError(step2Errors);
      return;
    }
    const payload = buildRegisterPayload(values);
    const serialized = JSON.stringify(payload);
    if (request.current.payload !== serialized)
      request.current = { payload: serialized, key: newIdempotencyKey('router') };
    submitting.current = true;
    setBusy(true);
    setFormError('');
    setFieldErrors({});
    try {
      const router = await http.post<NasDevice>('/routers/register/', payload, {
        idempotencyKey: request.current.key,
      });
      await queries.invalidateQueries({ queryKey: routerKeys.all });
      queries.setQueryData(routerKeys.detail(router.id), router);
      navigate(`/routers/${router.id}?tab=setup`);
    } catch (failure) {
      if (isApiError(failure) && failure.hasFieldErrors) {
        const mapped: Record<string, string> = {};
        const leftovers: string[] = [];
        for (const [field, messages] of Object.entries(failure.fields)) {
          const text = messages.join(' ');
          // The backend aggregates HotSpot network validation under `network`.
          if (
            field === 'name' ||
            field === 'nas_identifier' ||
            field === 'hotspot_interface' ||
            field === 'hotspot_profile' ||
            field === 'location' ||
            field === 'model' ||
            field === 'routeros_version' ||
            field === 'notes' ||
            field === 'gateway_cidr' ||
            field === 'dhcp_range' ||
            field === 'dns_servers' ||
            field === 'hotspot_dns_name' ||
            field === 'reuse_pool' ||
            field === 'reuse_dhcp' ||
            field === 'reuse_hotspot' ||
            field === 'wan_interface' ||
            field === 'network_reviewed'
          ) {
            mapped[field] = text;
          } else {
            leftovers.push(field === 'network' ? text : `${field}: ${text}`);
          }
        }
        // Surface non-field details (e.g. subscription limits) verbatim.
        const fallback = leftovers.length > 0 ? leftovers.join(' ') : errorMessage(failure);
        setFieldErrors(mapped);
        setFormError(fallback);
        const allErrors = { ...mapped, ...(leftovers.length > 0 ? { _form: fallback } : {}) };
        void allErrors;
        if (Object.keys(mapped).some((k) => (ADD_ROUTER_STEP1_FIELDS as readonly string[]).includes(k))) {
          setStep(0);
          focusFirstError(mapped);
        } else if (Object.keys(mapped).length > 0) {
          focusFirstError(mapped);
        }
      } else {
        setFormError(errorMessage(failure));
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const automatic = values.complete_hotspot_setup;
  const reviewItems: { label: string; value: string }[] = [
    { label: 'Name', value: values.name.trim() || '—' },
    { label: 'NAS identifier', value: values.nas_identifier.trim() || 'Generated by the server' },
    { label: 'HotSpot interface', value: values.hotspot_interface.trim() || '—' },
    {
      label: 'HotSpot profile',
      value: values.hotspot_profile.trim() || (automatic ? 'Generated by the server' : '—'),
    },
    ...(automatic
      ? [
          { label: 'LAN gateway/subnet', value: values.gateway_cidr.trim() || '—' },
          {
            label: 'DHCP',
            value:
              values.network_mode === 'reuse'
                ? `Reuse ${values.reuse_pool.trim() || '…'} / ${values.reuse_dhcp.trim() || '…'}` +
                  (values.custom_dhcp ? ` · custom ${values.dhcp_range.trim() || '…'}` : ' · automatic range')
                : values.custom_dhcp
                  ? `Create missing · custom ${values.dhcp_range.trim() || '…'}`
                  : 'Create missing · automatic range',
          },
          { label: 'DNS', value: values.dns_servers.trim() || '—' },
          { label: 'HotSpot DNS', value: values.hotspot_dns_name.trim() || '—' },
          {
            label: 'NAT',
            value:
              values.nat_mode === 'existing'
                ? 'Keep existing NAT unchanged'
                : `Add NAT via ${values.wan_interface.trim() || '…'}`,
          },
        ]
      : [{ label: 'HotSpot setup', value: 'Manual — existing HotSpot profile' }]),
  ];

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title="Add router"
        description="Register a MikroTik HotSpot router and prepare its server configuration. Tunnel addresses, keys and the RADIUS secret are generated by the server."
        size="lg"
        dismissible={!busy}
        className="rv-add-dialog"
        footer={
          <>
            {step === 0 ? (
              <>
                <Button variant="secondary" onClick={requestClose} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={goNext} disabled={busy}>
                  Next
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={goBack} disabled={busy}>
                  Back
                </Button>
                <Button onClick={submit} loading={busy}>
                  Create router
                </Button>
              </>
            )}
          </>
        }
      >
        <div className="space-y-5">
          <ol
            aria-label="Add router progress"
            className="flex items-center gap-2 text-xs font-medium"
          >
            {['Router identity', 'HotSpot network'].map((label, index) => {
              const current = step === index;
              const done = step > index;
              return (
                <li key={label} className="flex items-center gap-2">
                  <span
                    aria-current={current ? 'step' : undefined}
                    className={
                      current
                        ? 'inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-white'
                        : done
                          ? 'inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-brand-800 dark:bg-brand-950 dark:text-brand-100'
                          : 'inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-ink-500'
                    }
                  >
                    <span aria-hidden>{index + 1}</span> {label}
                  </span>
                  {index === 0 && <span aria-hidden className="text-ink-300">→</span>}
                </li>
              );
            })}
          </ol>
          <p role="status" className="text-xs text-ink-500">
            Step {step + 1} of 2: {step === 0 ? 'Router identity' : 'HotSpot network'}
          </p>

          {formError && (
            <Alert tone="danger" title="Router could not be prepared">
              {formError}
            </Alert>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (step === 0) goNext();
              else void submit();
            }}
          >
            {step === 0 && (
              <div className="space-y-4">
                <h3
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="rounded-sm text-sm font-semibold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Router identity and HotSpot interface
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Router name"
                    required
                    error={fieldErrors.name}
                    hint="A friendly name for this site."
                  >
                    <Input
                      id={fieldToInputId('name')}
                      ref={nameInputRef}
                      value={values.name}
                      onChange={(e) => set('name', e.target.value)}
                      invalid={Boolean(fieldErrors.name)}
                      disabled={busy}
                      autoComplete="off"
                      maxLength={64}
                    />
                  </FormField>
                  <FormField
                    label="NAS identifier"
                    optionalLabel
                    error={fieldErrors.nas_identifier}
                    hint="Leave blank to let the server generate one."
                  >
                    <Input
                      id={fieldToInputId('nas_identifier')}
                      value={values.nas_identifier}
                      onChange={(e) => set('nas_identifier', e.target.value)}
                      invalid={Boolean(fieldErrors.nas_identifier)}
                      disabled={busy}
                      autoComplete="off"
                      maxLength={120}
                    />
                  </FormField>
                  <FormField
                    label="HotSpot LAN interface"
                    required
                    error={fieldErrors.hotspot_interface}
                    hint="Exact existing customer-facing bridge, Ethernet or VLAN name; never the WAN."
                  >
                    <Input
                      id={fieldToInputId('hotspot_interface')}
                      value={values.hotspot_interface}
                      onChange={(e) => set('hotspot_interface', e.target.value)}
                      invalid={Boolean(fieldErrors.hotspot_interface)}
                      disabled={busy}
                      autoComplete="off"
                      maxLength={64}
                    />
                  </FormField>
                  <FormField
                    label="HotSpot profile"
                    required={!automatic}
                    optionalLabel={automatic}
                    error={fieldErrors.hotspot_profile}
                    hint={
                      automatic
                        ? 'Generated automatically when blank.'
                        : 'Enter the existing profile name.'
                    }
                  >
                    <Input
                      id={fieldToInputId('hotspot_profile')}
                      value={values.hotspot_profile}
                      onChange={(e) => set('hotspot_profile', e.target.value)}
                      invalid={Boolean(fieldErrors.hotspot_profile)}
                      disabled={busy}
                      autoComplete="off"
                      maxLength={64}
                    />
                  </FormField>
                  <FormField label="Location" optionalLabel error={fieldErrors.location}>
                    <Input
                      id={fieldToInputId('location')}
                      value={values.location}
                      onChange={(e) => set('location', e.target.value)}
                      invalid={Boolean(fieldErrors.location)}
                      disabled={busy}
                      autoComplete="off"
                      maxLength={200}
                    />
                  </FormField>
                  <FormField
                    label="MikroTik model"
                    optionalLabel
                    error={fieldErrors.model}
                    hint="As shown in System → Resources."
                  >
                    <Input
                      id={fieldToInputId('model')}
                      value={values.model}
                      onChange={(e) => set('model', e.target.value)}
                      invalid={Boolean(fieldErrors.model)}
                      disabled={busy}
                      autoComplete="off"
                      maxLength={80}
                    />
                  </FormField>
                  <FormField
                    label="RouterOS version"
                    optionalLabel
                    error={fieldErrors.routeros_version}
                    hint="Exact version, for example 7.20.1."
                  >
                    <Input
                      id={fieldToInputId('routeros_version')}
                      value={values.routeros_version}
                      onChange={(e) => set('routeros_version', e.target.value)}
                      invalid={Boolean(fieldErrors.routeros_version)}
                      disabled={busy}
                      autoComplete="off"
                      maxLength={40}
                    />
                  </FormField>
                  <FormField label="Notes" optionalLabel error={fieldErrors.notes}>
                    <Textarea
                      id={fieldToInputId('notes')}
                      value={values.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      invalid={Boolean(fieldErrors.notes)}
                      disabled={busy}
                      maxLength={2000}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h3
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="rounded-sm text-sm font-semibold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  HotSpot network and review
                </h3>
                <Checkbox
                  id={fieldToInputId('complete_hotspot_setup')}
                  label="Set up HotSpot automatically"
                  description="Automatic setup needs RouterOS 7.17 or newer stable 7.x. Turn off to register a router that already has a HotSpot profile."
                  checked={automatic}
                  disabled={busy}
                  onChange={(e) => {
                    set('complete_hotspot_setup', e.target.checked);
                    // Re-validate the profile requirement live when the mode changes.
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.hotspot_profile;
                      return next;
                    });
                  }}
                />
                {automatic ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <p className="text-xs text-ink-500 sm:col-span-2">
                      Automatic setup checks the existing network before creating missing objects.
                    </p>
                    <FormField
                      label="LAN gateway/subnet"
                      required
                      error={fieldErrors.gateway_cidr}
                      hint="Confirmed gateway with its prefix, for example 192.168.50.1/24."
                    >
                      <Input
                        id={fieldToInputId('gateway_cidr')}
                        value={values.gateway_cidr}
                        onChange={(e) => set('gateway_cidr', e.target.value)}
                        invalid={Boolean(fieldErrors.gateway_cidr)}
                        disabled={busy}
                        autoComplete="off"
                        placeholder="192.168.50.1/24"
                      />
                    </FormField>
                    <FormField label="DHCP setup" required>
                      <Select
                        id={fieldToInputId('network_mode')}
                        value={values.network_mode}
                        onChange={(e) => set('network_mode', e.target.value as AddRouterValues['network_mode'])}
                        disabled={busy}
                        options={[
                          { value: 'create', label: 'Create missing compatible objects' },
                          { value: 'reuse', label: 'Reuse existing DHCP by exact name' },
                        ]}
                      />
                    </FormField>
                    <div className="sm:col-span-2">
                      <Checkbox
                        id={fieldToInputId('custom_dhcp')}
                        label="Use custom DHCP range"
                        checked={values.custom_dhcp}
                        disabled={busy}
                        onChange={(e) => set('custom_dhcp', e.target.checked)}
                      />
                    </div>
                    {values.custom_dhcp && (
                      <FormField
                        label="DHCP address range"
                        required
                        error={fieldErrors.dhcp_range}
                        hint="First IP-last IP inside the subnet, excluding the gateway."
                      >
                        <Input
                          id={fieldToInputId('dhcp_range')}
                          value={values.dhcp_range}
                          onChange={(e) => set('dhcp_range', e.target.value)}
                          invalid={Boolean(fieldErrors.dhcp_range)}
                          disabled={busy}
                          autoComplete="off"
                          placeholder="192.168.50.2-192.168.50.254"
                        />
                      </FormField>
                    )}
                    <FormField label="DNS servers" required error={fieldErrors.dns_servers}>
                      <Input
                        id={fieldToInputId('dns_servers')}
                        value={values.dns_servers}
                        onChange={(e) => set('dns_servers', e.target.value)}
                        invalid={Boolean(fieldErrors.dns_servers)}
                        disabled={busy}
                        autoComplete="off"
                      />
                    </FormField>
                    <FormField
                      label="HotSpot DNS name"
                      required
                      error={fieldErrors.hotspot_dns_name}
                    >
                      <Input
                        id={fieldToInputId('hotspot_dns_name')}
                        value={values.hotspot_dns_name}
                        onChange={(e) => set('hotspot_dns_name', e.target.value)}
                        invalid={Boolean(fieldErrors.hotspot_dns_name)}
                        disabled={busy}
                        autoComplete="off"
                      />
                    </FormField>
                    {values.network_mode === 'reuse' && (
                      <>
                        <FormField
                          label="Existing DHCP pool"
                          required
                          error={fieldErrors.reuse_pool}
                        >
                          <Input
                            id={fieldToInputId('reuse_pool')}
                            value={values.reuse_pool}
                            onChange={(e) => set('reuse_pool', e.target.value)}
                            invalid={Boolean(fieldErrors.reuse_pool)}
                            disabled={busy}
                            autoComplete="off"
                            maxLength={64}
                          />
                        </FormField>
                        <FormField
                          label="Existing DHCP server"
                          required
                          error={fieldErrors.reuse_dhcp}
                        >
                          <Input
                            id={fieldToInputId('reuse_dhcp')}
                            value={values.reuse_dhcp}
                            onChange={(e) => set('reuse_dhcp', e.target.value)}
                            invalid={Boolean(fieldErrors.reuse_dhcp)}
                            disabled={busy}
                            autoComplete="off"
                            maxLength={64}
                          />
                        </FormField>
                      </>
                    )}
                    <FormField
                      label="Existing HotSpot server"
                      optionalLabel
                      error={fieldErrors.reuse_hotspot}
                      hint="Leave blank to create a dedicated server."
                    >
                      <Input
                        id={fieldToInputId('reuse_hotspot')}
                        value={values.reuse_hotspot}
                        onChange={(e) => set('reuse_hotspot', e.target.value)}
                        invalid={Boolean(fieldErrors.reuse_hotspot)}
                        disabled={busy}
                        autoComplete="off"
                        maxLength={64}
                      />
                    </FormField>
                    <FormField label="NAT configuration" required>
                      <Select
                        id={fieldToInputId('nat_mode')}
                        value={values.nat_mode}
                        onChange={(e) => set('nat_mode', e.target.value as AddRouterValues['nat_mode'])}
                        disabled={busy}
                        options={[
                          { value: 'existing', label: 'Keep existing NAT unchanged' },
                          { value: 'interface', label: 'Add NAT through a WAN interface' },
                          { value: 'interface-list', label: 'Add NAT through a WAN interface-list' },
                        ]}
                      />
                    </FormField>
                    {values.nat_mode !== 'existing' && (
                      <FormField
                        label="WAN interface or interface-list"
                        required
                        error={fieldErrors.wan_interface}
                      >
                        <Input
                          id={fieldToInputId('wan_interface')}
                          value={values.wan_interface}
                          onChange={(e) => set('wan_interface', e.target.value)}
                          invalid={Boolean(fieldErrors.wan_interface)}
                          disabled={busy}
                          autoComplete="off"
                          maxLength={64}
                        />
                      </FormField>
                    )}
                  </div>
                ) : (
                  <Alert tone="info" title="Manual HotSpot">
                    Automatic setup is off. Enter the existing HotSpot profile on the previous
                    step; no gateway, DHCP, DNS or NAT fields are needed.
                  </Alert>
                )}

                <section
                  aria-labelledby="add-router-review-heading"
                  className="rv-add-review rounded-control border border-border bg-surface-muted p-4"
                >
                  <h4 id="add-router-review-heading" className="text-sm font-semibold text-ink-900">
                    Review before creating
                  </h4>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    {reviewItems.map((item) => (
                      <div key={item.label} className="min-w-0">
                        <dt className="text-xs text-ink-500">{item.label}</dt>
                        <dd className="break-words font-medium text-ink-900">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <div>
                  <Checkbox
                    id={fieldToInputId('network_reviewed')}
                    label="I confirm this router’s LAN interface and network settings are correct."
                    checked={values.network_reviewed}
                    disabled={busy}
                    onChange={(e) => set('network_reviewed', e.target.checked)}
                  />
                  {fieldErrors.network_reviewed && (
                    <p role="alert" className="mt-1 text-xs font-medium text-danger-600">
                      {fieldErrors.network_reviewed}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submit on Enter: Next on step 1, Create on step 2. Hidden buttons keep
                keyboard operation predictable without duplicating the footer. */}
            <button type="submit" className="hidden" tabIndex={-1} aria-hidden>
              Continue
            </button>
          </form>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard new router?"
        description="Your entered details will be lost. This cannot be undone."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
