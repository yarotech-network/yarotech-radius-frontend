import { describe, expect, it } from 'vitest';
import {
  describeDuration,
  formToPlan,
  fromDurationHours,
  planFormSchema,
  planToForm,
  toDurationHours,
} from './planSchema';

describe('duration value/unit conversion', () => {
  it('converts minutes, hours and days to hours with backend precision', () => {
    expect(toDurationHours(30, 'minutes')).toBe(0.5);
    expect(toDurationHours(90, 'minutes')).toBe(1.5);
    expect(toDurationHours(20, 'minutes')).toBe(0.333333);
    expect(toDurationHours(24, 'hours')).toBe(24);
    expect(toDurationHours(1, 'days')).toBe(24);
    expect(toDurationHours(7, 'days')).toBe(168);
    expect(toDurationHours(1.5, 'hours')).toBe(1.5);
  });

  it('presents stored durations in the best unit without altering them on save', () => {
    expect(fromDurationHours(24)).toEqual({ value: 1, unit: 'days' });
    expect(fromDurationHours(168)).toEqual({ value: 7, unit: 'days' });
    expect(fromDurationHours(720)).toEqual({ value: 30, unit: 'days' });
    expect(fromDurationHours(0.5)).toEqual({ value: 30, unit: 'minutes' });
    expect(fromDurationHours(1.5)).toEqual({ value: 90, unit: 'minutes' });
    expect(fromDurationHours(0.333333)).toEqual({ value: 20, unit: 'minutes' });
    // Very short durations stay in hours so no precision is lost.
    expect(fromDurationHours(0.008333)).toEqual({ value: 0.008333, unit: 'hours' });
  });

  it('round-trips stored durations exactly, including short and fractional values', () => {
    for (const hours of [0.000139, 0.008333, 0.333333, 0.5, 1, 1.5, 3, 12, 24, 26.5, 72, 168, 336, 720]) {
      const { value, unit } = fromDurationHours(hours);
      expect(toDurationHours(value, unit)).toBe(hours);
    }
  });

  it('describes durations for the summary', () => {
    expect(describeDuration(30, 'minutes')).toBe('30 minutes');
    expect(describeDuration(1, 'days')).toBe('1 day');
    expect(describeDuration(3, 'days')).toBe('3 days');
    expect(describeDuration(1, 'hours')).toBe('1 hour');
  });
});

describe('plan form schema', () => {
  it('converts naira input to kobo and limited MB to data_limit', () => {
    const parsed = planFormSchema.parse({
      name: ' Daily ',
      price: '1,500.50',
      duration_value: '24',
      duration_unit: 'hours',
      data_mode: 'limited',
      rate_limit: '5M/10M',
      data_limit_mb: '1024',
      voucher_prefix: 'DAY',
      is_active: true,
    });
    expect(formToPlan(parsed)).toEqual({
      name: 'Daily',
      plan_type: 'voucher',
      is_public: true,
      agent_enabled: true,
      public_router: null,
      price: 150050,
      duration_hours: 24,
      rate_limit: '5M/10M',
      data_limit: 1024,
      voucher_prefix: 'DAY',
      voucher_code_format: 'legacy',
      is_active: true,
      max_devices: 1,
    });
  });

  it('submits 0 for unlimited data and requires a limit for limited data', () => {
    const unlimited = planFormSchema.parse({
      ...planToForm(),
      name: 'Unlimited',
      price: '10',
      duration_value: 1,
      duration_unit: 'days',
      data_mode: 'unlimited',
      data_limit_mb: 0,
      rate_limit: '',
      is_active: true,
    });
    expect(formToPlan(unlimited)).toMatchObject({ data_limit: 0 });

    const missing = planFormSchema.safeParse({
      ...planToForm(),
      name: 'Limited',
      price: '10',
      duration_value: 1,
      duration_unit: 'days',
      data_mode: 'limited',
      data_limit_mb: 0,
      rate_limit: '',
      is_active: true,
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues.map((i) => i.path[0])).toContain('data_limit_mb');
    }
  });

  it('accepts minute and day durations within the backend range', () => {
    for (const [duration_value, duration_unit, duration_hours] of [
      [30, 'minutes', 0.5],
      [1, 'days', 24],
      [90, 'minutes', 1.5],
    ] as const) {
      const parsed = planFormSchema.parse({
        ...planToForm(),
        name: 'Timed',
        price: '10',
        duration_value,
        duration_unit,
        rate_limit: '',
        is_active: true,
      });
      expect(formToPlan(parsed)).toMatchObject({ duration_hours });
    }
    expect(
      planFormSchema.safeParse({
        ...planToForm(),
        name: 'Too short',
        price: '10',
        duration_value: 0.0001,
        duration_unit: 'hours',
        rate_limit: '',
        is_active: true,
      }).success,
    ).toBe(false);
  });

  it('defaults maximum devices to 1 and rejects out-of-range counts', () => {
    const parsed = planFormSchema.parse({
      name: 'Family',
      price: '10',
      duration_value: 24,
      duration_unit: 'hours',
      rate_limit: '',
      data_limit_mb: 0,
      voucher_prefix: '',
      is_active: true,
    });
    expect(parsed.max_devices).toBe(1);
    expect(formToPlan(parsed)).toMatchObject({ max_devices: 1 });
    for (const max_devices of [0, -1, 11, 100, 1.5]) {
      expect(
        planFormSchema.safeParse({
          name: 'Family',
          price: '10',
          duration_value: 24,
          duration_unit: 'hours',
          rate_limit: '',
          data_limit_mb: 0,
          voucher_prefix: '',
          is_active: true,
          max_devices,
        }).success,
      ).toBe(false);
    }
    expect(
      planFormSchema.safeParse({
        name: 'Family',
        price: '10',
        duration_value: 24,
        duration_unit: 'hours',
        rate_limit: '',
        data_limit_mb: 0,
        voucher_prefix: '',
        is_active: true,
        max_devices: 10,
      }).success,
    ).toBe(true);
  });

  it('rejects bad rate limits, negative data caps and long prefixes', () => {
    const res = planFormSchema.safeParse({
      name: 'x',
      price: '10',
      duration_value: 1,
      duration_unit: 'hours',
      rate_limit: 'fast',
      data_limit_mb: -1,
      voucher_prefix: 'TOOLONGPREFIX',
      is_active: true,
    });
    expect(res.success).toBe(false);
    const paths = res.success ? [] : res.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(
      expect.arrayContaining(['rate_limit', 'data_limit_mb', 'voucher_prefix']),
    );
  });

  it('round-trips an existing plan into form values without altering stored settings', () => {
    const form = planToForm({
      id: 1,
      name: 'Weekly',
      price: 250000,
      price_display: '₦2,500',
      duration_hours: 168,
      rate_limit: '10M/20M',
      data_limit: 0,
      voucher_prefix: 'WK',
      is_active: false,
      max_devices: 5,
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(form).toMatchObject({
      name: 'Weekly',
      price: '2500',
      duration_value: 7,
      duration_unit: 'days',
      data_mode: 'unlimited',
      is_active: false,
      max_devices: 5,
    });
    expect(formToPlan(planFormSchema.parse({ ...form }))).toMatchObject({
      duration_hours: 168,
      data_limit: 0,
      max_devices: 5,
    });
  });

  it('preserves a fractional stored duration and a data cap on unchanged save', () => {
    const form = planToForm({
      id: 2,
      name: 'Short',
      price: 10000,
      price_display: '₦100',
      duration_hours: 0.333333,
      rate_limit: '5M/5M',
      data_limit: 512,
      voucher_prefix: '',
      is_active: true,
      max_devices: 1,
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(form).toMatchObject({
      duration_value: 20,
      duration_unit: 'minutes',
      data_mode: 'limited',
      data_limit_mb: 512,
    });
    expect(formToPlan(planFormSchema.parse({ ...form }))).toMatchObject({
      duration_hours: 0.333333,
      data_limit: 512,
    });
  });
});

describe('compatible plan terms', () => {
  it('preserves fractional duration, private sales flags and an empty rate', () => {
    const parsed = planFormSchema.parse({
      ...planToForm(),
      name: 'Short private plan',
      price: '10',
      duration_value: '20',
      duration_unit: 'minutes',
      rate_limit: '',
      is_public: false,
      agent_enabled: false,
    });
    expect(formToPlan(parsed)).toMatchObject({
      duration_hours: 0.333333,
      rate_limit: '',
      is_public: false,
      agent_enabled: false,
    });
    expect(
      planFormSchema.safeParse({ ...parsed, price: '10', duration_value: 0.0001, duration_unit: 'hours' })
        .success,
    ).toBe(false);
  });
});
