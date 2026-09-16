import { Link } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui';

const steps = [
  [
    'Verify your email',
    'Open Create workspace, enter your email and confirm the code from your inbox. Each step advances when you choose to continue.',
    '/register',
    'Create workspace',
  ],
  [
    'Create your business account',
    'Add your business details and choose your sign-in credentials. Review the confirmation before signing in.',
    '/register',
    'Set up your account',
  ],
  [
    'Review your business settings',
    'In your workspace, open Settings to review your business details and subscription. Choose a plan that fits your router and voucher needs.',
    '/pricing',
    'Explore business plans',
  ],
  [
    'Connect your MikroTik router',
    'Open Routers in your workspace and follow the setup instructions. Confirm your internet connection and router connectivity before offering access.',
    '/login',
    'Sign in to configure',
  ],
  [
    'Create internet plans',
    'In Plans, configure customer prices, duration, data allowances and speed limits. These are the Wi-Fi plans your customers buy, separate from your business subscription.',
    '/login',
    'Sign in to create plans',
  ],
  [
    'Prepare payments and your storefront',
    'Configure your business payment settings, review the published plans and open your storefront link. Check the complete purchase and access journey before sharing it with customers.',
    '/login',
    'Sign in to finish setup',
  ],
] as const;

export default function GettingStartedPage() {
  return (
    <article className="public-guide">
      <title>Getting started - Yarotech RADIUS</title>
      <header className="public-page-heading">
        <p className="public-eyebrow">From idea to your first connection</p>
        <h1 className="public-section-title">A clear path to getting started.</h1>
        <p className="text-ink-600">
          Set up at your own pace. Here is what to prepare, and what to do next.
        </p>
      </header>
      <aside className="public-prerequisites" aria-labelledby="prepare">
        <h2 id="prepare">Before you begin</h2>
        <ul>
          {[
            'An email address you can access',
            'Your business name and contact details',
            'Internet service and a compatible MikroTik router for launch',
            'Your business payment details before selling online',
          ].map((item) => (
            <li key={item}>
              <Check aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </aside>
      <ol className="public-guide-steps">
        {steps.map(([title, copy, to, action], index) => (
          <li key={title}>
            <span className="public-step-number" aria-hidden>
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
              <Link to={to}>
                {action} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </li>
        ))}
      </ol>
      <div className="public-help-strip">
        <div>
          <h2>Need a hand with your setup?</h2>
          <p>Talk to Yarotech about your business and the next step.</p>
        </div>
        <ButtonLink to="/contact" variant="secondary">
          Contact us
        </ButtonLink>
      </div>
    </article>
  );
}
