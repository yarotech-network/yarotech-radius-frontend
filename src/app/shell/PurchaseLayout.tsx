import { Link, Outlet, useParams } from 'react-router';
import { LockKeyhole, Wifi } from 'lucide-react';
import { usePublicTenant } from '@/features/storefront/queries';
import { BrandMark } from './BrandMark';

/** Customer purchases stay within the business context, without signup promotions. */
export function PurchaseLayout() {
  const { slug } = useParams();
  const tenant = usePublicTenant(slug ?? null);
  return (
    <div className="public-site public-purchase">
      <a className="public-skip" href="#public-content">
        Skip to content
      </a>
      <header className="public-purchase-header">
        <div className="public-container">
          <Link to={slug ? `/s/${slug}` : '/'} className="public-tenant-brand">
            <Wifi aria-hidden />
            <span>{tenant.data?.name ?? (slug ? 'Wi-Fi storefront' : 'Your Wi-Fi purchase')}</span>
          </Link>
          <span className="public-payment-provider">
            <LockKeyhole className="size-4" aria-hidden /> Payments with Paystack
          </span>
        </div>
      </header>
      <main id="public-content" tabIndex={-1} className="public-container public-content">
        <Outlet />
      </main>
      <footer className="public-purchase-footer public-container">
        <span>Powered by</span>
        <Link to="/" aria-label="About Yarotech RADIUS">
          <BrandMark />
        </Link>
        <p>For purchase support, contact the business you bought from.</p>
      </footer>
    </div>
  );
}
