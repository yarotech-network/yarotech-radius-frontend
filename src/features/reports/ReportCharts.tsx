import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utilities/cn';
import { niceTicks } from './reportMath';
import './reports.css';

export interface ChartSeries {
  key: string;
  label: string;
  /** A CSS colour, normally one of the --viz-N slots. */
  color: string;
  values: (number | null)[];
}

interface ChartProps {
  ariaLabel: string;
  /** Short x-axis labels, one per period. */
  labels: string[];
  /** Tooltip heading per period (e.g. "Fri 2 Oct 2026 · In progress"). */
  titles: string[];
  series: ChartSeries[];
  format: (value: number) => string;
  axisFormat: (value: number) => string;
  /** Periods drawn lighter because they are still in progress or partial. */
  provisional?: boolean[];
  height?: number;
}

const MARGIN = { top: 12, right: 16, bottom: 28, left: 60 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(260, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface Geometry {
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  band: number;
  cx: (index: number) => number;
  y: (value: number) => number;
}

/**
 * Shared frame for every time chart: recessive grid, axes, a crosshair band that
 * snaps to the nearest period, and one tooltip listing every series. Arrow keys
 * move the same readout for keyboard users.
 */
function ChartFrame({
  ariaLabel,
  labels,
  titles,
  series,
  format,
  axisFormat,
  height = 240,
  max,
  keyShape,
  children,
}: ChartProps & {
  max: number;
  keyShape: 'line' | 'box';
  children: (geometry: Geometry, active: number | null) => ReactNode;
}) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const count = labels.length;
  const ticks = niceTicks(max);
  const top = ticks.at(-1) || 1;
  const geometry: Geometry = {
    plotLeft: MARGIN.left,
    plotRight: width - MARGIN.right,
    plotTop: MARGIN.top,
    plotBottom: height - MARGIN.bottom,
    band: (width - MARGIN.left - MARGIN.right) / Math.max(1, count),
    cx: (index) => MARGIN.left + geometry.band * (index + 0.5),
    y: (value) => height - MARGIN.bottom - (value / top) * (height - MARGIN.top - MARGIN.bottom),
  };
  const labelWidth = Math.max(...labels.map((label) => label.length), 1) * 6.5 + 16;
  const labelEvery = Math.ceil(
    count / Math.max(2, Math.floor((width - MARGIN.left - MARGIN.right) / labelWidth)),
  );

  function onPointerMove(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - box.left) / geometry.band);
    setActive(Math.min(count - 1, Math.max(0, index)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = active ?? count - 1;
    const next =
      event.key === 'ArrowRight'
        ? current + 1
        : event.key === 'ArrowLeft'
          ? current - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null;
    if (event.key === 'Escape') setActive(null);
    if (next === null) return;
    event.preventDefault();
    setActive(Math.min(count - 1, Math.max(0, next)));
  }

  const tooltipLeft = active === null ? 0 : geometry.cx(active);
  const flip = tooltipLeft > width / 2;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`${ariaLabel}. Use the left and right arrow keys to read each period.`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((value) => value ?? count - 1)}
      onBlur={() => setActive(null)}
      className="report-chart relative"
    >
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={geometry.plotLeft}
              x2={geometry.plotRight}
              y1={geometry.y(tick)}
              y2={geometry.y(tick)}
              stroke="var(--viz-grid)"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text x={geometry.plotLeft - 8} y={geometry.y(tick)} dy="0.32em" textAnchor="end">
              {axisFormat(tick)}
            </text>
          </g>
        ))}
        {labels.map((label, index) =>
          (count - 1 - index) % labelEvery === 0 ? (
            <text
              key={`${label}-${index}`}
              x={geometry.cx(index)}
              y={height - 8}
              textAnchor={count > 1 && index === 0 ? 'start' : 'middle'}
            >
              {label}
            </text>
          ) : null,
        )}
        {active !== null && (
          <rect
            x={geometry.plotLeft + geometry.band * active}
            y={geometry.plotTop}
            width={geometry.band}
            height={geometry.plotBottom - geometry.plotTop}
            fill="var(--color-fill)"
            opacity={0.7}
          />
        )}
        {children(geometry, active)}
        <rect
          x={geometry.plotLeft}
          y={geometry.plotTop}
          width={Math.max(0, geometry.plotRight - geometry.plotLeft)}
          height={geometry.plotBottom - geometry.plotTop}
          fill="transparent"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        />
      </svg>
      {active !== null && (
        <div
          role="status"
          className="report-tooltip"
          style={{
            left: tooltipLeft,
            transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, ${MARGIN.top}px)`,
          }}
        >
          <p className="mb-1.5 text-xs text-ink-500">{titles[active]}</p>
          <ul className="space-y-1">
            {series.map((item) => {
              const value = item.values[active];
              return (
                <li key={item.key} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden
                    className={keyShape === 'line' ? 'report-key-line' : 'report-key-box'}
                    style={{ background: item.color }}
                  />
                  <span className="min-w-0 flex-1 text-ink-500">{item.label}</span>
                  <strong className="text-sm font-semibold text-ink-900 tabular">
                    {value === null || value === undefined ? 'Unavailable' : format(value)}
                  </strong>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function seriesMax(series: ChartSeries[], stacked: boolean, count: number) {
  if (!stacked) return Math.max(0, ...series.flatMap((item) => item.values.map((v) => v ?? 0)));
  let max = 0;
  for (let index = 0; index < count; index++) {
    max = Math.max(
      max,
      series.reduce((sum, item) => sum + Math.max(0, item.values[index] ?? 0), 0),
    );
  }
  return max;
}

/** Multi-series trend: 2px lines, ringed end dots, a 10% wash only when there is one series. */
export function LineChart(props: ChartProps) {
  const { series, labels, provisional } = props;
  const single = series.length === 1;
  return (
    <ChartFrame {...props} keyShape="line" max={seriesMax(series, false, labels.length)}>
      {(g, active) =>
        series.map((item) => {
          const points = item.values.map((value, index) =>
            value === null ? null : ([g.cx(index), g.y(Math.max(0, value))] as const),
          );
          let path = '';
          points.forEach((point, index) => {
            if (!point) return;
            path += `${index > 0 && points[index - 1] ? 'L' : 'M'}${point[0]},${point[1]}`;
          });
          const lastIndex = points.findLastIndex(Boolean);
          const last = points[lastIndex];
          const firstIndex = points.findIndex(Boolean);
          return (
            <g key={item.key}>
              {single && last && firstIndex >= 0 && (
                <path
                  d={`${path}L${last[0]},${g.plotBottom}L${points[firstIndex]?.[0]},${g.plotBottom}Z`}
                  fill={item.color}
                  opacity={0.1}
                />
              )}
              <path
                d={path}
                fill="none"
                stroke={item.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {last && (
                <circle
                  cx={last[0]}
                  cy={last[1]}
                  r={4}
                  fill={provisional?.[lastIndex] ? 'var(--viz-surface)' : item.color}
                  stroke={provisional?.[lastIndex] ? item.color : 'var(--viz-surface)'}
                  strokeWidth={2}
                />
              )}
              {active !== null && points[active] && active !== lastIndex && (
                <circle
                  cx={points[active][0]}
                  cy={points[active][1]}
                  r={4}
                  fill={item.color}
                  stroke="var(--viz-surface)"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })
      }
    </ChartFrame>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
}

/** Columns (stacked when given several series): <=24px wide, 4px rounded top, 2px surface gaps. */
export function BarChart(props: ChartProps) {
  const { series, labels, provisional } = props;
  return (
    <ChartFrame {...props} keyShape="box" max={seriesMax(series, true, labels.length)}>
      {(g) =>
        labels.map((label, index) => {
          const width = Math.max(4, Math.min(24, g.band * 0.62));
          const x = g.cx(index) - width / 2;
          const values = series.map((item) => Math.max(0, item.values[index] ?? 0));
          const topSegment = values.findLastIndex((value) => value > 0);
          let base = 0;
          return (
            <g key={`${label}-${index}`} opacity={provisional?.[index] ? 0.5 : 1}>
              {series.map((item, slot) => {
                const value = values[slot] ?? 0;
                if (value <= 0) return null;
                const y0 = g.y(base);
                base += value;
                const y1 = g.y(base);
                const gap = slot === 0 ? 0 : 2;
                const height = Math.max(1, y0 - y1 - gap);
                return slot === topSegment ? (
                  <path key={item.key} d={roundedTop(x, y1, width, height, 4)} fill={item.color} />
                ) : (
                  <rect
                    key={item.key}
                    x={x}
                    y={y1}
                    width={width}
                    height={height}
                    fill={item.color}
                  />
                );
              })}
            </g>
          );
        })
      }
    </ChartFrame>
  );
}

export function Legend({
  items,
  shape,
  note,
}: {
  items: { label: string; color: string }[];
  shape: 'line' | 'box';
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-600">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={shape === 'line' ? 'report-key-line' : 'report-key-box'}
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
      {note && <span className="text-ink-500">{note}</span>}
    </div>
  );
}

/** A small trend line for stat tiles: quiet history, accent on the latest point. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const width = 96;
  const height = 28;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const points = values.map(
    (value, index) =>
      [
        2 + (index / (values.length - 1)) * (width - 6),
        height - 4 - ((value - min) / span) * (height - 8),
      ] as const,
  );
  const last = points.at(-1);
  return (
    <svg width={width} height={height} aria-hidden className={cn('shrink-0', className)}>
      <polyline
        points={points.map((point) => point.join(',')).join(' ')}
        fill="none"
        stroke="var(--viz-quiet)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--viz-1)" />}
    </svg>
  );
}

/** Part-to-whole for a handful of parts: one stacked bar plus a labelled breakdown. */
export function ShareBar({
  parts,
  format,
  ariaLabel,
}: {
  parts: { label: string; value: number; color: string }[];
  format: (value: number) => string;
  ariaLabel: string;
}) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  const visible = parts.filter((part) => part.value > 0);
  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex h-3 gap-0.5 overflow-hidden rounded">
        {total > 0 ? (
          visible.map((part) => (
            <span
              key={part.label}
              className="block h-full"
              style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
            />
          ))
        ) : (
          <span className="block h-full w-full bg-fill" />
        )}
      </div>
      <ul className="mt-4 space-y-2.5">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-2 text-sm">
            <span aria-hidden className="report-key-box" style={{ background: part.color }} />
            <span className="min-w-0 flex-1 text-ink-600">{part.label}</span>
            <strong className="font-semibold text-ink-900 tabular">{format(part.value)}</strong>
            <span className="w-11 text-right text-xs text-ink-500 tabular">
              {total > 0 ? `${Math.round((Math.max(0, part.value) / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
