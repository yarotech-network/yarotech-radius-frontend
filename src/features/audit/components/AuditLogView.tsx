import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronRight, ScrollText, Copy, Check, ExternalLink, User, Shield } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Badge, Button, Input, Select } from '@/components/ui';
import { EmptyState, useToast } from '@/components/feedback';
import { DataTable, FilterBar, Pagination, SearchInput, type Column } from '@/components/data';
import type { useListParams } from '@/components/data';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import type { AuditEvent, Paginated } from '@/types/api';
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
          className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-medium"
        >
          {formatRelative(e.created_at)}
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
          <div className="mt-1 truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">{e.action}</div>
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
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/60">
            <User className="size-3" /> You
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
            <User className="size-3 text-slate-400" /> User #{e.actor}
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
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <FilterBar
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search resource, e.g. voucher:56"
              ariaLabel="Search audit resources"
            />
          }
          filters={
            <>
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
              <Input
                aria-label="Actor user ID"
                type="number"
                min={1}
                inputMode="numeric"
                className="h-8 w-32 text-xs"
                placeholder="Actor user ID"
                value={list.state.filters.actor ?? ''}
                onChange={(e) => list.setFilter('actor', e.target.value || undefined)}
              />
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
            </>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
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
  const label = parsed ? `${parsed.model} #${parsed.pk}` : resource;
  return to ? (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
    >
      <span>{label}</span>
      <ExternalLink className="size-3" />
    </Link>
  ) : (
    <code className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
      {label}
    </code>
  );
}

function DetailsPanel({ event }: { event: AuditEvent }) {
  const toast = useToast();
  const [copiedId, setCopiedId] = useState(false);
  const [copiedRes, setCopiedRes] = useState(false);
  const entries = Object.entries(event.details ?? {});

  const copyText = (text: string, type: 'id' | 'res') => {
    void navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      toast.success('Event ID copied', text);
    } else {
      setCopiedRes(true);
      setTimeout(() => setCopiedRes(false), 2000);
      toast.success('Resource string copied', text);
    }
  };

  return (
    <div
      id={`audit-${event.id}`}
      className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 p-4 text-xs space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2.5">
          <div>
            <span className="text-slate-400 dark:text-slate-500 font-medium block text-[11px]">Target Resource</span>
            <code className="font-mono text-xs text-slate-800 dark:text-slate-200 font-semibold">{event.resource}</code>
          </div>
          <button
            type="button"
            onClick={() => copyText(event.resource, 'res')}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition-colors"
            title="Copy Resource"
          >
            {copiedRes ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2.5">
          <div>
            <span className="text-slate-400 dark:text-slate-500 font-medium block text-[11px]">Event UUID</span>
            <code className="font-mono text-xs text-slate-800 dark:text-slate-200">{event.id}</code>
          </div>
          <button
            type="button"
            onClick={() => copyText(event.id, 'id')}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition-colors"
            title="Copy Event ID"
          >
            {copiedId ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 space-y-2">
          <span className="text-slate-500 dark:text-slate-400 font-medium block text-xs">Event Parameters & Payload</span>
          <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            {entries.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-xs text-slate-500 dark:text-slate-400 font-medium">{k}:</dt>
                <dd className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded">
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

