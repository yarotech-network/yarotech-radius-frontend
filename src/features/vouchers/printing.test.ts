import { describe, expect, it } from 'vitest';
import { buildPrintSheet, parsePrintHtml } from './printing';

const SERVER_HTML = `
        <html>
        <body>
        <h1>YAROTECH Voucher</h1>
        <p><strong>Username:</strong> WH10000</p>
        <p><strong>Password:</strong> pw&lt;1000&gt;</p>
        <p><strong>Plan:</strong> Daily 1GB</p>
        <p><strong>Duration:</strong> 24 hours</p>
        <p><strong>Status:</strong> unused</p>
        </body>
        </html>`;

describe('parsePrintHtml', () => {
  it('extracts the credential fields from the server print page (entities decoded)', () => {
    expect(parsePrintHtml(7, SERVER_HTML)).toEqual({
      id: 7,
      username: 'WH10000',
      password: 'pw<1000>',
      plan: 'Daily 1GB',
      duration: '24 hours',
      status: 'unused',
    });
  });
  it('returns null when the page has no credentials', () => {
    expect(parsePrintHtml(1, '<html><body><h1>Nope</h1></body></html>')).toBeNull();
  });
});

describe('buildPrintSheet', () => {
  it('renders one card per credential and escapes HTML', () => {
    const html = buildPrintSheet(
      [{ id: 1, username: 'a<b', password: 'p"q', plan: 'Daily', duration: '24 hours' }],
      { tenantName: 'Wuse & Co' },
    );
    expect(html).toContain('Wuse &amp; Co');
    expect(html).toContain('a&lt;b');
    expect(html).toContain('p&quot;q');
    expect(html.match(/<article class="card">/g)).toHaveLength(1);
  });

  it('shows a branded header, credential box, plan details and connection help', () => {
    const html = buildPrintSheet(
      [{ id: 1, username: 'WH10001', password: 'secret-1', plan: 'Daily 1GB', duration: '24 hours' }],
      { tenantName: 'Wuse Hotspot', footnote: 'Ask the front desk for help.' },
    );
    expect(html).toContain('<header class="brand">Wuse Hotspot</header>');
    expect(html).toContain('Username');
    expect(html).toContain('Password');
    expect(html).toContain('WH10001');
    expect(html).toContain('secret-1');
    expect(html).toContain('Daily 1GB · 24 hours');
    expect(html).toContain('Ask the front desk for help.');
  });

  it('falls back to a generic connection instruction without a footnote', () => {
    const html = buildPrintSheet(
      [{ id: 1, username: 'WH10001', password: 'secret-1', plan: '', duration: '' }],
      { tenantName: 'Wuse Hotspot' },
    );
    expect(html).toContain('Connect to the hotspot');
    expect(html).not.toContain('<p class="meta">');
  });

  it('renders long codes in full with wrapping instead of clipping', () => {
    const long = `VERYLONGVOUCHERCODE${'X'.repeat(60)}`;
    const html = buildPrintSheet(
      [{ id: 1, username: long, password: 'pw', plan: 'Daily', duration: '' }],
      { tenantName: 'Tenant' },
    );
    expect(html).toContain(long);
    expect(html).toMatch(/overflow-wrap:\s*anywhere/);
    expect(html).toMatch(/word-break:\s*break-word/);
  });

  it('adds status labels only for the labelled-print option', () => {
    const rows = [{ id: 1, username: 'WH10001', password: 'pw', plan: 'Daily', duration: '', status: 'sold' }];
    expect(buildPrintSheet(rows, { tenantName: 'Tenant' })).not.toContain('Status: sold');
    expect(buildPrintSheet(rows, { tenantName: 'Tenant', showStatusLabels: true })).toContain('Status: sold');
  });

  it('keeps print output black on white', () => {
    const html = buildPrintSheet(
      [{ id: 1, username: 'WH10001', password: 'pw', plan: 'Daily', duration: '' }],
      { tenantName: 'Tenant' },
    );
    expect(html).toContain('background: #fff');
    expect(html).toContain('color: #000');
  });
});
