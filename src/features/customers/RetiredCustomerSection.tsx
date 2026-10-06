import { Navigate, useSearchParams } from 'react-router';

/** Old Devices / Contact records links land on Customers instead of a dead page. */
export function RetiredCustomerSection() {
  const [search] = useSearchParams();
  const voucher = search.get('voucher');
  return (
    <Navigate
      replace
      to={voucher ? `/customers?details=${encodeURIComponent(voucher)}` : '/customers'}
    />
  );
}
