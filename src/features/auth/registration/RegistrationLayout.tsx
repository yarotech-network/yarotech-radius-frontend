import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { AuthSplitLayout } from '@/app/shell/AuthSplitLayout';

export function RegistrationLayout({ step, children }: { step: number; children: ReactNode }) {
  return (
    <AuthSplitLayout
      title={null}
      className="registration-form"
      panelTitle="Your network. Your next chapter."
      panelDescription="Bring your routers, access codes and payments together in one workspace."
    >
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
    </AuthSplitLayout>
  );
}
