import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/app/auth/useAuth';
import { Button } from '@/components/ui';

export function AccessContextSwitcher() {
  const { principal, switchContext } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const user = principal?.user;
  if (!user?.is_platform_admin || !user.membership_active || !user.workspace_role) return null;
  const inPlatform = principal?.kind === 'platform_admin';
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await switchContext(inPlatform ? 'workspace' : 'platform');
          navigate(inPlatform ? '/dashboard' : '/platform');
        } finally {
          setBusy(false);
        }
      }}
    >
      {inPlatform ? 'My workspace' : 'Platform'}
    </Button>
  );
}
