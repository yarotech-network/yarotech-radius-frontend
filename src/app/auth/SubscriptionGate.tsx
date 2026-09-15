import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router';
import { http } from '@/services/api/http';
import { homePathFor } from '@/services/auth/principal';
import { AppSplash } from '@/app/shell/AppSplash';
import { Button } from '@/components/ui';
import { useAuth } from './useAuth';
import SubscriptionSettingsPage from '@/features/settings/pages/SubscriptionSettingsPage';

export type SubscriptionAccess = { required: boolean; can_renew: boolean; status: string; expires_at: string | null };

/** Runs outside every operational layout, including the agent dashboard. */
export function SubscriptionGate({children}: {children:ReactNode}) {
  const {principal, signOut} = useAuth();
  const location = useLocation();
  const scoped = principal?.kind === 'member' || principal?.kind === 'agent' ||
    (principal?.kind === 'platform_staff' && principal.activeTenantId !== null);
  const scope = principal?.kind === 'member' ? principal.tenantId : principal?.kind === 'platform_staff' ? principal.activeTenantId : null;
  const access = useQuery({
    queryKey:['subscription-access', principal?.user.id, principal?.kind, scope],
    queryFn:()=>http.get<SubscriptionAccess>('/subscriptions/access/'),
    enabled:scoped, staleTime:0, refetchInterval:10000, retry:1,
  });
  const [now, setNow] = useState(Date.now);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(timer);},[]);
  if (!scoped) return <>{children}</>;
  if (access.isPending) return <AppSplash />;
  if (access.isError || !access.data) return <main className="mx-auto max-w-xl space-y-4 p-8">
    <h1 className="text-2xl font-semibold">Unable to check subscription</h1>
    <p>Please retry to confirm access to this workspace.</p>
    <Button onClick={()=>void access.refetch()}>Retry subscription check</Button>
    <Button variant="secondary" onClick={()=>void signOut()}>Sign out</Button>
  </main>;
  const expired = access.data.expires_at !== null && Date.parse(access.data.expires_at) <= now;
  const blocked = access.data.required || expired;
  if (blocked && location.pathname !== '/renew-subscription') {
    return <Navigate to={`/renew-subscription${location.search}`} replace />;
  }
  if (!blocked && location.pathname === '/renew-subscription' && principal) {
    return <Navigate to={homePathFor(principal)} replace />;
  }
  if (!blocked) return <>{children}</>;
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <header className="space-y-3">
      <h1 className="text-2xl font-semibold">Payment required to continue</h1>
      <p>Your workspace subscription has expired or is unavailable. Renew it to continue enjoying our services.</p>
      {!access.data.can_renew && <p>Contact your workspace owner to renew the subscription. Access will return after payment is confirmed.</p>}
      <div className="flex gap-3">
        <Button onClick={()=>void access.refetch()}>Check payment status</Button>
        <Button variant="secondary" onClick={()=>void signOut()}>Sign out</Button>
      </div>
    </header>
    {access.data.can_renew && <SubscriptionSettingsPage />}
  </main>;
}
