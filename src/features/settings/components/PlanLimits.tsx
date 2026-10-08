import { Check, Minus } from 'lucide-react';
import type { PlanLimits as Limits } from '@/types/api/subscriptions';

function Item({ included = true, children }: { included?: boolean; children: string }) {
  const Icon = included ? Check : Minus;
  return (
    <li className="flex items-start gap-2">
      <Icon
        aria-hidden
        className={
          included
            ? 'mt-0.5 size-4 shrink-0 text-success-600'
            : 'mt-0.5 size-4 shrink-0 text-ink-300'
        }
      />
      <span className={included ? undefined : 'text-ink-500'}>{children}</span>
    </li>
  );
}

export function PlanLimits({ plan }: { plan: Limits }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
      {plan.max_routers !== undefined && (
        <Item>
          {plan.max_routers === null ? 'Unlimited routers' : `${plan.max_routers} active routers`}
        </Item>
      )}
      {plan.daily_voucher_print_limit !== undefined && (
        <Item>
          {plan.daily_voucher_print_limit === null
            ? 'Unlimited voucher printing'
            : `${plan.daily_voucher_print_limit} vouchers prepared for printing per day`}
        </Item>
      )}
      {plan.whatsapp_enabled !== undefined && (
        <Item included={plan.whatsapp_enabled}>
          {`WhatsApp ${plan.whatsapp_enabled ? 'included' : 'not included'}`}
        </Item>
      )}
    </ul>
  );
}
