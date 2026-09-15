import { useState } from 'react';
import { DataTable, Pagination, type Column } from '@/components/data';
import { formatKobo } from '@/lib/formatting/money';
import { formatDateTime } from '@/lib/formatting/dates';
import type { AgentWalletTransaction } from '@/types/api';
import { useWalletTransactions } from '../queries';

const columns: Column<AgentWalletTransaction>[] = [
  { key: 'category', header: 'Movement', primary: true, cell: row => row.category === 'funding' ? 'Wallet funding' : 'Voucher sale' },
  { key: 'amount', header: 'Amount', cell: row => `${row.category === 'funding' ? '+' : '-'}${formatKobo(row.amount)}` },
  { key: 'before', header: 'Balance before', cell: row => formatKobo(row.previous_balance) },
  { key: 'after', header: 'Balance after', cell: row => formatKobo(row.new_balance) },
  { key: 'date', header: 'Date', cell: row => formatDateTime(row.created_at) },
];

export function WalletTransactions() {
  const [page, setPage] = useState(1);
  const query = useWalletTransactions({ page, page_size: 20 });
  return <section aria-labelledby="wallet-movements-heading" className="space-y-3">
    <h2 id="wallet-movements-heading" className="text-base font-semibold text-brand-950">Wallet movements</h2>
    <p className="text-sm text-ink-500">Recorded debits and credits. Older activity may remain in your operator's historical records.</p>
    <DataTable caption="Wallet movements" columns={columns} rows={query.data?.results} rowKey={row => row.id}
      loading={query.isPending} refreshing={query.isFetching && !query.isPending} error={query.error}
      onRetry={() => void query.refetch()} empty={<p className="p-4 text-sm text-ink-500">No recorded movements yet.</p>} />
    {query.data && query.data.count > 0 && <Pagination count={query.data.count} page={page}
      totalPages={query.data.total_pages} pageSize={20} onPageChange={setPage} itemLabel="movements" />}
  </section>;
}
