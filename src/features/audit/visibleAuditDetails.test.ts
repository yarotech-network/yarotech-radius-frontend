import { expect, it } from 'vitest';
import { visibleAuditDetails } from './visibleAuditDetails';

it('omits database identity fields at every depth without changing the audit record', () => {
  const details = {
    tenant_id: 12, userId: 42, plan: 7, count: 10, amount: 50000,
    reference: 'payment-reference',
    changes: [{ voucher_ids: [1, 2], status: 'active', owner: { id: 42, name: 'Habiba' } }],
  };
  expect(visibleAuditDetails(details)).toEqual({
    count: 10, amount: 50000, reference: 'payment-reference',
    changes: [{ status: 'active', owner: { name: 'Habiba' } }],
  });
  expect(details.changes[0]?.voucher_ids).toEqual([1, 2]);
});
