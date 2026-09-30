import { KeyRound, Mail, Wifi } from 'lucide-react';
import { CopyButton } from '@/components/ui';
import { formatDataLimit, formatHours } from '@/lib/formatting/units';
import type { PaymentCallbackPlan } from '@/types/api';

/**
 * The customer's single access code (username == password) with the steps to connect. Shown on
 * the payment result page only while the backend still reveals the code (voucher unused).
 */
export function AccessCodePanel({
  code,
  tenantName,
  plan,
  emailMasked,
}: {
  code: string;
  tenantName?: string | undefined;
  plan: PaymentCallbackPlan | null;
  emailMasked?: string | undefined;
}) {
  const network = tenantName ?? 'the business';
  return (
    <div className="mt-5 space-y-4">
      <div className="public-access-code-card">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-950">
          <KeyRound className="size-4" aria-hidden />
          <h3>Your access code</h3>
        </div>
        <p className="mt-1 text-sm text-ink-600">Use this same code for both username and password.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <output aria-label="Access code" className="public-access-code-value select-all">
            {code}
          </output>
          <CopyButton value={code} label="Copy access code" variant="secondary" />
        </div>
        {plan && (
          <p className="mt-4 border-t border-border pt-3 text-sm text-ink-700">
            {plan.name} · {formatHours(plan.duration_hours)} · {formatDataLimit(plan.data_limit)}
            {plan.data_limit === 0 ? ' data' : ''}
            {plan.device_limit !== undefined && ` · ${plan.device_limit} device${plan.device_limit === 1 ? '' : 's'}`}
          </p>
        )}
      </div>
      <div className="public-connection-guide">
        <h3 className="flex items-center gap-2 text-base font-semibold text-brand-950">
          <Wifi className="size-5 text-brand-700" aria-hidden />
          How to connect
        </h3>
        <ol className="public-connection-steps mt-4 text-sm text-ink-700">
          <li><span>Join the {network} Wi-Fi network.</span></li>
          <li><span>Open the Wi-Fi login page. Enter your access code as both username and password.</span></li>
          <li><span>Sign in. Your voucher time starts on your first login.</span></li>
        </ol>
      </div>
      <p className="flex items-start gap-2 text-sm text-ink-600">
        <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {emailMasked
            ? `A copy is on its way to ${emailMasked}. `
            : 'A copy is being emailed to the address you entered. '}
          Save the code now. For your security, it disappears from this page after you log in.
        </span>
      </p>
    </div>
  );
}
