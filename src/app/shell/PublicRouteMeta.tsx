import { useEffect } from 'react';
import { useLocation } from 'react-router';

const descriptions: Record<string, string> = {
  '/': 'Run your Wi-Fi business with Yarotech RADIUS. Manage MikroTik routers, vouchers, agents and customer storefronts in one workspace.',
  '/about':
    'Meet Yarotech Network in Kano, Nigeria, and discover a workspace built for hotspot operators and connected businesses.',
  '/contact':
    'Contact Yarotech by email or telephone for questions about the platform and setting up your hotspot business.',
  '/pricing':
    'Explore Yarotech business subscriptions, prices, durations and limits for your hotspot management workspace.',
  '/guide':
    'Prepare your Yarotech workspace, verify your email, connect a router and get your customer storefront ready.',
  '/login': 'Sign in to your Yarotech workspace to manage your hotspot business.',
  '/agent/login': 'Sign in to your Yarotech agent account.',
  '/register': 'Verify your email and create your Yarotech business workspace in clear steps.',
  '/verify-email': 'Verify your email address to continue setting up your Yarotech account.',
  '/forgot-password': 'Request a password reset link for your Yarotech account.',
  '/reset-password': 'Choose a new password for your Yarotech account.',
  '/accept-invitation': 'Accept your invitation to join a Yarotech team.',
  '/pay/result': 'Check payment confirmation and access delivery for your Wi-Fi purchase.',
};

export function PublicRouteMeta() {
  const { pathname, hash } = useLocation();
  const description =
    descriptions[pathname] ??
    (pathname.startsWith('/s/')
      ? pathname.includes('/checkout/')
        ? 'Review your Wi-Fi plan and continue to Paystack to pay.'
        : 'Choose an internet plan from this business and buy Wi-Fi access.'
      : null);
  useEffect(() => {
    if (!description) return;
    const existing = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const meta = existing ?? document.createElement('meta');
    const previous = meta.content;
    meta.name = 'description';
    meta.content = description;
    if (!existing) document.head.append(meta);
    return () => {
      if (existing) meta.content = previous;
      else meta.remove();
    };
  }, [description]);
  useEffect(() => {
    if (!description) return;
    let anchor = hash.slice(1);
    try {
      anchor = decodeURIComponent(anchor);
    } catch {
      /* A malformed fragment is not a page error. */
    }
    // Wait for a lazy route's content before moving focus; do not steal form autofocus.
    const focusContent = () => {
      const target = document.getElementById(hash ? anchor : 'public-content');
      if (!target) return false;
      if (hash) target.scrollIntoView({ behavior: 'instant' });
      else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        if (document.activeElement === document.body) target.focus({ preventScroll: true });
      }
      return true;
    };
    if (focusContent()) return;
    const observer = new MutationObserver(() => {
      if (focusContent()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, hash, description]);
  return null;
}
