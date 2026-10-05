import { describe, expect, it } from 'vitest';
import type { ReportRow, TenantReport } from './api';
import { niceTicks, percentChange, previousRange, reportCsv, weekdayPattern } from './reportMath';

function day(start: string, activated: number, complete = true): ReportRow {
  return {
    start,
    end_exclusive: start,
    in_progress: !complete,
    complete,
    activated_value: activated,
    collections: 0,
    active_vouchers: null,
  };
}

describe('report maths', () => {
  it('finds the previous equal-length range across month boundaries', () => {
    expect(previousRange('2026-09-04', '2026-10-03')).toEqual({
      from: '2026-08-05',
      to: '2026-09-03',
      days: 30,
    });
    expect(previousRange('2026-03-01', '2026-03-01')).toEqual({
      from: '2026-02-28',
      to: '2026-02-28',
      days: 1,
    });
  });

  it('has no percentage change without a baseline', () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(percentChange(500, undefined)).toBeNull();
    expect(percentChange(150, 100)).toBe(50);
  });

  it('builds clean axis ticks that cover the maximum', () => {
    expect(niceTicks(950)).toEqual([0, 250, 500, 750, 1000]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(7).at(-1)).toBeGreaterThanOrEqual(7);
  });

  it('averages complete days per weekday and ignores the day in progress', () => {
    // 2026-09-07 is a Monday; two full weeks, then an in-progress Monday that must not count.
    const rows = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 8, 7 + index)).toISOString().slice(0, 10);
      return day(date, index % 7 === 5 ? 9000 : 1000);
    });
    rows.push(day('2026-09-21', 0, false));
    const pattern = weekdayPattern(rows);
    expect(pattern?.bestDay).toBe('Saturday');
    expect(pattern?.averages[0]).toBe(1000);
    expect(weekdayPattern(rows.slice(0, 10))).toBeNull();
  });

  it('exports naira values and leaves unavailable cells blank', () => {
    const csv = reportCsv({ rows: [day('2026-10-02', 12345)] } as TenantReport);
    const [header, line] = csv.split('\r\n');
    expect(header).toContain('Activated value (NGN)');
    expect(line).toBe('2026-10-02,2026-10-02,Complete,123.45,0.00,,,,');
  });
});
