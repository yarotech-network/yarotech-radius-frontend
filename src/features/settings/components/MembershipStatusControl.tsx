import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/auth/useAuth';
import { Button } from '@/components/ui';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import type { TenantMembership } from '@/types/api';

export function MembershipStatusControl({
  member,
  disabled = false,
}: {
  member: TenantMembership;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const { principal, refreshPrincipal } = useAuth();
  const active = member.is_active !== false;
  return (
    <div>
      <span className="mr-2 text-sm">{active ? 'Active' : 'Suspended'}</span>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await http.patch(`/tenant-memberships/${member.id}/`, { is_active: !active });
            if (principal?.user.id === member.user) await refreshPrincipal();
            await queryClient.invalidateQueries();
          } catch (cause) {
            setError(errorMessage(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        {active ? 'Suspend' : 'Reactivate'}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
