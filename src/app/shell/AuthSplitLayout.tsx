import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utilities/cn';
import { BrandMark } from './BrandMark';

/**
 * Two-sided authentication layout: the form on the left and, on wide screens, a
 * branded photo panel pinned to the viewport on the right (the form scrolls; the
 * panel stays fitted to the screen). The photo is a CSS background inside a media
 * query (public.css), so it follows window resizes and is never fetched on phones,
 * where the panel is hidden. Used by sign-in, agent sign-in, registration,
 * email verification, password and invitation pages.
 */
export function AuthSplitLayout({
  title,
  eyebrow,
  description,
  children,
  footer,
  className,
  panelTitle = 'Your hotspot business, one dashboard',
  panelDescription = 'Create vouchers, onboard routers, manage agents and take payments — every Wi-Fi operation in a single workspace.',
  panelPoints = [
    'Vouchers & access codes generated in seconds',
    'Live sessions, routers and devices at a glance',
    'Agents, wallets and Paystack or OPay payments built in',
  ],
}: {
  title: ReactNode;
  /** Small line above the title, e.g. "Welcome back". */
  eyebrow?: ReactNode;
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
      <a className="public-skip" href="#public-content">
        Skip to form
      </a>
      <div className="public-auth-form-side">
        <header className="public-auth-header">
          <Link to="/" aria-label="Yarotech RADIUS home">
            <BrandMark />
          </Link>
          <Link to="/" className="public-auth-back">
            <ArrowLeft className="size-4" aria-hidden />
            Back to site
          </Link>
        </header>
        <main id="public-content" tabIndex={-1} className="public-auth-main">
          <div className={cn('public-auth-form', className)}>
            {eyebrow && <p className="public-auth-eyebrow">{eyebrow}</p>}
            {title && <h1 className="public-auth-title">{title}</h1>}
            {description && (
              <p className="mt-3 text-base leading-relaxed text-ink-600">{description}</p>
            )}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-6 text-center text-sm text-ink-500">{footer}</div>}
          <nav aria-label="Help" className="public-auth-help">
            <Link to="/guide">Getting started guide</Link>
            <span aria-hidden>·</span>
            <Link to="/contact">Contact support</Link>
          </nav>
        </main>
      </div>

      <aside className="public-auth-panel" aria-label="About Yarotech RADIUS">
        <div className="public-auth-panel-copy">
          <p className="public-auth-panel-badge">
            <ShieldCheck className="size-4" aria-hidden />
            Hotspot & voucher management
          </p>
          <h2>{panelTitle}</h2>
          <p className="public-auth-panel-lead">{panelDescription}</p>
          <ul>
            {panelPoints.map((point) => (
              <li key={point}>
                <span aria-hidden>
                  <Check className="size-3.5" />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <div className="public-auth-panel-foot">
            <span>© {new Date().getFullYear()} Yarotech Network</span>
            <span className="public-auth-panel-pay">
              <span>Paystack</span>
              <span>OPay</span>
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
