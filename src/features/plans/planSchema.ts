import { z } from 'zod';
import { LIMITS } from '@/app/config/constants';
import {
  idempotentPrefixSchema,
  nairaAmountSchema,
  nonNegativeIntSchema,
} from '@/lib/validation/schemas';
import type { InternetPlan, InternetPlanWrite } from '@/types/api';
import { koboToNairaInput } from '@/lib/formatting/money';
import { speedInput, toKbps } from './bandwidth';

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

/** Upload/download unit dropdowns. Display labels use capital K (Kbps). */
export const SPEED_UNITS = [
  { value: 'Kbps', label: 'Kbps' },
  { value: 'Mbps', label: 'Mbps' },
  { value: 'Gbps', label: 'Gbps' },
] as const;
export type SpeedUnit = (typeof SPEED_UNITS)[number]['value'];

/** Parsed simple `upload/download` expression, in whole Kbps. */
export interface ParsedSpeed {
  uploadKbps: number;
  downloadKbps: number;
}

/**
 * Convert a speed amount + unit to whole Kbps using the shared decimal rules
 * (1 Mbps = 1,000 Kbps, 1 Gbps = 1,000,000 Kbps). Throws with a plain-language
 * message when the result is not a whole number of Kbps in range.
 */
export function speedToKbps(value: string, unit: SpeedUnit): number {
  return toKbps(value, unit === 'Kbps' ? 'kbps' : unit);
}

/** Whole Kbps → amount + unit inputs, reusing the shared best-unit display. */
export function kbpsToSpeedFields(kbps: number): { value: string; unit: SpeedUnit } {
  const { value, unit } = speedInput(kbps);
  return { value, unit: unit === 'kbps' ? 'Kbps' : unit === 'Gbps' ? 'Gbps' : 'Mbps' };
}

/** Whole-Kbps pair → RouterOS `upload/download` string, e.g. `5000k/10000k`. */
export function formatRateLimit(uploadKbps: number, downloadKbps: number): string {
  return `${uploadKbps}k/${downloadKbps}k`;
}

/**
 * Parse a stored `rate_limit` into whole-Kbps upload/download speeds.
 * Returns null for blank values and for complex RouterOS expressions these
 * fields cannot represent (unparseable tokens, fractional Kbps results, or
 * values outside 1 Kbps–10 Gbps). Bare numbers follow the same Mbps
 * convention as the plan summary display.
 */
export function parseSimpleRateLimit(
  rate: string | null | undefined,
): ParsedSpeed | null {
  const trimmed = (rate ?? '').trim();
  if (!trimmed) return null;
  const match = /^(\d+(?:\.\d+)?)\s*([kKmMgG])?\s*\/\s*(\d+(?:\.\d+)?)\s*([kKmMgG])?$/.exec(trimmed);
  if (!match) return null;
  const [, upValue = '', upSuffix, downValue = '', downSuffix] = match;
  const unitFor = (suffix: string | undefined): SpeedUnit => {
    switch ((suffix ?? 'm').toLowerCase()) {
      case 'k':
        return 'Kbps';
      case 'g':
        return 'Gbps';
      default:
        return 'Mbps';
    }
  };
  try {
    return {
      uploadKbps: speedToKbps(upValue, unitFor(upSuffix)),
      downloadKbps: speedToKbps(downValue, unitFor(downSuffix)),
    };
  } catch {
    return null;
  }
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
    upload_value: z.string().trim(),
    upload_unit: z.enum(['Kbps', 'Mbps', 'Gbps']).default('Mbps'),
    download_value: z.string().trim(),
    download_unit: z.enum(['Kbps', 'Mbps', 'Gbps']).default('Mbps'),
    /** Raw complex RouterOS expression preserved verbatim when set. */
    custom_rate_limit: z.string().trim().max(50).default(''),
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
    if (!values.custom_rate_limit.trim()) {
      const upload = values.upload_value.trim();
      const download = values.download_value.trim();
      if (!!upload !== !!download) {
        ctx.addIssue({
          code: 'custom',
          path: [!upload ? 'upload_value' : 'download_value'],
          message: 'Enter both upload and download speeds, or leave both blank for no plan speed limit.',
        });
      } else if (upload && download) {
        for (const [field, text, unit] of [
          ['upload_value', upload, values.upload_unit],
          ['download_value', download, values.download_unit],
        ] as const) {
          try {
            speedToKbps(text, unit);
          } catch (error) {
            ctx.addIssue({
              code: 'custom',
              path: [field],
              message: error instanceof Error ? error.message : 'Enter a valid speed.',
            });
          }
        }
      }
    }
  });

export type PlanFormInput = z.input<typeof planFormSchema>;
export type PlanFormOutput = z.output<typeof planFormSchema>;

export function planToForm(plan?: InternetPlan): PlanFormInput {
  const { value, unit } = fromDurationHours(plan?.duration_hours ?? 24);
  const dataLimit = plan?.data_limit ?? 0;
  const rawRate = (plan?.rate_limit ?? '').trim();
  const parsed = rawRate ? parseSimpleRateLimit(rawRate) : null;
  const upload = parsed ? kbpsToSpeedFields(parsed.uploadKbps) : { value: '', unit: 'Mbps' as const };
  const download = parsed
    ? kbpsToSpeedFields(parsed.downloadKbps)
    : { value: '', unit: 'Mbps' as const };
  return {
    // Hotspot plans set speeds directly; any linked profile is detached on save.
    bandwidth_profile: null,
    plan_type: plan?.plan_type ?? 'voucher',
    is_public: plan?.is_public ?? true,
    agent_enabled: plan?.agent_enabled ?? true,
    public_router: plan?.public_router ?? null,
    name: plan?.name ?? '',
    price: plan ? koboToNairaInput(plan.price) : '',
    duration_value: value,
    duration_unit: unit,
    data_mode: dataLimit > 0 ? 'limited' : 'unlimited',
    upload_value: plan ? upload.value : '5',
    upload_unit: plan ? upload.unit : 'Mbps',
    download_value: plan ? download.value : '10',
    download_unit: plan ? download.unit : 'Mbps',
    custom_rate_limit: rawRate && !parsed ? rawRate : '',
    data_limit_mb: dataLimit,
    voucher_prefix: plan?.voucher_prefix ?? '',
    voucher_code_format: plan?.voucher_code_format ?? 'legacy',
    is_active: plan?.is_active ?? true,
    max_devices: plan?.max_devices ?? 1,
  };
}

export function formToPlan(values: PlanFormOutput): InternetPlanWrite {
  const custom = values.custom_rate_limit.trim();
  let rate_limit: string;
  if (custom) {
    rate_limit = custom;
  } else {
    const upload = values.upload_value.trim();
    const download = values.download_value.trim();
    rate_limit =
      !upload && !download
        ? ''
        : formatRateLimit(
            speedToKbps(upload, values.upload_unit),
            speedToKbps(download, values.download_unit),
          );
  }
  return {
    // Hotspot plans always detach any linked profile so later profile edits
    // cannot silently change the plan's speeds.
    bandwidth_profile: null,
    plan_type: values.plan_type,
    is_public: values.is_public,
    agent_enabled: values.agent_enabled,
    public_router: values.plan_type === 'iot_mac' ? values.public_router : null,
    name: values.name,
    price: values.price,
    duration_hours: toDurationHours(values.duration_value, values.duration_unit),
    rate_limit,
    data_limit: values.data_mode === 'limited' ? values.data_limit_mb : 0,
    voucher_prefix: values.voucher_prefix,
    voucher_code_format: values.voucher_code_format,
    is_active: values.is_active,
    max_devices: values.max_devices,
  };
}
