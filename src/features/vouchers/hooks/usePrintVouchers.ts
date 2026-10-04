import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/components/feedback';
import { printHtml } from '@/lib/utilities/download';
import { errorMessage, isApiError } from '@/services/api/errors';
import { usePrincipal } from '@/app/auth/useAuth';
import { workspaceName } from '@/services/auth/principal';
import { vouchersApi } from '../api';
import { buildPrintSheet, fetchCredentials } from '../printing';

export interface BulkPrintProgress {
  done: number;
  total: number;
}

/** The server owns the card layout and tenant logo for both print and PDF. */
export function usePrintVouchers() {
  const toast = useToast();
  const principal = usePrincipal();
  const [progress, setProgress] = useState<BulkPrintProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const print = useCallback(async (ids: readonly number[], options?: { showStatusLabels?: boolean }) => {
    if (ids.length === 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: ids.length });
    try {
      await vouchersApi.authorizePrint(ids);
      if (controller.signal.aborted) return;
      let html: string;
      try {
        html = await vouchersApi.bulkPrint(ids, options?.showStatusLabels ?? false, controller.signal);
      } catch (error) {
        // The new backend keeps this endpoint gated until legacy voucher credentials are converted.
        // Continue using its authorized, separate-password print endpoint during that rollout.
        const legacyFormat = isApiError(error) && (
          error.status === 404 ||
          (error.status === 503 && error.message === 'The new print format is not enabled.')
        );
        if (!legacyFormat) throw error;
        const { ok, failed } = await fetchCredentials(ids, setProgress, controller.signal);
        if (controller.signal.aborted) return;
        if (failed.length || ok.length !== ids.length) {
          toast.error('Could not prepare vouchers', 'Some credential pages could not be loaded. Nothing was printed.');
          return;
        }
        html = buildPrintSheet(ok, {
          tenantName: workspaceName(principal) ?? 'Wi-Fi voucher',
          footnote: 'Connect to the hotspot and enter these details on the login page.',
          showStatusLabels: options?.showStatusLabels ?? false,
        });
      }
      if (controller.signal.aborted) return;
      setProgress({ done: ids.length, total: ids.length });
      printHtml(html);
    } catch (error) {
      if (!controller.signal.aborted) toast.error('Could not prepare vouchers', errorMessage(error));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setProgress(null);
      }
    }
  }, [principal, toast]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  return { print, cancel, progress, printing: progress !== null };
}
