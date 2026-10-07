import { Badge } from '@/components/ui';
import type { Tenant } from '@/types/api';

/** Flags an operator whose owner has not finished setup, or whose invite email failed. */
export function TenantSetupBadge({
  tenant,
}: {
  tenant: Pick<Tenant, 'owner_setup_pending' | 'owner_delivery_status'>;
}) {
  if (tenant.owner_delivery_status === 'failed') {
    return (
      <Badge tone="danger" size="sm" className="mt-1">
        Invite email failed
      </Badge>
    );
  }
  if (tenant.owner_setup_pending) {
    return (
      <Badge tone="warning" size="sm" className="mt-1">
        Owner setup pending
      </Badge>
    );
  }
  return null;
}
