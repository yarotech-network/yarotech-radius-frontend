import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ChevronDown,
  ChevronRight,
  ScrollText,
  ExternalLink,
  User,
  Shield,
} from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Badge, Button, Select } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import { DataTable, FilterBar, Pagination, SearchInput, type Column } from '@/components/data';
import type { useListParams } from '@/components/data';
import { formatDateTime } from '@/lib/formatting/dates';
import type { AuditEvent, Paginated } from '@/types/api';
import { visibleAuditDetails } from '../visibleAuditDetails';
import { AUDIT_ACTION_GROUPS, actionLabel, actionTone, parseResource } from '../auditVocabulary';

export interface AuditLogViewProps {
  query: UseQueryResult<Paginated<AuditEvent>>;
  list: ReturnType<typeof useListParams>;
  debouncedSearch: string;
  /** Highlights the signed-in user's rows as "You" and enables the "Mine" shortcut. */
  currentUserId?: number | undefined;
  /** Deep-link for a resource key, or null when there is no page for it in this surface. */
  linkFor: (resource: string) => string | null;
  /** Extra filter controls rendered before the action select (e.g. a tenant picker). */
  leadingFilters?: ReactNode;
  /** Extra columns inserted after the action column (e.g. tenant). */
  extraColumns?: Column<AuditEvent>[];
  emptyDescription: string;
}

/** Shared audit table: filters, expandable details, pagination. Pages own the query. */
export function AuditLogView({
  query,
  list,
  debouncedSearch,
  currentUserId,
  linkFor,
  leadingFilters,
  extraColumns = [],
  emptyDescription,
}: AuditLogViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const columns: Column<AuditEvent>[] = [
    {
      key: 'when',
      header: 'When',
      sortField: 'created_at',
      cell: (e) => (
        <time
          dateTime={e.created_at}
          title={formatDateTime(e.created_at)}
          className="text-xs font-medium whitespace-nowrap text-slate-500 dark:text-slate-400"
        >
          {formatDateTime(e.created_at)}
        </time>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      primary: true,
      cell: (e) => (
        <div className="min-w-0">
          <Badge tone={actionTone(e.action)} size="sm" className="font-semibold">
            {actionLabel(e.action)}
          </Badge>
          <div className="mt-1 truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
            {e.action}
          </div>
        </div>
      ),
    },
    ...extraColumns,
    {
      key: 'resource',
      header: 'Resource',
      hideBelow: 'md',
      cell: (e) => <ResourceCell resource={e.resource} to={linkFor(e.resource)} />,
    },
    {
      key: 'actor',
      header: 'By',
      hideBelow: 'lg',
      cell: (e) =>
        e.actor === null ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Shield className="size-3" /> System
          </span>
        ) : e.actor === currentUserId ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:border-brand-800/60 dark:bg-brand-950/60 dark:text-brand-300">
            <User className="size-3" /> You
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
            <User className="size-3 text-slate-400" /> {e.actor_display || 'Account unavailable'}
          </span>
        ),
    },
    {
      key: 'details',
      header: <span className="sr-only">Details</span>,
      align: 'right',
      cell: (e) => {
        const has = Object.keys(e.details ?? {}).length > 0;
        const open = expanded === e.id;
        return has ? (
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={open}
            aria-controls={`audit-${e.id}`}
            onClick={(ev) => {
              ev.stopPropagation();
              setExpanded(open ? null : e.id);
            }}
            leadingIcon={
              open ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )
            }
          >
            Details
          </Button>
        ) : null;
      },
    },
  ];

  return (
    <div className="audit-log-view space-y-4">
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <FilterBar
          className="audit-filter-bar"
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search username or resource"
              ariaLabel="Search audit resources"
            />
          }
          filters={
            <div className="audit-filter-controls contents">
              {leadingFilters}
              <Select
                aria-label="Action"
                size="sm"
                value={list.state.filters.action ?? ''}
                onChange={(e) => list.setFilter('action', e.target.value || undefined)}
              >
                <option value="">All actions</option>
                {AUDIT_ACTION_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.actions.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              {currentUserId !== undefined && (
                <Button
                  size="sm"
                  variant={
                    list.state.filters.actor === String(currentUserId) ? 'primary' : 'secondary'
                  }
                  onClick={() =>
                    list.setFilter(
                      'actor',
                      list.state.filters.actor === String(currentUserId)
                        ? undefined
                        : String(currentUserId),
                    )
                  }
                >
                  Mine
                </Button>
              )}
            </div>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <DataTable
          caption="Audit events"
          columns={columns}
          rows={query.data?.results}
          rowKey={(e) => e.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          ordering={list.state.ordering}
          onOrderingChange={list.setOrdering}
          onRowClick={(e) => setExpanded(expanded === e.id ? null : e.id)}
          renderExpanded={(e) => (expanded === e.id ? <DetailsPanel event={e} /> : null)}
          empty={
            list.activeFilterCount > 0 || debouncedSearch ? (
              <EmptyState
                icon={<ScrollText className="h-6 w-6" aria-hidden />}
                title="No matching events"
                description="Try a different action, actor or resource."
                action={
                  <Button variant="secondary" onClick={list.clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<ScrollText className="h-6 w-6" aria-hidden />}
                title="Nothing recorded yet"
                description={emptyDescription}
              />
            )
          }
        />
      </div>

      {query.data && query.data.count > 0 && (
        <Pagination
          count={query.data.count}
          page={list.state.page}
          totalPages={query.data.total_pages}
          pageSize={list.state.page_size}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          itemLabel="events"
        />
      )}
    </div>
  );
}

function ResourceCell({ resource, to }: { resource: string; to: string | null }) {
  const parsed = parseResource(resource);
  const resourceNames: Record<string, string> = {
    nasdevice: 'router', macdevice: 'device', staffinvitation: 'staff invitation',
    staffassignment: 'staff assignment', tenantsubscription: 'subscription',
    paymenttransaction: 'payment', agentprofile: 'agent', tenantmembership: 'team member',
  };
  const name = parsed ? resourceNames[parsed.model] || parsed.model : 'activity';
  const label = to ? `View ${name}` : name;
  return to ? (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className="dashboard-data-link inline-flex items-center gap-1 font-mono text-xs font-semibold"
    >
      <span>{label}</span>
      <ExternalLink className="size-3" />
    </Link>
  ) : (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {label}
    </code>
  );
}

function DetailsPanel({ event }: { event: AuditEvent }) {
  const entries = Object.entries(visibleAuditDetails(event.details ?? {}));

  return (
    <div
      id={`audit-${event.id}`}
      className="dark:bg-slate-850 space-y-3 border-t border-slate-200 bg-slate-50/80 p-4 text-xs dark:border-slate-800"
    >
      <p className="font-medium text-ink-700">
        Recorded {formatDateTime(event.created_at)}
      </p>

      {entries.length > 0 && (
        <div className="space-y-2 rounded-lg border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Event Parameters & Payload
          </span>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-1 sm:grid-cols-[auto_1fr] dark:border-slate-800">
            {entries.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400">
                  {k}
                </dt>
                <dd className="rounded bg-slate-50 px-2 py-0.5 font-mono text-xs break-all text-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
                  {typeof v === 'string' ? v : JSON.stringify(v)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
