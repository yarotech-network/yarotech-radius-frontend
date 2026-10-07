import type { BadgeTone } from '@/components/ui/Badge';
import type { Paginated } from '@/types/api';
import { formatRelative } from '@/lib/formatting/dates';

export type Access = {
  id: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  reference: string;
  plan: string;
  source: string;
  date: string;
  status: string;
  connection: string;
  devices: number;
  sessions: number;
  last_seen: string | null;
  bytes_total: number;
  expires_at: string | null;
  access_code: string | null;
};

export type ConnectionState = 'online' | 'offline' | 'never_connected' | 'unknown';

/** Counts over the records matching every filter except the connection filter. */
export type AccessSummary = {
  total: number;
  connection: Record<ConnectionState, number>;
  sources: Record<string, number>;
  bytes_total: number;
};

export type AccessResponse = Paginated<Access> & {
  synced_at: string | null;
  sync_fresh: boolean;
  /** Absent on older backends. */
  summary?: AccessSummary;
};

export const label = (value: string) => value.replaceAll('_', ' ');

export const SOURCE_LABELS: Record<string, string> = {
  customer: 'Bought online',
  agent: 'Sold by agent',
  admin: 'Issued by staff',
};

/** Live connection: online stands out; offline is normal for a customer, so it stays neutral. */
export const CONNECTION: Record<string, { tone: BadgeTone; text: string }> = {
  online: { tone: 'success', text: 'Online' },
  offline: { tone: 'neutral', text: 'Offline' },
  never_connected: { tone: 'outline', text: 'Never connected' },
  unknown: { tone: 'neutral', text: 'Unknown' },
};

/** Up to two initials from the buyer's name, else the first letter of their email. */
export function initials(access: Pick<Access, 'buyer_name' | 'buyer_email'>) {
  const words = access.buyer_name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('');
  }
  return access.buyer_email.trim().charAt(0).toUpperCase();
}

/** "Expires in 5 hours", "Expired 2 days ago", or why there is no deadline yet. */
export function expiryText(access: Pick<Access, 'expires_at' | 'status'>, now = Date.now()) {
  if (!access.expires_at) {
    return ['unused', 'sold'].includes(access.status)
      ? 'Not activated yet'
      : 'No deadline recorded';
  }
  const past = new Date(access.expires_at).getTime() <= now;
  return `${past ? 'Expired' : 'Expires'} ${formatRelative(access.expires_at, now)}`;
}
