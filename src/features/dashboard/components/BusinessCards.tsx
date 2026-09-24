import { Link } from 'react-router';
import { Banknote, Ticket } from 'lucide-react';
import { Section } from '@/components/layout';
import { Card, Stat } from '@/components/ui';
import { formatKobo } from '@/lib/formatting/money';
import { formatNumber } from '@/lib/formatting/units';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import type { DashboardStats } from '@/types/api';
import { VoucherRevenue } from './VoucherRevenue';

export function BusinessCards({
  stats: s,
  loading,
}: {
  stats: DashboardStats | undefined;
  loading: boolean;
}) {
  const principal = usePrincipal();
  return (
    <>
      <VoucherRevenue revenue={s?.activated_voucher_revenue} loading={loading} />
      <Section
        title="Recorded collections and payments"
        description="Recorded customer payments, agent wallet sales and credit repayments. Figures are in NGN."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ["Today's collections", s?.collected_revenue?.today, 'Since midnight in Lagos'],
              ['Monthly collections', s?.collected_revenue?.month, 'Current calendar month in Lagos'],
              ['Total collections', s?.collected_revenue?.total, 'All recorded collections'],
            ] as const
          ).map(([label, value, hint]) => (
            <Stat
              key={label}
              label={label}
              value={value == null ? '—' : formatKobo(value)}
              hint={hint}
              icon={<Banknote />}
              loading={loading}
            />
          ))}
        </div>
        {s?.revenue_sources && (
          <p className="mt-3 text-sm text-ink-500">
            All-time sources: online {formatKobo(s.revenue_sources.online)} · agent wallet sales{' '}
            {formatKobo(s.revenue_sources.agent_wallet)} · credit repayments{' '}
            {formatKobo(s.revenue_sources.agent_credit_repayments)}. Unpaid credit, complimentary
            vouchers and wallet top-ups are excluded.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              ['Successful payments', s?.successful_payments, 'success'],
              ['Pending payments', s?.pending_payments, 'pending'],
              ['Failed payments', s?.failed_payments, 'failed'],
            ] as const
          ).map(([label, count, status]) => (
            <Card key={status}>
              <Stat
                label={label}
                value={count == null ? '—' : formatNumber(count)}
                loading={loading}
                hint="Online purchase attempts · all time"
              />
              {can(principal, 'payments.view') && (
                <Link
                  className="mt-2 inline-block text-sm font-semibold text-brand-700"
                  to={`/payments?status=${status}`}
                >
                  View {status} payments
                </Link>
              )}
            </Card>
          ))}
        </div>
      </Section>
      <Section
        title="Vouchers and plans"
        description="Usage figures can overlap: a sold voucher may also be used or expired."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ['Available vouchers', s?.voucher_usage?.available],
              ['Sold vouchers', s?.voucher_usage?.sold],
              ['Used vouchers', s?.voucher_usage?.used],
              ['Expired vouchers', s?.voucher_usage?.expired],
              ['Not started', s?.voucher_usage?.not_started],
              ['Disabled vouchers', s?.voucher_usage?.disabled],
              ['Vouchers issued today', s?.vouchers_issued_today],
              ['Active plans', s?.active_plans],
              ['Total plans', s?.total_plans],
            ] as const
          ).map(([label, count]) => (
            <Stat
              key={label}
              label={label}
              value={count == null ? '—' : formatNumber(count)}
              loading={loading}
              icon={<Ticket />}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-brand-700">
          {can(principal, 'vouchers.view') && <Link to="/vouchers">View voucher activity</Link>}
          {can(principal, 'plans.view') && (
            <Link to="/plans">
              View all plans{s?.total_plans == null ? '' : ` (${s.total_plans})`}
            </Link>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Issued vouchers are not necessarily sales. Collected revenue requires a recorded
          transaction.
        </p>
      </Section>
    </>
  );
}
