import { formatKobo } from '@/lib/formatting/money';
import type { NetworkSummary } from '@/types/api';

/** Headline money rounds to whole naira; exact kobo values live on the detail pages. */
export function wholeNaira(kobo: number) {
  return formatKobo(Math.round(kobo / 100) * 100, { compact: true });
}

const ROUTER_STATES = [
  { key: 'online', label: 'Online', color: 'var(--color-success-600)' },
  { key: 'offline', label: 'Confirmed offline', color: 'var(--color-danger-600)' },
  { key: 'unknown', label: 'Unknown', color: 'var(--color-ink-400)' },
  { key: 'awaiting_import', label: 'Awaiting import', color: 'var(--color-warning-600)' },
  { key: 'inactive', label: 'Inactive', color: 'var(--color-ink-300)' },
] as const;

export function routerStatusParts(network: NetworkSummary) {
  return ROUTER_STATES.map((state) => ({
    label: state.label,
    value: network.router_counts[state.key] ?? 0,
    color: state.color,
  }));
}
