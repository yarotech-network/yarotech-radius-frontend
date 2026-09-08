import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Check } from 'lucide-react';
import dashboardPreview from '@/assets/images/dashboard-preview.jpg';
import { cn } from '@/lib/utilities/cn';
import { BrandMark } from './BrandMark';

/**
 * Two-sided authentication layout: form on the left, a branded panel with a
 * dashboard preview and feature highlights on the right (hidden on mobile,
 * where the form fills the screen). Used by the sign-in, registration and
 * email-verification pages.
 */
export function AuthSplitLayout({
  title,
  description,
  children,
  footer,
  className,
  panelTitle = 'Your hotspot business, one dashboard',
  panelDescription = 'Create vouchers, onboard routers, manage agents and take payments — every Wi-Fi operation in a single workspace.',
  panelPoints = [
    'Vouchers & access codes generated in seconds',
    'Live sessions, routers and devices at a glance',
    'Agents, wallets and Paystack payments built in',
  ],
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  panelTitle?: string;
  panelDescription?: string;
  panelPoints?: string[];
}) {
  return (
    <div className="public-site public-auth-layout">
      {/* form side */}
      <div className="public-auth-form-side">
        <header className="public-auth-header">
          <Link to="/" aria-label="Yarotech RADIUS home">
            <BrandMark />
          </Link>
        </header>
        <main className="public-auth-main">
          <div className={cn('public-auth-form', className)}>
            <h1 className="public-auth-title">{title}</h1>
            {description && (
              <p className="mt-3 text-base leading-relaxed text-ink-600">{description}</p>
            )}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-ink-500">{footer}</div>}
        </main>
      </div>

      {/* brand side */}
      <aside className="public-auth-panel">
        <img
          src={dashboardPreview}
          alt="Preview of the Yarotech RADIUS workspace dashboard"
          className="public-auth-preview"
          loading="lazy"
          decoding="async"
        />
        <div className="public-auth-panel-copy">
          <h2 className="text-3xl font-semibold tracking-tight text-white">{panelTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-100">{panelDescription}</p>
          <ul className="mt-8 space-y-3">
            {panelPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-brand-50">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500/30">
                  <Check className="size-3.5 text-brand-100" aria-hidden />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-xs text-brand-200">
            © {new Date().getFullYear()} Yarotech Network
          </p>
        </div>
      </aside>
    </div>
  );
}
