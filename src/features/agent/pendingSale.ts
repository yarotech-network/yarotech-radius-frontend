import type { AgentGenerateRequest } from '@/types/api';

interface PendingSale { key: string; payload: AgentGenerateRequest }
const storageKey = (scope: string) => `yarotech:pending-agent-sale:${scope}`;

export function loadPendingSale(scope: string): PendingSale | null {
  try {
    const raw = sessionStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingSale;
    if (/^[A-Za-z0-9_.:-]{16,128}$/.test(value.key) &&
      Number.isSafeInteger(value.payload?.plan_id) && value.payload.plan_id > 0 &&
      Number.isInteger(value.payload.quantity) && value.payload.quantity! >= 1 && value.payload.quantity! <= 100) return value;
  } catch { /* Invalid local state must not be replayed. */ }
  return null;
}

export function savePendingSale(scope: string, sale: PendingSale) {
  sessionStorage.setItem(storageKey(scope), JSON.stringify(sale));
}

export function clearPendingSale(scope: string) {
  sessionStorage.removeItem(storageKey(scope));
}
