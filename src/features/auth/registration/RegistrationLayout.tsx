import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Check, CreditCard, Radio, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/app/shell/BrandMark';

export function RegistrationLayout({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="public-site registration-layout">
      <aside className="registration-brand">
        <Link to="/" aria-label="Yarotech RADIUS home">
          <BrandMark inverse />
        </Link>
        <div className="registration-brand-copy">
          <p className="public-eyebrow">Built for hotspot businesses</p>
          <h2>
            Your network.
            <br />
            Your next chapter.
          </h2>
          <p>Bring your routers, access codes and payments together in one workspace.</p>
          <ul>
            {[
              [
                CreditCard,
                'Payments in one place',
                'Give customers a storefront with Paystack checkout.',
              ],
              [Radio, 'A connected operation', 'Manage your MikroTik routers and voucher plans.'],
              [ShieldCheck, 'Your own workspace', 'Keep your business settings and team together.'],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof Radio;
              return (
                <li key={String(title)}>
                  <FeatureIcon aria-hidden />
                  <div>
                    <h3>{String(title)}</h3>
                    <p>{String(copy)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="registration-brand-note">
            Create your account in three clear steps.
            <br />
            Email verification only. No phone verification.
          </p>
        </div>
        <p className="registration-copyright">&copy; {new Date().getFullYear()} Yarotech Network</p>
      </aside>
      <main className="registration-main">
        <ol className="registration-progress" aria-label="Registration progress">
          {['Verify', 'Create', 'Confirm'].map((label, i) => (
            <li
              key={label}
              aria-current={i + 1 === step ? 'step' : undefined}
              className={i + 1 < step ? 'is-complete' : ''}
            >
              <span>{i + 1 < step ? <Check className="size-4" aria-hidden /> : i + 1}</span>
              <strong>{label}</strong>
              {i + 1 < step && <span className="sr-only"> completed</span>}
            </li>
          ))}
        </ol>
        {children}
        {step < 3 && (
          <p className="registration-signin">
            Already have a workspace? <Link to="/login">Sign in</Link>
          </p>
        )}
      </main>
    </div>
  );
}
