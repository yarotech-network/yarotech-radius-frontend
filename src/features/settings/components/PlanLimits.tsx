import type { PlanLimits as Limits } from '@/types/api/subscriptions';

export function PlanLimits({ plan }: { plan: Limits }) {
  return (
    <ul className="mt-3 space-y-1 text-sm text-ink-700">
      {plan.max_routers !== undefined && (
        <li>
          {plan.max_routers === null
            ? 'Unlimited routers'
            : `${plan.max_routers} registered routers`}
        </li>
      )}
      {plan.whatsapp_enabled !== undefined && (
        <li>WhatsApp {plan.whatsapp_enabled ? 'included' : 'not included'}</li>
      )}
      {plan.daily_voucher_print_limit !== undefined && (
        <li>
          {plan.daily_voucher_print_limit === null
            ? 'Unlimited voucher printing'
            : `${plan.daily_voucher_print_limit} vouchers prepared for printing per day`}
        </li>
      )}
    </ul>
  );
}
