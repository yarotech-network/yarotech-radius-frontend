import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Sparkline } from '@/components/charts';
import { cn } from '@/lib/utilities/cn';

/**
 * Compact KPI tile. The corner arrow is the real link (it carries the accessible name);
 * its ::after overlay stretches over the card so the whole tile is clickable.
 */
export function KpiTile({
  label,
  value,
  detail,
  trend,
  live,
  extra,
  to,
  link,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: number[] | undefined;
  live?: boolean | undefined;
  extra?: ReactNode;
  /** Where the tile leads; omit for a display-only tile. */
  to?: string | undefined;
  link?: string | undefined;
  loading?: boolean | undefined;
}) {
  return (
    <Card
      padded={false}
      className={cn(
        'group relative flex min-w-0 flex-col gap-1.5 p-3 sm:p-4',
        to &&
          'transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-subtle has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand-600',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-500">
          {live && (
            <span aria-hidden className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-600 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success-600" />
            </span>
          )}
          <span className="line-clamp-2 sm:truncate">{label}</span>
        </p>
        {to && link && (
          <Link
            to={to}
            aria-label={link}
            title={link}
            className="shrink-0 text-ink-400 transition-colors group-hover:text-brand-600 after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
          >
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        {loading ? (
          <span className="h-7 w-24 animate-pulse rounded-md bg-fill-strong" />
        ) : (
          <p className="min-w-0 truncate text-lg font-semibold tracking-tight text-ink-900 sm:text-xl">
            {value}
          </p>
        )}
        {trend && <Sparkline values={trend} className="hidden sm:block" />}
      </div>
      {extra}
      <p className="line-clamp-2 text-xs text-ink-500 sm:truncate" title={detail}>
        {detail}
      </p>
    </Card>
  );
}

/** A labelled group of tiles; renders nothing when the viewer may see none of them. */
export function KpiGroup({ label, children }: { label: string; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <section aria-label={label} className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</h2>
      <div
        className={cn(
          'grid grid-cols-2 gap-3',
          children.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4',
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** A thin stacked status bar for small tiles (no legend; the detail line names the parts). */
export function MiniBar({ parts }: { parts: { value: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-fill">
      {total > 0 &&
        parts
          .filter((part) => part.value > 0)
          .map((part, index) => (
            <span
              key={index}
              className="block h-full"
              style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
            />
          ))}
    </div>
  );
}

/** "Up 12% vs last month" line for a tile; says so when there is no baseline to compare with. */
export function KpiDelta({ change, comparison }: { change: number | null; comparison: string }) {
  if (change === null) {
    return <p className="text-xs text-ink-500">No earlier figures to compare</p>;
  }
  const flat = Math.abs(change) < 0.5;
  const Icon = flat ? Minus : change > 0 ? TrendingUp : TrendingDown;
  const size = Math.abs(change);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1 font-semibold',
          flat ? 'text-ink-600' : change > 0 ? 'text-success-700' : 'text-danger-700',
        )}
      >
        <Icon aria-hidden className="size-3.5" />
        {flat ? 'No change' : `${change > 0 ? 'Up' : 'Down'} ${size.toFixed(size < 10 ? 1 : 0)}%`}
      </span>
      <span className="text-ink-500">{comparison}</span>
    </p>
  );
}
