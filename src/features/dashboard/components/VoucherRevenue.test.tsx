import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderPage } from '@/test/renderPage';
import type { DashboardStats } from '@/types/api';
import { VoucherRevenue } from './VoucherRevenue';

const period = (amount: number, vouchers = 1) => ({
  today: { amount, vouchers }, month: { amount, vouchers }, total: { amount, vouchers },
});
const revenue: NonNullable<DashboardStats['activated_voucher_revenue']> = {
  basis: 'first_activation',
  totals: period(60000, 3),
  channels: { storefront: period(10000), whatsapp: period(20000), generated: period(30000) },
  incomplete_vouchers: 2,
};

describe('Activated voucher revenue', () => {
  it('shows all three channels, activation periods and incomplete history', () => {
    renderPage(<VoucherRevenue revenue={revenue} loading={false} />, { role: 'owner' });
    const table = screen.getByRole('table', { name: 'Activated voucher revenue by channel' });
    for (const [label, amount] of [
      ['Storefront', '₦100.00'], ['WhatsApp', '₦200.00'],
      ['Generated (manual, printed and agent)', '₦300.00'],
    ] as const) {
      const row = within(table).getByRole('rowheader', { name: label }).closest('tr')!;
      expect(within(row).getAllByText(amount)).toHaveLength(3);
    }
    expect(screen.getByRole('status')).toHaveTextContent('2 used vouchers are excluded');
    expect(screen.getByText(/not proof of cash collected/)).toBeInTheDocument();
    expect(screen.getAllByText('₦600.00')).toHaveLength(3);
  });

  it('does not substitute cash totals or zero for a backend without the new report', () => {
    renderPage(<VoucherRevenue revenue={undefined} loading={false} />, { role: 'owner' });
    expect(screen.getByText('Activation revenue is unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('₦0.00')).not.toBeInTheDocument();
  });

  it('distinguishes genuine zero activity from unavailable data', () => {
    renderPage(<VoucherRevenue revenue={{ ...revenue, totals: period(0, 0),
      channels: { storefront: period(0, 0), whatsapp: period(0, 0), generated: period(0, 0) },
      incomplete_vouchers: 0 }} loading={false} />, { role: 'owner' });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByText('₦0.00')).toHaveLength(12);
  });
});
