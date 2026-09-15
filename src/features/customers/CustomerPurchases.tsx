import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/services/api/http';
import type { Paginated } from '@/types/api';
import { Button } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { formatDateTime } from '@/lib/formatting/dates';

type Purchase = {
  id: number;
  amount: number;
  status: string;
  plan_name: string;
  fulfilled: boolean;
  created_at: string;
  paid_at: string | null;
};

export function CustomerPurchases({
  customerId,
  scope,
  actorId,
}: {
  customerId: number;
  scope: number | null;
  actorId: number;
}) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['customer-purchases', actorId, scope, customerId, page],
    queryFn: () =>
      http.get<Paginated<Purchase>>(`/customers/${customerId}/purchases/`, { page, page_size: 10 }),
    enabled: scope !== null,
  });
  return (
    <section
      aria-label="Customer purchase history"
      className="space-y-3 border-t border-border pt-4"
    >
      <h3 className="font-semibold">Purchase history</h3>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <p role="status">Loading purchases...</p>
      ) : (
        <>
          {!query.data.results.length && (
            <p>No linked purchases. Older records may not have a customer link.</p>
          )}
          <ul className="space-y-3">
            {query.data.results.map((purchase) => (
              <li key={purchase.id} className="rounded border border-border p-3 text-sm">
                <p className="font-medium">
                  Purchase #{purchase.id}: {purchase.plan_name || 'Plan unavailable'}
                </p>
                <p>
                  {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
                    purchase.amount / 100,
                  )}
                </p>
                <p>
                  Payment: {purchase.status}. Voucher:{' '}
                  {purchase.fulfilled ? 'Issued' : 'Not issued'}.
                </p>
                <p>Created: {formatDateTime(purchase.created_at)}</p>
                {purchase.paid_at && <p>Paid: {formatDateTime(purchase.paid_at)}</p>}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={query.data.current_page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous purchases
            </Button>
            <Button
              variant="secondary"
              disabled={query.data.current_page >= query.data.total_pages}
              onClick={() => setPage(page + 1)}
            >
              Next purchases
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
