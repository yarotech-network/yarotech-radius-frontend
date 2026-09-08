import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/app/auth/useAuth';
import { homePathFor } from '@/services/auth/principal';
import { ButtonLink } from '@/components/ui';
import { BrandMark } from './BrandMark';

export function PublicLayout({ wide = false }: { wide?: boolean }) {
  const { principal } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
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
      <header className="public-header">
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
            onClick={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                toggle.current?.focus();
              }
            }}
          >
            <a href="/#features">Features</a>
            <NavLink to="/pricing">Pricing</NavLink>
            <a href="/#about">About</a>
            {principal ? (
              <ButtonLink to={homePathFor(principal)}>
                Go to dashboard <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            ) : (
              <>
                <Link to="/login">Sign in</Link>
                <ButtonLink to="/register">
                  Get started <ArrowRight className="size-4" aria-hidden />
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
          <div>
            <Link to="/" aria-label="Yarotech home">
              <BrandMark inverse />
            </Link>
            <p>
              One workspace for your hotspot business.
              <br />A simpler way for customers to get connected.
            </p>
          </div>
          <nav aria-label="Product">
            <h2>Explore</h2>
            <a href="/#features">Features</a>
            <Link to="/pricing">Business pricing</Link>
            <a href="/#about">About Yarotech</a>
          </nav>
          <nav aria-label="Account">
            <h2>Your workspace</h2>
            <Link to="/register">Create workspace</Link>
            <Link to="/login">Sign in</Link>
            <Link to="/agent/login">Agent sign in</Link>
            <Link to="/forgot-password">Password help</Link>
          </nav>
        </div>
        <div className="public-container public-footer-bottom">
          &copy; {new Date().getFullYear()} Yarotech Network{' '}
          <span>Hotspot &amp; voucher management</span>
        </div>
      </footer>
    </div>
  );
}
