import { vouchersApi } from './api';

export interface PrintedCredential {
  id: number;
  username: string;
  password: string;
  plan: string;
  duration: string;
  status?: string;
}

/**
 * The backend returns a tiny HTML page per voucher; extract the credential fields so the UI can
 * render its own print sheet (many cards per page) instead of one browser tab per voucher.
 */
export function parsePrintHtml(id: number, html: string): PrintedCredential | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const fields: Record<string, string> = {};
  for (const p of Array.from(doc.querySelectorAll('p'))) {
    const label = p.querySelector('strong')?.textContent?.replace(':', '').trim().toLowerCase();
    if (!label) continue;
    const value = (p.textContent ?? '')
      .replace(p.querySelector('strong')?.textContent ?? '', '')
      .trim();
    fields[label] = value;
  }
  if (!fields.username || !fields.password) return null;
  return {
    id,
    username: fields.username,
    password: fields.password,
    plan: fields.plan ?? '',
    duration: fields.duration ?? '',
    status: fields.status ?? '',
  };
}

export interface BulkPrintProgress {
  done: number;
  total: number;
}

/**
 * Sequentially fetch credentials for a batch (keeps the server load predictable and lets the UI
 * show progress). Failures are collected instead of aborting the whole batch.
 */
export async function fetchCredentials(
  ids: readonly number[],
  onProgress?: (p: BulkPrintProgress) => void,
  signal?: AbortSignal,
) {
  const ok: PrintedCredential[] = [];
  const failed: number[] = [];
  let done = 0;
  for (const id of ids) {
    if (signal?.aborted) break;
    try {
      const html = await vouchersApi.printHtml(id);
      const parsed = parsePrintHtml(id, html);
      if (parsed) ok.push(parsed);
      else failed.push(id);
    } catch {
      failed.push(id);
    }
    done += 1;
    onProgress?.({ done, total: ids.length });
  }
  return { ok, failed };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch,
  );
}

/** Print sheet: 2 columns of branded credential cards for A4/Letter, black on white. */
export function buildPrintSheet(
  credentials: readonly PrintedCredential[],
  options: { tenantName: string; footnote?: string; showStatusLabels?: boolean },
) {
  const cards = credentials
    .map((c) => {
      const planBits = [c.plan, c.duration].map((part) => part.trim()).filter(Boolean);
      return `
      <article class="card">
        <header class="brand">${escapeHtml(options.tenantName)}</header>
        <div class="creds">
          <div class="cred"><span class="k">Username</span><strong class="v">${escapeHtml(c.username)}</strong></div>
          <div class="cred"><span class="k">Password</span><strong class="v">${escapeHtml(c.password)}</strong></div>
        </div>
        ${planBits.length > 0 ? `<p class="meta">${planBits.map((part) => escapeHtml(part)).join(' · ')}</p>` : ''}
        ${options.showStatusLabels && c.status ? `<p class="meta">Status: ${escapeHtml(c.status)}</p>` : ''}
        <p class="howto">${options.footnote ? escapeHtml(options.footnote) : 'Connect to the hotspot Wi-Fi and enter these details on the login page.'}</p>
      </article>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Vouchers — ${escapeHtml(options.tenantName)}</title>
<style>
  @page { margin: 12mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #000; background: #fff; margin: 0; }
  .sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6mm; }
  .card { border: 1pt solid #000; border-radius: 4mm; padding: 5mm; break-inside: avoid; background: #fff; }
  .brand { font-weight: 800; font-size: 15pt; letter-spacing: 0.02em; text-align: center; color: #0b3a82; border-bottom: 1pt solid #0b3a82; padding-bottom: 3mm; margin: 0 0 4mm; overflow-wrap: anywhere; }
  .creds { border: 1pt solid #9db4d8; border-radius: 3mm; background: #f4f8ff; padding: 3mm 4mm; }
  .cred { padding: 1.5mm 0; }
  .cred + .cred { border-top: 1pt dashed #9db4d8; margin-top: 1.5mm; padding-top: 3mm; }
  .k { display: block; font-size: 8pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #444; }
  .v { display: block; font: 700 16pt/1.25 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.04em; color: #000; overflow-wrap: anywhere; word-break: break-word; }
  .meta { margin: 3mm 0 0; font-size: 9.5pt; color: #000; text-align: center; overflow-wrap: anywhere; }
  .howto { margin: 2.5mm 0 0; font-size: 8.5pt; color: #333; text-align: center; }
</style></head><body><main class="sheet">${cards}</main></body></html>`;
}
