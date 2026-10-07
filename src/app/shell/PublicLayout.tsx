import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Menu, X, ArrowRight, MapPin, Phone, Mail, ShieldCheck, Sparkles } from 'lucide-react';

const Facebook = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);
const Twitter = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);
const Instagram = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);
const Linkedin = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);
const Youtube = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);
import { useAuth } from '@/app/auth/useAuth';
import { homePathFor } from '@/services/auth/principal';
import { ButtonLink } from '@/components/ui';
import { publicContact } from '@/features/storefront/publicContact';
import { BrandMark } from './BrandMark';

/**
 * Legal pages. Empty until the real policies are written — add `{ to, label }` entries
 * (and their routes) to show them in the footer. Never link to pages that don't exist.
 */
const LEGAL_LINKS: { to: string; label: string }[] = [];

const SOCIAL_META = {
  facebook: { label: 'Facebook', Icon: Facebook },
  x: { label: 'X (Twitter)', Icon: Twitter },
  instagram: { label: 'Instagram', Icon: Instagram },
  linkedin: { label: 'LinkedIn', Icon: Linkedin },
  youtube: { label: 'YouTube', Icon: Youtube },
} as const;

/** Only profiles with a configured URL are shown. */
const socialLinks = (Object.keys(SOCIAL_META) as (keyof typeof SOCIAL_META)[])
  .filter((key) => publicContact.social[key])
  .map((key) => ({ key, url: publicContact.social[key], ...SOCIAL_META[key] }));

export function PublicLayout({ wide = false }: { wide?: boolean }) {
  const { principal } = useAuth();
  const location = useLocation();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === location.key;
  const setOpen = (value: boolean) => setOpenAt(value ? location.key : null);
  const toggle = useRef<HTMLButtonElement>(null);
  // Header gains a soft shadow once the page scrolls under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // These private account screens share the layout but retain their compact presentation.
  const privatePage = ['/select-tenant', '/no-access'].includes(location.pathname);
  if (privatePage)
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" aria-label="Home">
            <BrandMark />
          </Link>
          <nav className="flex items-center gap-4 text-sm" aria-label="Public">
            <Link to="/pricing" className="text-ink-600 hover:text-ink-900">
              Pricing
            </Link>
            {principal ? (
              <Link
                to={homePathFor(principal)}
                className="font-medium text-brand-600 hover:underline"
              >
                Go to dashboard
              </Link>
            ) : (
              <Link to="/login" className="font-medium text-brand-600 hover:underline">
                Sign in
              </Link>
            )}
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10 sm:px-6">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-5xl px-4 py-4 text-xs text-ink-400 sm:px-6">
          &copy; {new Date().getFullYear()} Yarotech Network
        </footer>
      </div>
    );
  return (
    <div className="public-site">
      <a className="public-skip" href="#public-content">
        Skip to content
      </a>
      {!principal && (
        <div className="public-announcement">
          <div className="public-container">
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            <span>Customers can pay with Paystack or OPay.</span>
            <Link to="/register">
              Start your 15-day free trial <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      )}
      <header
        data-scrolled={scrolled || undefined}
        className="public-header"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            setOpen(false);
            toggle.current?.focus();
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <div className="public-container public-nav-row">
          <Link to="/" aria-label="Home">
            <BrandMark />
          </Link>
          <button
            ref={toggle}
            type="button"
            className="public-menu-toggle"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="public-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
          <nav
            id="public-navigation"
            className={`public-navigation ${open ? 'is-open' : ''}`}
            aria-label="Public"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) {
                setOpen(false);
                document.getElementById('public-content')?.focus({ preventScroll: true });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                toggle.current?.focus();
              }
            }}
          >
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/pricing">Business Plans</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            {principal ? (
              <ButtonLink to={homePathFor(principal)}>
                Go to dashboard <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            ) : (
              <>
                <NavLink to="/login" className="public-nav-signin">
                  Sign in
                </NavLink>
                <ButtonLink to="/register">
                  Create workspace <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main
        id="public-content"
        tabIndex={-1}
        className={`public-container public-content ${wide ? 'public-home' : ''}`}
      >
        <Outlet />
      </main>

      <footer className="public-footer">
        <div className="public-container public-footer-grid">
          <div className="public-footer-brand">
            <Link to="/" aria-label="Yarotech home">
              <BrandMark inverse size="lg" />
            </Link>
            <p className="public-footer-tagline">
              One workspace for your hotspot business.
              <br />A simpler way for customers to get connected.
            </p>
            <address className="public-footer-contact">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(publicContact.address)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span>{publicContact.address}</span>
              </a>
              <a href={`tel:${publicContact.phone}`}>
                <Phone className="size-4 shrink-0" aria-hidden />
                <span>{publicContact.phoneDisplay}</span>
              </a>
              <a href={`mailto:${publicContact.email}`}>
                <Mail className="size-4 shrink-0" aria-hidden />
                <span>{publicContact.email}</span>
              </a>
            </address>
            <div className="public-footer-payments">
              <span>
                <ShieldCheck className="size-4" aria-hidden /> Secure payments
              </span>
              <ul aria-label="Supported payment providers">
                <li>Paystack</li>
                <li>OPay</li>
              </ul>
            </div>
            {socialLinks.length > 0 && (
              <div className="public-footer-socials" aria-label="Social media links">
                {socialLinks.map(({ key, url, label, Icon }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                  >
                    <Icon className="size-[18px]" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <nav aria-label="Product">
            <h2>Product</h2>
            <Link to="/#features">Features</Link>
            <Link to="/pricing">Business plans</Link>
            <Link to="/guide">Getting started</Link>
            <Link to="/about">About Yarotech</Link>
          </nav>

          <nav aria-label="Account">
            <h2>Your workspace</h2>
            <Link to="/register">Create workspace</Link>
            <Link to="/login">Sign in</Link>
            <Link to="/agent/login">Agent sign in</Link>
            <Link to="/forgot-password">Password help</Link>
          </nav>

          <nav aria-label="Support">
            <h2>Support</h2>
            <Link to="/contact">Contact us</Link>
            <a href={`mailto:${publicContact.email}`}>Email support</a>
            <a href={`tel:${publicContact.phone}`}>Call {publicContact.phoneDisplay}</a>
            {LEGAL_LINKS.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="public-container public-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Yarotech Network. All rights reserved.</span>
          <span>Built in Kano, Nigeria · Payments by Paystack &amp; OPay</span>
        </div>
      </footer>
    </div>
  );
}
