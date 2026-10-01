import { z } from 'zod';
import { LIMITS } from '@/app/config/constants';
import {
  idempotentPrefixSchema,
  nairaAmountSchema,
  nonNegativeIntSchema,
} from '@/lib/validation/schemas';
import type { InternetPlan, InternetPlanWrite } from '@/types/api';
import { koboToNairaInput } from '@/lib/formatting/money';

/** Duration units shown beside the duration amount (portal content reference). */
export const DURATION_UNITS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number]['value'];

/** Data allowance choice (portal content reference). */
export const DATA_MODES = [
  { value: 'unlimited', label: 'Unlimited data' },
  { value: 'limited', label: 'Limited data' },
] as const;
export type DataMode = (typeof DATA_MODES)[number]['value'];

/** Backend `duration_hours` precision: six decimal places. */
const DURATION_PRECISION = 1e6;
/** Shortest duration the API accepts, in hours (0.5 seconds). */
const MIN_DURATION_HOURS = 0.000139;
const MAX_DURATION_HOURS = 596523.235;

const HOURS_PER_UNIT: Record<DurationUnit, number> = {
  minutes: 1 / 60,
  hours: 1,
  days: 24,
};

function roundDurationHours(hours: number): number {
  return Math.round(hours * DURATION_PRECISION) / DURATION_PRECISION;
}

/** Presentation value + unit → stored `duration_hours`, rounded to backend precision. */
export function toDurationHours(value: number, unit: DurationUnit): number {
  return roundDurationHours(value * HOURS_PER_UNIT[unit]);
}

/**
 * Stored `duration_hours` → presentation value + unit, mirroring the portal's
 * best-unit display (days, then hours, then minutes) with one hard guarantee:
 * converting the result back with {@link toDurationHours} returns the stored
 * value exactly, so saving an existing plan unchanged never alters it.
 */
export function fromDurationHours(hours: number): { value: number; unit: DurationUnit } {
  const h = roundDurationHours(hours);
  const days = h / 24;
  if (Number.isInteger(days)) return { value: days, unit: 'days' };
  if (Number.isInteger(h)) return { value: h, unit: 'hours' };
  const minutes = Math.round(h * 60);
  if (Number.isSafeInteger(minutes) && toDurationHours(minutes, 'minutes') === h) {
    return { value: minutes, unit: 'minutes' };
  }
  return { value: h, unit: 'hours' };
}

/** Human duration for the compact summary, e.g. "30 minutes", "1 day". */
export function describeDuration(value: number | null | undefined, unit: DurationUnit): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '—';
  const label =
    unit === 'minutes' ? 'minute' : unit === 'days' ? 'day' : 'hour';
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}

export const planFormSchema = z
  .object({
    bandwidth_profile: z.number().int().positive().nullable().optional(),
    name: z.string().trim().min(1, 'Give the plan a name').max(LIMITS.planNameMax),
    price: nairaAmountSchema({ minKobo: 0 }),
    duration_value: z.coerce
      .number()
      .finite('Enter a duration amount')
      .positive('Duration must be greater than 0'),
    duration_unit: z.enum(['minutes', 'hours', 'days']).default('hours'),
    data_mode: z.enum(['unlimited', 'limited']).default('unlimited'),
    rate_limit: z
      .string()
      .trim()
      .max(50)
      .regex(/^[0-9kKmMgG./ ]*$/, 'Enter a numeric rate, e.g. 5M/10M'),
    plan_type: z.enum(['voucher', 'iot_mac']).default('voucher'),
    is_public: z.boolean().default(true),
    agent_enabled: z.boolean().default(true),
    public_router: z.string().uuid().nullable().default(null),
    data_limit_mb: nonNegativeIntSchema('Data limit'),
    voucher_prefix: idempotentPrefixSchema,
    voucher_code_format: z.enum(['legacy', 'tenant_default', 'numeric', 'alphabetic', 'alphanumeric']).default('legacy'),
    is_active: z.boolean(),
    max_devices: z.coerce.number().int().min(1).max(10).default(1),
  })
  .superRefine((values, ctx) => {
    const hours = toDurationHours(values.duration_value, values.duration_unit);
    if (!(hours >= MIN_DURATION_HOURS)) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration_value'],
        message: 'Duration is too short (minimum 0.5 seconds).',
      });
    } else if (!(hours <= MAX_DURATION_HOURS)) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration_value'],
        message: 'Duration is too long.',
      });
    }
    if (values.data_mode === 'limited' && !(values.data_limit_mb >= 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['data_limit_mb'],
        message: 'Enter a data limit in MB for limited plans.',
      });
    }
  });

export type PlanFormInput = z.input<typeof planFormSchema>;
export type PlanFormOutput = z.output<typeof planFormSchema>;

export function planToForm(plan?: InternetPlan): PlanFormInput {
  const { value, unit } = fromDurationHours(plan?.duration_hours ?? 24);
  const dataLimit = plan?.data_limit ?? 0;
  return {
    bandwidth_profile: plan?.bandwidth_profile,
    plan_type: plan?.plan_type ?? 'voucher',
    is_public: plan?.is_public ?? true,
    agent_enabled: plan?.agent_enabled ?? true,
    public_router: plan?.public_router ?? null,
    name: plan?.name ?? '',
    price: plan ? koboToNairaInput(plan.price) : '',
    duration_value: value,
    duration_unit: unit,
    data_mode: dataLimit > 0 ? 'limited' : 'unlimited',
    rate_limit: plan?.rate_limit ?? '5M/10M',
    data_limit_mb: dataLimit,
    voucher_prefix: plan?.voucher_prefix ?? '',
    voucher_code_format: plan?.voucher_code_format ?? 'legacy',
    is_active: plan?.is_active ?? true,
    max_devices: plan?.max_devices ?? 1,
  };
}

export function formToPlan(values: PlanFormOutput): InternetPlanWrite {
  return {
    ...(values.bandwidth_profile !== undefined
      ? { bandwidth_profile: values.bandwidth_profile }
      : {}),
    plan_type: values.plan_type,
    is_public: values.is_public,
    agent_enabled: values.agent_enabled,
    public_router: values.plan_type === 'iot_mac' ? values.public_router : null,
    name: values.name,
    price: values.price,
    duration_hours: toDurationHours(values.duration_value, values.duration_unit),
    rate_limit: values.rate_limit,
    data_limit: values.data_mode === 'limited' ? values.data_limit_mb : 0,
    voucher_prefix: values.voucher_prefix,
    voucher_code_format: values.voucher_code_format,
    is_active: values.is_active,
    max_devices: values.max_devices,
  };
}
