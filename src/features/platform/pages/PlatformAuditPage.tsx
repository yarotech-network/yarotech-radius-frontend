import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { History, Building2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
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
          <span className="font-medium text-slate-400 dark:text-slate-500">Platform Global</span>
        ) : (
          <Link
            to={`/platform/tenants/${e.tenant}`}
            onClick={(ev) => ev.stopPropagation()}
            className="dashboard-data-link inline-flex items-center gap-1.5 font-medium"
          >
            <Building2 className="size-3.5" aria-hidden />
            {tenantName(e.tenant)}
          </Link>
        ),
    },
  ];

  return (
    <div className="audit-page platform-audit min-w-0 space-y-6">
      <header className="platform-audit-header">
        <div>
          <p className="platform-audit-eyebrow">
            <History size={15} aria-hidden /> Platform administration
          </p>
          <h1>Audit log</h1>
          <p className="platform-audit-subtitle">
            Trace recorded changes across tenants, staff and platform settings.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin' : ''} aria-hidden />}
        >
          Refresh events
        </Button>
      </header>
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
