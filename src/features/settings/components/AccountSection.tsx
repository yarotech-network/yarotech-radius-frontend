import { ChangeEmailForm } from './ChangeEmailForm';
import { DescriptionList } from '@/components/ui';
import { useAuth } from '@/app/auth/useAuth';
import { ChangePasswordForm } from './ChangePasswordForm';
import { SettingsCard } from './SettingsCard';

/** Signed-in account details and password change. */
export function AccountSection() {
  const { principal } = useAuth();
  const user = principal?.user;
  const roleLabel = principal?.kind === 'member' ? principal.role : (user?.role ?? '');
  return (
    <>
      <SettingsCard
        id="account"
        title="Your account"
        description="Your profile and account contact details."
      >
        {user && (
          <DescriptionList
            columns={2}
            items={[
              {
                label: 'Role',
                value: <span className="capitalize">{roleLabel.replace('_', ' ')}</span>,
              },
              {
                label: 'Username',
                value: <span className="break-all">{user.username}</span>,
                mono: true,
              },
              { label: 'Email', value: <span className="break-all">{user.email}</span> },
              {
                label: 'Name',
                value: [user.first_name, user.last_name].filter(Boolean).join(' ') || null,
              },
              { label: 'Phone', value: user.phone || null, mono: true },
            ]}
          />
        )}
      </SettingsCard>
      <SettingsCard
        id="email-change"
        title="Change email"
        description="Your current email stays active until you verify the replacement."
      >
        <ChangeEmailForm />
      </SettingsCard>
      <SettingsCard
        id="password"
        title="Password"
        description="Use at least 8 characters that are not all digits. You stay signed in here; every other device and browser is signed out."
      >
        <ChangePasswordForm />
      </SettingsCard>
    </>
  );
}
