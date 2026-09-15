import { z } from 'zod';
import { LIMITS } from '@/app/config/constants';
import {
  idempotentPrefixSchema,
  nairaAmountSchema,
  nonNegativeIntSchema,
} from '@/lib/validation/schemas';
import type { InternetPlan, InternetPlanWrite } from '@/types/api';
import { koboToNairaInput } from '@/lib/formatting/money';

export const DURATION_PRESETS = [
  { label: '30 minutes', hours: 0.5 },
  { label: '1 hour', hours: 1 },
  { label: '3 hours', hours: 3 },
  { label: '12 hours', hours: 12 },
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 168 },
  { label: '2 weeks', hours: 336 },
  { label: '30 days', hours: 720 },
] as const;

export const planFormSchema = z.object({
  bandwidth_profile: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1, 'Give the plan a name').max(LIMITS.planNameMax),
  price: nairaAmountSchema({ minKobo: 0 }),
  duration_hours: z.coerce
    .number()
    .finite()
    .min(0.000139)
    .max(596523.235)
    .refine(
      (v) => Math.abs(v * 1e6 - Math.round(v * 1e6)) < 0.001,
      'Use at most six decimal places',
    ),
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
});

export type PlanFormInput = z.input<typeof planFormSchema>;
export type PlanFormOutput = z.output<typeof planFormSchema>;

export function planToForm(plan?: InternetPlan): PlanFormInput {
  return {
    bandwidth_profile: plan?.bandwidth_profile,
    plan_type: plan?.plan_type ?? 'voucher',
    is_public: plan?.is_public ?? true,
    agent_enabled: plan?.agent_enabled ?? true,
    public_router: plan?.public_router ?? null,
    name: plan?.name ?? '',
    price: plan ? koboToNairaInput(plan.price) : '',
    duration_hours: plan?.duration_hours ?? 24,
    rate_limit: plan?.rate_limit ?? '5M/10M',
    data_limit_mb: plan?.data_limit ?? 0,
    voucher_prefix: plan?.voucher_prefix ?? '',
    voucher_code_format: plan?.voucher_code_format ?? 'legacy',
    is_active: plan?.is_active ?? true,
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
    duration_hours: values.duration_hours,
    rate_limit: values.rate_limit,
    data_limit: values.data_limit_mb,
    voucher_prefix: values.voucher_prefix,
    voucher_code_format: values.voucher_code_format,
    is_active: values.is_active,
  };
}
