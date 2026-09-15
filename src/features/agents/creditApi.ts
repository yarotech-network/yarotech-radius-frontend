import { http } from '@/services/api/http';
import type { Paginated } from '@/types/api';

export interface CreditAccount {
  exists: boolean;
  credit_limit: number;
  current_balance: number;
  is_active: boolean;
  available_credit: number;
  requires_review: boolean;
}
export interface CreditBatch {
  id: number;
  plan: number;
  quantity: number;
  unit_price: number;
  total: number;
  repaid: number;
  cancelled_debt: number;
  outstanding: number;
  due_date: string | null;
  note: string;
  reversed_at: string | null;
  reversal_reason: string;
}
export interface CreditLedger {
  id: number;
  amount: number;
  description: string;
  created_at: string;
  evidence: null | {
    batch_id: number;
    kind: string;
    external_reference: string;
    method: string;
    received_on: string | null;
  };
}
export type CreditCommand = {
  kind: 'issue' | 'repay' | 'reverse';
  payload: Record<string, string | number | null> & { request_key: string };
};
const base = (id: number) => `/tenant/agents/${id}/`;
export const creditApi = {
  account: (id: number) => http.get<CreditAccount>(`${base(id)}credit/`),
  batches: (id: number, page: number) =>
    http.get<Paginated<CreditBatch>>(`${base(id)}credit-batches/`, { page, page_size: 10 }),
  history: (id: number, page: number) =>
    http.get<Paginated<CreditLedger>>(`${base(id)}credit-history/`, { page, page_size: 10 }),
  configure: (
    id: number,
    payload: { credit_limit: number; is_active: boolean; note: string; expected: CreditAccount },
  ) => http.patch<CreditAccount>(`${base(id)}credit/`, payload),
  command: (id: number, command: CreditCommand) =>
    http.post<CreditBatch>(`${base(id)}credit-${command.kind}/`, command.payload),
};

/** Integer hundredths of a percent, matching server per-unit HALF_UP rounding. */
export function creditQuote(retail: number, rate: string, quantity: number): number {
  const basisPoints = Math.round(Number(rate) * 100);
  return Math.floor((retail * (10000 - basisPoints) + 5000) / 10000) * quantity;
}

export function readPendingCredit(storageKey: string): CreditCommand | null {
  const stored = sessionStorage.getItem(storageKey);
  if (!stored) return null;
  const command = JSON.parse(stored) as CreditCommand;
  if (
    !['issue', 'repay', 'reverse'].includes(command.kind) ||
    typeof command.payload?.request_key !== 'string'
  ) {
    throw new Error('Saved credit request requires review. Do not submit another request.');
  }
  return command;
}
