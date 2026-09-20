import { Ticket } from 'lucide-react';
import { describeRateLimit, formatDataLimit, formatHours } from '@/lib/formatting/units';
import { planCodeFormatOptions } from '@/lib/voucherCodeFormats';
import type { PlanFormInput } from '../planSchema';

export function PlanPreview({ draft }: { draft: Partial<PlanFormInput> }) {
  const price = Number(draft.price);
  const duration = Number(draft.duration_hours);
  const quota = Number(draft.data_limit_mb);
  return (
    <aside className="plan-preview" aria-label="Live plan preview">
      <div className="plan-preview-heading">
        CAPTIVE PORTAL PREVIEW <span>Live</span>
      </div>
      <div className="plan-preview-pass">
        <div className="plan-preview-brand">
          YAROTECH WIFI PASS <Ticket size={22} aria-hidden />
        </div>
        <h3>{draft.name?.trim() || 'Your plan name'}</h3>
        <div className="plan-preview-price">
          {Number.isFinite(price) && price >= 0
            ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price)
            : '—'}
        </div>
        <p>
          Valid for{' '}
          {duration > 0 && Number.isFinite(duration)
            ? formatHours(duration)
            : 'your selected duration'}{' '}
          after activation
        </p>
        <dl>
          <div>
            <dt>Speed limit</dt>
            <dd>{draft.rate_limit ? describeRateLimit(draft.rate_limit) : 'No plan limit'}</dd>
          </div>
          <div>
            <dt>Data allowance</dt>
            <dd>{Number.isFinite(quota) && quota >= 0 ? formatDataLimit(quota) : '—'}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>{draft.plan_type === 'iot_mac' ? 'IoT / MAC device' : 'Hotspot voucher'}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{draft.is_active ? 'Active' : 'Inactive'}</dd>
          </div>
        </dl>
        <div className="plan-preview-code">
          <span>Voucher format</span>
          <strong>{draft.voucher_prefix || 'No prefix'}</strong>
          <small>
            {planCodeFormatOptions.find((option) => option.value === draft.voucher_code_format)
              ?.label ?? 'Business default'}
          </small>
        </div>
      </div>
      <p className="plan-preview-note">
        <strong>Live preview:</strong> reflects your draft. Save the plan to apply changes. Existing
        vouchers retain their issued terms.
      </p>
    </aside>
  );
}
