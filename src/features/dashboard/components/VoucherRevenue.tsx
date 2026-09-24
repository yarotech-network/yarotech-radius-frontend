import { Banknote } from 'lucide-react';
import { Section } from '@/components/layout';
import { Stat } from '@/components/ui';
import { formatKobo } from '@/lib/formatting/money';
import { formatNumber } from '@/lib/formatting/units';
import type { DashboardStats } from '@/types/api';

export function VoucherRevenue({
  revenue,
  loading,
}: {
  revenue: DashboardStats['activated_voucher_revenue'];
  loading: boolean;
}) {
  return (
    <Section
      title="Activated voucher revenue"
      description="Counted once at first activation. Expired, disabled and archived vouchers retain their historical value. Figures are in NGN."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {([
          ['today', "Today's activated revenue", 'Since midnight in Lagos'],
          ['month', 'Monthly activated revenue', 'Current calendar month in Lagos'],
          ['total', 'Total activated revenue', 'All recorded activation history'],
        ] as const).map(([period, label, hint]) => (
          <Stat
            key={period}
            label={label}
            value={revenue ? formatKobo(revenue.totals[period].amount) : '—'}
            loading={loading}
            hint={hint}
            icon={<Banknote />}
          />
        ))}
      </div>
      {revenue ? (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Activated voucher revenue by channel</caption>
              <thead className="border-b text-ink-500">
                <tr>
                  <th scope="col" className="p-3">Channel</th>
                  <th scope="col" className="p-3 text-right">Today</th>
                  <th scope="col" className="p-3 text-right">This month</th>
                  <th scope="col" className="p-3 text-right">All time</th>
                  <th scope="col" className="p-3 text-right">Activated vouchers</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['storefront', 'Storefront'],
                  ['whatsapp', 'WhatsApp'],
                  ['generated', 'Generated (manual, printed and agent)'],
                ] as const).map(([channel, label]) => (
                  <tr key={channel} className="border-b border-ink-100">
                    <th scope="row" className="p-3 font-medium">{label}</th>
                    {(['today', 'month', 'total'] as const).map((period) => (
                      <td key={period} className="whitespace-nowrap p-3 text-right tabular-nums">
                        {formatKobo(revenue.channels[channel][period].amount)}
                      </td>
                    ))}
                    <td className="p-3 text-right tabular-nums">
                      {formatNumber(revenue.channels[channel].total.vouchers)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {revenue.incomplete_vouchers > 0 && (
            <p role="status" className="mt-3 text-sm text-amber-700">
              {formatNumber(revenue.incomplete_vouchers)} used vouchers are excluded because their
              activation date, saved value or source cannot be reliably established.
            </p>
          )}
        </>
      ) : !loading ? (
        <p className="mt-3 text-sm text-ink-500">Activation revenue is unavailable.</p>
      ) : null}
      <p className="mt-3 text-xs text-ink-500">
        Purchased vouchers use the successful payment amount; generated vouchers use their saved
        retail price. Complimentary vouchers contribute zero. This is activated service value,
        not proof of cash collected. An unused purchase or printed code contributes nothing yet.
      </p>
    </Section>
  );
}
