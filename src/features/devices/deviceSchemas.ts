import { z } from 'zod';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '@/lib/formatting/dates';
import type { MacDevice, MacDeviceWrite } from '@/types/api';

export const deviceSchema = z
  .object({
    router: z.string().min(1, 'Choose a router'),
    access_type: z.enum(['permanent', 'timed']),
    vlan_id: z
      .string()
      .refine(
        (v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 4094),
        'Use a VLAN ID from 1 to 4094',
      ),
    description: z.string().trim().max(2000),
    device_name: z.string().trim().min(1, 'Required').max(200, 'At most 200 characters'),
    mac_address: z
      .string()
      .trim()
      .refine(
        (value) =>
          /^(?:[0-9a-f]{12}|(?:[0-9a-f]{2}:){5}[0-9a-f]{2}|(?:[0-9a-f]{2}-){5}[0-9a-f]{2}|(?:[0-9a-f]{4}\.){2}[0-9a-f]{4})$/i.test(
            value,
          ),
        'Enter a valid MAC address',
      ),
    plan: z.string(),
    expires_at: z.string(),
    is_active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const compact = values.mac_address.replace(/[:.\-\s]/g, '').toUpperCase();
    if (
      compact === '000000000000' ||
      compact === 'FFFFFFFFFFFF' ||
      parseInt(compact.slice(0, 2), 16) & 1
    )
      ctx.addIssue({
        code: 'custom',
        path: ['mac_address'],
        message: 'Use a unicast MAC address.',
      });
    if (values.access_type === 'timed' && !fromDateTimeLocalInput(values.expires_at))
      ctx.addIssue({
        code: 'custom',
        path: ['expires_at'],
        message: 'Enter an expiry date and time',
      });
  });
export type DeviceInput = z.input<typeof deviceSchema>;
export type DeviceOutput = z.output<typeof deviceSchema>;

export function deviceDefaults(): DeviceInput {
  const inAYear = new Date();
  inAYear.setFullYear(inAYear.getFullYear() + 1);
  return {
    router: '',
    access_type: 'permanent',
    vlan_id: '',
    description: '',
    device_name: '',
    mac_address: '',
    plan: '',
    expires_at: toDateTimeLocalInput(inAYear.toISOString()),
    is_active: true,
  };
}

export function deviceToForm(device: MacDevice): DeviceInput {
  return {
    router: device.router ?? '',
    access_type: device.access_type ?? 'timed',
    vlan_id: device.vlan_id ? String(device.vlan_id) : '',
    description: device.description ?? '',
    device_name: device.device_name,
    mac_address: device.mac_address,
    plan: device.plan == null ? '' : String(device.plan),
    expires_at: device.expires_at ? toDateTimeLocalInput(device.expires_at) : '',
    is_active: device.is_active,
  };
}

export function formToPayload(values: DeviceOutput): MacDeviceWrite {
  return {
    router: values.router,
    access_type: values.access_type,
    vlan_id: values.vlan_id ? Number(values.vlan_id) : null,
    description: values.description,
    device_name: values.device_name,
    mac_address: normaliseMac(values.mac_address),
    plan: values.plan ? Number(values.plan) : null,
    expires_at:
      values.access_type === 'permanent' ? null : fromDateTimeLocalInput(values.expires_at),
    is_active: values.is_active,
  };
}

export function formToPatch(values: DeviceOutput, device: MacDevice): Partial<MacDeviceWrite> {
  const next = formToPayload(values);
  const patch: Partial<MacDeviceWrite> = {};
  if (next.device_name !== device.device_name) patch.device_name = next.device_name;
  if (next.mac_address !== device.mac_address) patch.mac_address = next.mac_address;
  if (next.plan !== device.plan) patch.plan = next.plan;
  if (next.router !== device.router) patch.router = values.router;
  if (next.access_type !== device.access_type) patch.access_type = values.access_type;
  if (next.vlan_id !== (device.vlan_id ?? null)) patch.vlan_id = next.vlan_id ?? null;
  if (next.description !== (device.description ?? '')) patch.description = values.description;
  if (
    (next.expires_at ? new Date(next.expires_at).getTime() : null) !==
    (device.expires_at ? new Date(device.expires_at).getTime() : null)
  )
    patch.expires_at = next.expires_at;
  if (next.is_active !== device.is_active) patch.is_active = values.is_active;
  if (Object.keys(patch).length && device.version !== undefined)
    patch.expected_version = device.version;
  return patch;
}

/** Same canonical form the server stores (AA:BB:CC:DD:EE:FF) so change detection is stable. */
export function normaliseMac(value: string): string {
  const hex = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return hex.match(/.{2}/g)?.join(':') ?? value;
}
