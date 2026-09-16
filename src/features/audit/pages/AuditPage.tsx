import { useMemo } from 'react';
import { ShieldCheck, History, UserCheck, Layers } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Card } from '@/components/ui';
import { useListParams } from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import type { AuditListParams } from '@/types/api';
import { useAuditEvents } from '../queries';
import { resourceLink } from '../auditVocabulary';
import { AuditLogView } from '../components/AuditLogView';

const FILTERS = ['action', 'actor'] as const;

/** `/audit` — the signed-in workspace's own audit trail. */
export default function AuditPage() {
  const principal = usePrincipal();
  const list = useListParams(FILTERS, { ordering: '-created_at' });
  const debouncedSearch = useDebouncedValue(list.state.search);
  const debouncedActor = useDebouncedValue(list.state.filters.actor ?? '');
  const query = useAuditEvents(
    useMemo(() => {
      const p: AuditListParams = { page: list.state.page, page_size: list.state.page_size };
      if (debouncedSearch) p.search = debouncedSearch;
      if (list.state.ordering) p.ordering = list.state.ordering;
      if (list.state.filters.action) p.action = list.state.filters.action;
      const actor = Number(debouncedActor);
      if (debouncedActor && Number.isInteger(actor) && actor > 0) p.actor = actor;
      return p;
    }, [list.state, debouncedSearch, debouncedActor]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Immutable record of administrative operations, voucher generation, router changes, and team activities."
      />

      <Card className="router-page-hero border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-900 via-slate-850 to-brand-950 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300 border border-brand-400/30 backdrop-blur-md shadow-inner">
              <History className="size-6" aria-hidden />
            </span>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-0.5 text-xs font-semibold text-brand-300 border border-brand-500/20 mb-1">
                <ShieldCheck className="size-3.5" /> Security & Accountability
              </div>
              <h2 className="text-xl font-bold text-white">Workspace Audit Trail</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300 max-w-2xl">
                Track every sensitive operation executed in your workspace. Inspect exact timestamps, responsible team members, affected resources, and parameter changes.
              </p>
            </div>
          </div>
        </div>

        <div className="router-page-hero-strip mt-6 pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-brand-400" />
              <span>Total Recorded Events: <strong className="text-white font-mono">{query.data?.count ?? '—'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <UserCheck className="size-4 text-emerald-400" />
              <span>Signed In As: <strong className="text-white">{principal?.user?.username || 'Member'}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Real-time Logging Active</span>
          </div>
        </div>
      </Card>

      <AuditLogView
        query={query}
        list={list}
        debouncedSearch={debouncedSearch}
        currentUserId={principal?.user.id}
        linkFor={resourceLink}
        emptyDescription="Actions taken by your team will appear here."
      />
    </div>
  );
}

