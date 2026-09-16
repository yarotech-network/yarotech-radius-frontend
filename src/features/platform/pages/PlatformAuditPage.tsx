import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { ShieldCheck, History, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Card } from '@/components/ui';
import { useListParams, type Column } from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import type { AuditEvent, AuditListParams } from '@/types/api';
import { AuditLogView } from '@/features/audit/components/AuditLogView';
import { platformResourceLink } from '@/features/audit/auditVocabulary';
import { usePlatformAudit, useTenantName } from '../queries';
import { TenantSelect } from '../components/TenantSelect';

const FILTERS = ['tenant', 'action', 'actor'] as const;

/** `/platform/audit` — every tenant's audit trail plus platform-level staff events. */
export default function PlatformAuditPage() {
  const principal = usePrincipal();
  const list = useListParams(FILTERS, { ordering: '-created_at' });
  const debouncedSearch = useDebouncedValue(list.state.search);
  const debouncedActor = useDebouncedValue(list.state.filters.actor ?? '');
  const tenantName = useTenantName();
  useEffect(() => {
    document.title = 'Audit log · Platform · Yarotech RADIUS';
  }, []);

  const query = usePlatformAudit(
    useMemo(() => {
      const p: AuditListParams = { page: list.state.page, page_size: list.state.page_size };
      if (debouncedSearch) p.search = debouncedSearch;
      if (list.state.ordering) p.ordering = list.state.ordering;
      if (list.state.filters.action) p.action = list.state.filters.action;
      const tenant = Number(list.state.filters.tenant);
      if (Number.isInteger(tenant) && tenant > 0) p.tenant = tenant;
      const actor = Number(debouncedActor);
      if (debouncedActor && Number.isInteger(actor) && actor > 0) p.actor = actor;
      return p;
    }, [list.state, debouncedSearch, debouncedActor]),
  );

  const tenantColumn: Column<AuditEvent>[] = [
    {
      key: 'tenant',
      header: 'Tenant',
      hideBelow: 'sm',
      cell: (e) =>
        e.tenant === null ? (
          <span className="text-slate-400 dark:text-slate-500 font-medium">Platform Global</span>
        ) : (
          <Link
            to={`/platform/tenants/${e.tenant}`}
            onClick={(ev) => ev.stopPropagation()}
            className="text-brand-600 dark:text-brand-400 font-medium hover:underline inline-flex items-center gap-1.5"
          >
            <Building2 className="size-3.5" />
            {tenantName(e.tenant)}
          </Link>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Audit Log"
        description="Global system administration events, staff activities, and cross-tenant action logs."
      />

      <Card className="router-page-hero border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 backdrop-blur-md shadow-inner">
              <History className="size-6" aria-hidden />
            </span>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-500/20 mb-1">
                <ShieldCheck className="size-3.5" /> Platform Governance
              </div>
              <h2 className="text-xl font-bold text-white">Cross-Tenant Audit Console</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300 max-w-2xl">
                Comprehensive log of all tenant activity, platform staff invitations, permission changes, and system settings updates.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <AuditLogView
        query={query}
        list={list}
        debouncedSearch={debouncedSearch}
        currentUserId={principal?.user.id}
        linkFor={platformResourceLink}
        leadingFilters={
          <TenantSelect
            value={list.state.filters.tenant ?? ''}
            onChange={(v) => list.setFilter('tenant', v || undefined)}
            includePlatform
          />
        }
        extraColumns={tenantColumn}
        emptyDescription="Actions taken anywhere on the platform will appear here."
      />
    </div>
  );
}

