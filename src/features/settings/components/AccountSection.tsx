import type { ReactNode } from 'react';
import { KeyRound, Mail, UserRound } from 'lucide-react';
import { Avatar, Badge, CopyButton } from '@/components/ui';
import { useAuth } from '@/app/auth/useAuth';
import { ChangeEmailForm } from './ChangeEmailForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { SettingsCard } from './SettingsCard';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-control bg-surface-muted px-3 py-2.5">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-all text-ink-900">{children}</dd>
    </div>
  );
}

/** Signed-in account details, email change and password change. */
export function AccountSection() {
  const { principal } = useAuth();
  const user = principal?.user;
  if (!user) return null;
  const role = (principal?.kind === 'member' ? principal.role : user.role).replaceAll('_', ' ');
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const display = fullName || user.username;
  const initials = display
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <>
      <SettingsCard
        id="account"
        title="Your account"
        icon={<UserRound />}
        description="The person signed in right now. Teammates add you to a workspace with your user ID."
      >
        <div className="flex flex-wrap items-center gap-4">
          <Avatar initials={initials || '?'} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-ink-900">{display}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
              <span className="font-mono">@{user.username}</span>
              <Badge tone="brand" size="sm" className="capitalize">
                {role}
              </Badge>
            </p>
          </div>
        </div>
        <dl className="mt-5 grid gap-2 sm:grid-cols-2">
          <Detail label="Email">{user.email}</Detail>
          <Detail label="Phone">{user.phone || 'Not added'}</Detail>
          <Detail label="User ID">
            <span className="inline-flex items-center gap-1">
              <span className="font-mono">{user.id}</span>
              <CopyButton value={String(user.id)} label="Copy user ID" size="icon" />
            </span>
          </Detail>
          <Detail label="Name">{fullName || 'Not added'}</Detail>
        </dl>
      </SettingsCard>
      <SettingsCard
        id="email-change"
        title="Change email"
        icon={<Mail />}
        description="We send a code to the new address. Your current email keeps working until you confirm it."
      >
        <ChangeEmailForm />
      </SettingsCard>
      <SettingsCard
        id="password"
        title="Password"
        icon={<KeyRound />}
        description="Use at least 8 characters that are not all numbers. You stay signed in here; other devices are signed out."
      >
        <ChangePasswordForm />
      </SettingsCard>
    </>
  );
}
