import { describe, expect, it } from 'vitest';
import {
  describeDuration,
  formatRateLimit,
  formToPlan,
  fromDurationHours,
  kbpsToSpeedFields,
  parseSimpleRateLimit,
  planFormSchema,
  planToForm,
  speedToKbps,
  toDurationHours,
  toDataLimitMb,
  fromDataLimitMb,
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
    for (const hours of [
      0.000139, 0.008333, 0.333333, 0.5, 1, 1.5, 3, 12, 24, 26.5, 72, 168, 336, 720,
    ]) {
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

describe('speed value/unit conversion', () => {
  it('converts decimal units to whole Kbps', () => {
    expect(speedToKbps('5', 'Mbps')).toBe(5000);
    expect(speedToKbps('10', 'Mbps')).toBe(10000);
    expect(speedToKbps('2.5', 'Mbps')).toBe(2500);
    expect(speedToKbps('1', 'Gbps')).toBe(1000000);
    expect(speedToKbps('1.5', 'Gbps')).toBe(1500000);
    expect(speedToKbps('512', 'Kbps')).toBe(512);
  });

  it('rejects fractional Kbps results and out-of-range speeds', () => {
    expect(() => speedToKbps('0.0001', 'Mbps')).toThrow();
    expect(() => speedToKbps('0', 'Kbps')).toThrow();
    expect(() => speedToKbps('11', 'Gbps')).toThrow();
    expect(() => speedToKbps('fast', 'Mbps')).toThrow();
    expect(speedToKbps('10', 'Gbps')).toBe(10000000);
    expect(speedToKbps('1', 'Kbps')).toBe(1);
  });

  it('presents Kbps in the best unit for editing', () => {
    expect(kbpsToSpeedFields(5000)).toEqual({ value: '5', unit: 'Mbps' });
    expect(kbpsToSpeedFields(10000)).toEqual({ value: '10', unit: 'Mbps' });
    expect(kbpsToSpeedFields(2500)).toEqual({ value: '2.5', unit: 'Mbps' });
    expect(kbpsToSpeedFields(512)).toEqual({ value: '512', unit: 'Kbps' });
    expect(kbpsToSpeedFields(10000000)).toEqual({ value: '10', unit: 'Gbps' });
  });

  it('builds RouterOS upload/download strings', () => {
    expect(formatRateLimit(5000, 10000)).toBe('5000k/10000k');
  });

  it('parses simple stored expressions and leaves complex ones alone', () => {
    expect(parseSimpleRateLimit('5M/10M')).toEqual({ uploadKbps: 5000, downloadKbps: 10000 });
    expect(parseSimpleRateLimit('2500k/10000k')).toEqual({
      uploadKbps: 2500,
      downloadKbps: 10000,
    });
    expect(parseSimpleRateLimit('2.5M/10M')).toEqual({ uploadKbps: 2500, downloadKbps: 10000 });
    expect(parseSimpleRateLimit('')).toBeNull();
    expect(parseSimpleRateLimit('  ')).toBeNull();
    // No plan speed limit on one side, fractional Kbps, and bursting expressions stay custom.
    expect(parseSimpleRateLimit('5M/')).toBeNull();
    expect(parseSimpleRateLimit('0.0001M/10M')).toBeNull();
    expect(parseSimpleRateLimit('5M/10M 1M/2M')).toBeNull();
    expect(parseSimpleRateLimit('fast')).toBeNull();
  });
});

describe('plan form schema', () => {
  it('converts naira input to kobo, speeds to a rate string and limited MB to data_limit', () => {
    const parsed = planFormSchema.parse({
      name: ' Daily ',
      price: '1,500.50',
      duration_value: '24',
      duration_unit: 'hours',
      data_mode: 'limited',
      upload_value: '5',
      upload_unit: 'Mbps',
      download_value: '10',
      download_unit: 'Mbps',
      data_limit_mb: '1024',
      voucher_prefix: 'DAY',
      is_active: true,
    });
    expect(formToPlan(parsed)).toEqual({
      bandwidth_profile: null,
      name: 'Daily',
      plan_type: 'voucher',
      is_public: true,
      agent_enabled: true,
      public_router: null,
      price: 150050,
      duration_hours: 24,
      rate_limit: '5000k/10000k',
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
      upload_value: '',
      download_value: '',
      is_active: true,
    });
    expect(formToPlan(unlimited)).toMatchObject({ data_limit: 0, rate_limit: '' });

    const missing = planFormSchema.safeParse({
      ...planToForm(),
      name: 'Limited',
      price: '10',
      duration_value: 1,
      duration_unit: 'days',
      data_mode: 'limited',
      data_limit_mb: 0,
      upload_value: '',
      download_value: '',
      is_active: true,
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues.map((i) => i.path[0])).toContain('data_limit_mb');
    }
  });

  it('accepts blank speeds for no limit but rejects only one side blank', () => {
    const blank = planFormSchema.parse({
      ...planToForm(),
      name: 'No limit',
      price: '10',
      duration_value: 1,
      duration_unit: 'days',
      upload_value: '',
      download_value: '',
      is_active: true,
    });
    expect(formToPlan(blank)).toMatchObject({ rate_limit: '' });

    const half = planFormSchema.safeParse({
      ...planToForm(),
      name: 'Half limit',
      price: '10',
      duration_value: 1,
      duration_unit: 'days',
      upload_value: '5',
      upload_unit: 'Mbps',
      download_value: '',
      is_active: true,
    });
    expect(half.success).toBe(false);
    if (!half.success) {
      expect(half.error.issues.map((i) => i.path[0])).toContain('download_value');
    }
  });

  it('rejects bad speeds, negative data caps and long prefixes', () => {
    const res = planFormSchema.safeParse({
      name: 'x',
      price: '10',
      duration_value: 1,
      duration_unit: 'hours',
      upload_value: 'fast',
      upload_unit: 'Mbps',
      download_value: '10',
      download_unit: 'Mbps',
      data_limit_mb: -1,
      voucher_prefix: 'TOOLONGPREFIX',
      is_active: true,
    });
    expect(res.success).toBe(false);
    const paths = res.success ? [] : res.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(
      expect.arrayContaining(['upload_value', 'data_limit_mb', 'voucher_prefix']),
    );
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
        upload_value: '',
        download_value: '',
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
        upload_value: '',
        download_value: '',
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
      upload_value: '',
      download_value: '',
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
          upload_value: '',
          download_value: '',
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
        upload_value: '',
        download_value: '',
        data_limit_mb: 0,
        voucher_prefix: '',
        is_active: true,
        max_devices: 10,
      }).success,
    ).toBe(true);
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
      upload_value: '10',
      upload_unit: 'Mbps',
      download_value: '20',
      download_unit: 'Mbps',
      custom_rate_limit: '',
      is_active: false,
      max_devices: 5,
    });
    expect(formToPlan(planFormSchema.parse({ ...form }))).toMatchObject({
      bandwidth_profile: null,
      duration_hours: 168,
      rate_limit: '10000k/20000k',
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
      upload_value: '5',
      download_value: '5',
    });
    expect(formToPlan(planFormSchema.parse({ ...form }))).toMatchObject({
      duration_hours: 0.333333,
      rate_limit: '5000k/5000k',
      data_limit: 512,
    });
  });

  it('keeps a complex stored expression verbatim until explicitly replaced', () => {
    const form = planToForm({
      id: 3,
      name: 'Burst',
      price: 10000,
      price_display: '₦100',
      duration_hours: 24,
      rate_limit: '5M/10M 1M/2M',
      data_limit: 0,
      voucher_prefix: '',
      is_active: true,
      max_devices: 1,
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(form).toMatchObject({
      upload_value: '',
      download_value: '',
      custom_rate_limit: '5M/10M 1M/2M',
    });
    expect(formToPlan(planFormSchema.parse({ ...form }))).toMatchObject({
      bandwidth_profile: null,
      rate_limit: '5M/10M 1M/2M',
    });
  });

  it('detaches a linked bandwidth profile on save', () => {
    const form = planToForm({
      id: 4,
      name: 'Linked',
      price: 10000,
      price_display: '₦100',
      duration_hours: 24,
      rate_limit: '5M/10M',
      bandwidth_profile: 7,
      data_limit: 0,
      voucher_prefix: '',
      is_active: true,
      max_devices: 1,
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(form.bandwidth_profile).toBeNull();
    expect(formToPlan(planFormSchema.parse({ ...form }))).toMatchObject({
      bandwidth_profile: null,
      rate_limit: '5000k/10000k',
    });
  });
});

describe('compatible plan terms', () => {
  it('preserves fractional duration, private sales flags and blank speeds', () => {
    const parsed = planFormSchema.parse({
      ...planToForm(),
      name: 'Short private plan',
      price: '10',
      duration_value: '20',
      duration_unit: 'minutes',
      upload_value: '',
      download_value: '',
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
      planFormSchema.safeParse({
        ...parsed,
        price: '10',
        duration_value: 0.0001,
        duration_unit: 'hours',
      }).success,
    ).toBe(false);
  });
});

describe('data limit units', () => {
  const base = {
    name: 'Daily',
    price: '500',
    duration_value: '1',
    duration_unit: 'days',
    data_mode: 'limited',
    upload_value: '',
    download_value: '',
    voucher_prefix: '',
    is_active: true,
  } as const;

  it('stores GB amounts as whole megabytes, including fractions', () => {
    expect(toDataLimitMb(2, 'GB')).toBe(2048);
    expect(toDataLimitMb(1.5, 'GB')).toBe(1536);
    const parsed = planFormSchema.parse({ ...base, data_limit_mb: '1.5', data_unit: 'GB' });
    expect(formToPlan(parsed).data_limit).toBe(1536);
  });

  it('keeps the API megabyte meaning when no unit is given', () => {
    const parsed = planFormSchema.parse({ ...base, data_limit_mb: '1024' });
    expect(formToPlan(parsed).data_limit).toBe(1024);
  });

  it('opens exact gigabyte limits in GB and other limits in MB', () => {
    expect(fromDataLimitMb(5120)).toEqual({ amount: 5, unit: 'GB' });
    expect(fromDataLimitMb(1500)).toEqual({ amount: 1500, unit: 'MB' });
    expect(planToForm()).toMatchObject({ data_unit: 'GB' });
  });

  it('rejects fractional megabytes and empty limits', () => {
    expect(
      planFormSchema.safeParse({ ...base, data_limit_mb: '10.5', data_unit: 'MB' }).success,
    ).toBe(false);
    expect(planFormSchema.safeParse({ ...base, data_limit_mb: '0', data_unit: 'GB' }).success).toBe(
      false,
    );
  });
});
