import { describe, expect, it } from 'vitest';
import { formToPlan, planFormSchema, planToForm } from './planSchema';

describe('plan form schema', () => {
  it('converts naira input to kobo and MB to data_limit', () => {
    const parsed = planFormSchema.parse({
      name: ' Daily ',
      price: '1,500.50',
      duration_hours: '24',
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
  it('defaults maximum devices to 1 and rejects out-of-range counts', () => {
    const parsed = planFormSchema.parse({
      name: 'Family',
      price: '10',
      duration_hours: 24,
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
          duration_hours: 24,
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
        duration_hours: 24,
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
      duration_hours: 1,
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
  it('round-trips an existing plan into form values', () => {
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
      duration_hours: 168,
      is_active: false,
      max_devices: 5,
    });
    expect(formToPlan(planFormSchema.parse({ ...form }))).toMatchObject({ max_devices: 5 });
  });
});

describe('compatible plan terms', () => {
  it('preserves fractional duration, private sales flags and an empty rate', () => {
    const parsed = planFormSchema.parse({
      ...planToForm(),
      name: 'Short private plan',
      price: '10',
      duration_hours: '0.333333',
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
      planFormSchema.safeParse({ ...parsed, price: '10', duration_hours: 0.000001 }).success,
    ).toBe(false);
  });
});
