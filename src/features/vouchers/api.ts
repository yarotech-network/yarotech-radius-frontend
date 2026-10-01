import { http, request } from '@/services/api/http';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type {
  Paginated,
  SimpleMessage,
  Voucher,
  VoucherGenerateRequest,
  VoucherListParams,
  VoucherManualWrite,
  VoucherSummary,
  VoucherRemovalPreview,
} from '@/types/api';

export const vouchersApi = {
  authorizePrint(ids: readonly number[]) {
    return http.post<{ used: number; limit: number | null; day: string; timezone: string }>(
      '/vouchers/authorize-print/',
      { voucher_ids: ids },
    );
  },
  list(params: VoucherListParams) {
    return http.get<Paginated<Voucher>>('/vouchers/', { ...params });
  },
  summary() {
    return http.get<VoucherSummary>('/vouchers/summary/');
  },
  manualCode(payload: { code: string; plan_id: number; device_limit: number }, idempotencyKey: string) {
    return http.post<Voucher>('/vouchers/manual-code/', payload, { idempotencyKey });
  },
  changeStatus(id: number, operation: 'mark-sold' | 'enable' | 'mark-expired') {
    return http.post<Voucher>(`/vouchers/${id}/${operation}/`);
  },
  removalPreview(ids: number[]) {
    return http.post<VoucherRemovalPreview>('/vouchers/removal-preview/', { voucher_ids: ids });
  },
  removeSelected(token: string, idempotencyKey: string) {
    return http.post<{ deleted: number; preserved: number; active_sessions_disconnected: false }>(
      '/vouchers/remove-selected/', { token }, { idempotencyKey });
  },
  get(id: number) {
    return http.get<Voucher>(`/vouchers/${id}/`);
  },
  /** Returns the created batch (passwords are NOT included — see API gap #2). */
  async generate(payload: VoucherGenerateRequest, idempotencyKey = newIdempotencyKey('gen')) {
    const res = await request<Voucher[]>({
      method: 'POST',
      path: '/vouchers/generate/',
      body: payload,
      idempotencyKey,
    });
    return { vouchers: res.data, replayed: res.replayed };
  },
  createManual(payload: VoucherManualWrite, idempotencyKey = newIdempotencyKey('voucher')) {
    return http.post<Voucher>('/vouchers/', payload, { idempotencyKey });
  },
  update(id: number, payload: Partial<VoucherManualWrite>) {
    return http.patch<Voucher>(`/vouchers/${id}/`, payload);
  },
  remove(id: number) {
    return http.delete(`/vouchers/${id}/`);
  },
  disable(id: number, idempotencyKey = newIdempotencyKey('disable')) {
    return http.post<SimpleMessage>(`/vouchers/${id}/disable/`, undefined, { idempotencyKey });
  },
  /** Server-rendered credential card (HTML). The only place the password is readable. */
  printHtml(id: number) {
    return http.text(`/vouchers/${id}/print/`);
  },
  /** May answer 503 when the PDF renderer is not installed on the server. */
  pdf(id: number) {
    return http.blob(`/vouchers/${id}/pdf/`);
  },
  image(id: number) {
    return http.blob(`/vouchers/${id}/image/`);
  },
};
