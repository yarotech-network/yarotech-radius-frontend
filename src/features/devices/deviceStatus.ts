import type { BadgeTone } from '@/components/ui/Badge';
import { formatRelative } from '@/lib/formatting/dates';
import type { MacDevice } from '@/types/api';

export type DeviceStatus = 'active' | 'expired' | 'suspended' | 'revoked' | 'deleted';

/** Mirrors the backend MacDevice.effective_status so the list shows what RADIUS enforces. */
export function effectiveStatus(device: MacDevice, now = Date.now()): DeviceStatus {
  if (device.status === 'deleted') return 'deleted';
  if (device.status === 'revoked' || device.status === 'expired' || device.status === 'suspended')
    return device.status;
  const active = device.status === 'active' || (!device.status && device.is_active);
  if (!active) return 'suspended';
  const timed = device.access_type ? device.access_type === 'timed' : Boolean(device.expires_at);
  if (timed && (!device.expires_at || new Date(device.expires_at).getTime() <= now))
    return 'expired';
  return 'active';
}

export const STATUS_BADGE: Record<DeviceStatus, { tone: BadgeTone; text: string }> = {
  active: { tone: 'success', text: 'Active' },
  expired: { tone: 'warning', text: 'Expired' },
  suspended: { tone: 'neutral', text: 'Suspended' },
  revoked: { tone: 'danger', text: 'Revoked' },
  deleted: { tone: 'outline', text: 'Removed' },
};

/** "Access until … / Expired … ago / Permanent access" for the status column. */
export function accessText(device: MacDevice, now = Date.now()): string {
  if (device.access_type === 'permanent' || !device.expires_at) return 'Permanent access';
  const past = new Date(device.expires_at).getTime() <= now;
  return `${past ? 'Expired' : 'Expires'} ${formatRelative(device.expires_at, now)}`;
}

/** Plain summary of recorded MAC sessions (an open record does not prove the device is online). */
export function sessionText(device: MacDevice): { text: string; open: boolean } {
  const accounting = device.accounting;
  if (!accounting?.available) return { text: 'Usage unavailable', open: false };
  if (!accounting.session_count) return { text: 'Not seen yet', open: false };
  if (accounting.open_sessions) return { text: `${accounting.open_sessions} open`, open: true };
  return { text: 'Closed', open: false };
}
