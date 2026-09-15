import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QueryBoundary } from '@/components/feedback';
import { Pagination } from '@/components/data';
import { Button } from '@/components/ui';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { formatKobo } from '@/lib/formatting/money';
import type { Paginated } from '@/types/api';
import type { CreditAccount, CreditBatch, CreditLedger } from '@/features/agents/creditApi';

export function AgentCreditSummary() {
  const [open, setOpen] = useState(false);
  return (
    <section className="space-y-4" aria-label="Agent credit account">
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide credit account' : 'View credit account'}
      </Button>
      {open && <CreditRecords />}
    </section>
  );
}

function CreditRecords() {
  const principal = usePrincipal();
  const userId = principal.kind === 'none' ? null : principal.user.id;
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const account = useQuery({
    queryKey: ['own-credit', userId, 'account'],
    queryFn: () => http.get<CreditAccount>('/agent/credit/'),
  });
  const batches = useQuery({
    queryKey: ['own-credit', userId, 'batches', page],
    queryFn: () =>
      http.get<Paginated<CreditBatch>>('/agent/credit/batches/', { page, page_size: 10 }),
  });
  const history = useQuery({
    queryKey: ['own-credit', userId, 'history', historyPage],
    queryFn: () =>
      http.get<Paginated<CreditLedger>>('/agent/credit/history/', {
        page: historyPage,
        page_size: 10,
      }),
  });
  return (
    <div className="space-y-4">
      <QueryBoundary
        query={account}
        skeleton={<p>Loading credit account...</p>}
        errorTitle="Could not load credit account"
      >
        {(data) => (
          <>
            <p>
              Amount owed: <strong>{formatKobo(data.current_balance)}</strong> · Available credit:{' '}
              {formatKobo(data.available_credit)}
            </p>
            <p>
              Credit debt is separate from your prepaid wallet. Contact your operator to receive
              credit vouchers or confirm repayments.
            </p>
            {data.requires_review && <p>Your historical credit records need operator review.</p>}
          </>
        )}
      </QueryBoundary>
      <QueryBoundary
        query={batches}
        skeleton={<p>Loading allocations...</p>}
        errorTitle="Could not load allocations"
      >
        {(data) => (
          <>
            <h3 className="font-semibold">Credit allocations</h3>
            {!data.count && <p>No credit allocations recorded in this workflow.</p>}
            {data.results.map((batch) => (
              <p key={batch.id}>
                #{batch.id} · {batch.quantity} vouchers · Repaid {formatKobo(batch.repaid)} ·
                Outstanding {formatKobo(batch.outstanding)}
                {batch.reversed_at
                  ? ' · Cancelled without refund'
                  : batch.due_date
                    ? ` · Due ${batch.due_date}`
                    : ''}
              </p>
            ))}
            <Pagination
              count={data.count}
              page={page}
              totalPages={data.total_pages}
              pageSize={10}
              onPageChange={setPage}
            />
          </>
        )}
      </QueryBoundary>
      <QueryBoundary
        query={history}
        skeleton={<p>Loading credit history...</p>}
        errorTitle="Could not load credit history"
      >
        {(data) => (
          <>
            <h3 className="font-semibold">Credit history</h3>
            {!data.count && <p>No credit movements recorded.</p>}
            {data.results.map((entry) => (
              <p key={entry.id}>
                {entry.created_at.slice(0, 10)} · {formatKobo(entry.amount)} · {entry.description} ·{' '}
                {entry.evidence?.external_reference}
              </p>
            ))}
            <Pagination
              count={data.count}
              page={historyPage}
              totalPages={data.total_pages}
              pageSize={10}
              onPageChange={setHistoryPage}
            />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
