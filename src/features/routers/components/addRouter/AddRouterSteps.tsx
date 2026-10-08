import { useState, type ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { ChevronDown, Network, PlugZap, Router as RouterIcon } from 'lucide-react';
import { Checkbox, FormField, Input, Select, Textarea } from '@/components/ui';
import { automaticDhcpRange, parseCidr } from '@/lib/network/ipv4';
import { cn } from '@/lib/utilities/cn';
import {
  ADVANCED_NETWORK_FIELDS,
  ADVANCED_ROUTER_FIELDS,
  type AddRouterField,
  type AddRouterValues,
} from './model';

type Form = UseFormReturn<AddRouterValues>;

/** A collapsible "Advanced" area that opens by itself when one of its fields has an error. */
function Advanced({
  form,
  fields,
  title,
  children,
}: {
  form: Form;
  fields: readonly AddRouterField[];
  title: string;
  children: ReactNode;
}) {
  const errors = form.formState.errors;
  const hasError = fields.some((field) => errors[field]);
  // Stays open while one of its fields has an error; otherwise the user decides.
  const [userOpen, setUserOpen] = useState(false);
  const open = userOpen || hasError;
  return (
    <details
      open={open}
      onToggle={(event) => setUserOpen(event.currentTarget.open)}
      className="group rounded-control border border-border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-ink-700 select-none hover:text-ink-900 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border p-3">{children}</div>
    </details>
  );
}

export function StepRouter({ form, busy }: { form: Form; busy: boolean }) {
  const { register, formState } = form;
  const errors = formState.errors;
  return (
    <div className="space-y-4">
      <FormField
        label="Router name"
        required
        error={errors.name?.message}
        hint="A name you will recognise, e.g. the shop or site."
      >
        <Input autoComplete="off" disabled={busy} placeholder="Wuse branch" {...register('name')} />
      </FormField>
      <FormField
        label="Customer port"
        required
        error={errors.hotspot_interface?.message}
        hint="The interface customers connect to, exactly as WinBox shows it (e.g. bridge-hotspot or ether2). Never the internet port."
      >
        <Input
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          placeholder="bridge-hotspot"
          {...register('hotspot_interface')}
        />
      </FormField>
      <FormField label="Location" optionalLabel error={errors.location?.message}>
        <Input
          autoComplete="off"
          disabled={busy}
          placeholder="Plot 12, Wuse II, Abuja"
          {...register('location')}
        />
      </FormField>
      <Advanced form={form} fields={ADVANCED_ROUTER_FIELDS} title="More router details (optional)">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="MikroTik model"
            optionalLabel
            error={errors.model?.message}
            hint="From System → Resources."
          >
            <Input
              autoComplete="off"
              disabled={busy}
              placeholder="hAP ax²"
              {...register('model')}
            />
          </FormField>
          <FormField
            label="RouterOS version"
            optionalLabel
            error={errors.routeros_version?.message}
            hint="Setup needs 7.17 or newer."
          >
            <Input
              autoComplete="off"
              disabled={busy}
              placeholder="7.20.1"
              {...register('routeros_version')}
            />
          </FormField>
        </div>
        <FormField
          label="NAS identifier"
          optionalLabel
          error={errors.nas_identifier?.message}
          hint="Leave blank and Yarotech will create one from the router name."
        >
          <Input
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            {...register('nas_identifier')}
          />
        </FormField>
        <FormField label="Notes" optionalLabel error={errors.notes?.message}>
          <Textarea rows={2} disabled={busy} {...register('notes')} />
        </FormField>
      </Advanced>
    </div>
  );
}

function ModeOption({
  checked,
  onSelect,
  icon,
  title,
  text,
  disabled,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  text: string;
  disabled: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-card border p-3 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600',
        checked ? 'border-brand-500 bg-brand-50' : 'border-border hover:border-border-strong',
      )}
    >
      <input
        type="radio"
        name="hotspot-mode"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl [&>svg]:size-4.5',
          checked ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-500',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-600">{text}</span>
      </span>
    </label>
  );
}

export function StepNetwork({ form, busy }: { form: Form; busy: boolean }) {
  const { register, formState, watch, setValue } = form;
  const errors = formState.errors;
  const [complete, gateway, networkMode, customDhcp, natMode] = watch([
    'complete_hotspot_setup',
    'gateway_cidr',
    'network_mode',
    'custom_dhcp',
    'nat_mode',
  ]);
  const range = automaticDhcpRange(gateway);
  const routerIp = parseCidr(gateway)?.ip;
  const choose = (value: boolean) =>
    setValue('complete_hotspot_setup', value, { shouldDirty: true, shouldValidate: false });

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-ink-900">
          How should Yarotech set up this router?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeOption
            checked={complete}
            onSelect={() => choose(true)}
            disabled={busy}
            icon={<Network />}
            title="Set up a new HotSpot"
            text="Recommended. Yarotech creates the customer network, login page and HotSpot."
          />
          <ModeOption
            checked={!complete}
            onSelect={() => choose(false)}
            disabled={busy}
            icon={<PlugZap />}
            title="Connect an existing HotSpot"
            text="The router already runs a HotSpot. Yarotech only connects it to your vouchers."
          />
        </div>
      </fieldset>

      {complete ? (
        <>
          <FormField
            label="Customer network (gateway)"
            required
            error={errors.gateway_cidr?.message}
            hint="The router's address on the customer port, with its size. Use a network not already used on this router."
          >
            <Input
              autoComplete="off"
              spellCheck={false}
              inputMode="decimal"
              disabled={busy}
              placeholder="10.20.0.1/24"
              {...register('gateway_cidr')}
            />
          </FormField>
          {range && routerIp && !customDhcp && (
            <p
              className="rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-600"
              role="status"
            >
              Customers get addresses <strong className="text-ink-900">{range.first}</strong> –{' '}
              <strong className="text-ink-900">{range.last}</strong> ({range.size.toLocaleString()}{' '}
              devices). The login page lives at the router address {routerIp}.
            </p>
          )}
          <Advanced form={form} fields={ADVANCED_NETWORK_FIELDS} title="Advanced network settings">
            <FormField
              label="DHCP setup"
              hint="Create a new DHCP server, or reuse one the router already has."
            >
              <Select
                disabled={busy}
                options={[
                  { value: 'create', label: 'Create a new DHCP server (recommended)' },
                  { value: 'reuse', label: 'Reuse an existing DHCP server' },
                ]}
                {...register('network_mode')}
              />
            </FormField>
            {networkMode === 'reuse' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Existing address pool"
                  required
                  error={errors.reuse_pool?.message}
                >
                  <Input
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy}
                    {...register('reuse_pool')}
                  />
                </FormField>
                <FormField label="Existing DHCP server" required error={errors.reuse_dhcp?.message}>
                  <Input
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy}
                    {...register('reuse_dhcp')}
                  />
                </FormField>
              </div>
            )}
            <Checkbox
              label="Use my own DHCP address range"
              disabled={busy}
              {...register('custom_dhcp')}
            />
            {customDhcp && (
              <FormField label="DHCP address range" required error={errors.dhcp_range?.message}>
                <Input
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  placeholder="10.20.0.10-10.20.0.200"
                  {...register('dhcp_range')}
                />
              </FormField>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="DNS servers" required error={errors.dns_servers?.message}>
                <Input
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  {...register('dns_servers')}
                />
              </FormField>
              <FormField
                label="Login page address"
                required
                error={errors.hotspot_dns_name?.message}
                hint="Shown in customers' browsers."
              >
                <Input
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  {...register('hotspot_dns_name')}
                />
              </FormField>
            </div>
            <FormField
              label="Existing HotSpot server"
              optionalLabel
              error={errors.reuse_hotspot?.message}
              hint="Leave blank to create a new one."
            >
              <Input
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                {...register('reuse_hotspot')}
              />
            </FormField>
            <FormField
              label="Internet sharing (NAT)"
              hint="Most routers already share internet; keep the default."
            >
              <Select
                disabled={busy}
                options={[
                  { value: 'existing', label: 'Keep the router’s existing NAT (recommended)' },
                  { value: 'interface', label: 'Add NAT on an internet interface' },
                  { value: 'interface-list', label: 'Add NAT on an interface list' },
                ]}
                {...register('nat_mode')}
              />
            </FormField>
            {natMode !== 'existing' && (
              <FormField
                label="Internet (WAN) interface or list"
                required
                error={errors.wan_interface?.message}
              >
                <Input
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  placeholder="ether1"
                  {...register('wan_interface')}
                />
              </FormField>
            )}
          </Advanced>
        </>
      ) : (
        <FormField
          label="Existing HotSpot profile"
          required
          error={errors.hotspot_profile?.message}
          hint="In WinBox: IP → Hotspot → Server Profiles. Enter the profile's exact name."
        >
          <Input
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            placeholder="hsprof1"
            {...register('hotspot_profile')}
          />
        </FormField>
      )}
    </div>
  );
}

export function StepReview({ form, busy }: { form: Form; busy: boolean }) {
  const values = form.watch();
  const errors = form.formState.errors;
  const range = automaticDhcpRange(values.gateway_cidr);
  const rows: [string, string][] = [
    ['Router', values.name.trim()],
    ['Customer port', values.hotspot_interface.trim()],
    ...(values.location.trim() ? [['Location', values.location.trim()] as [string, string]] : []),
    [
      'Setup',
      values.complete_hotspot_setup
        ? 'New HotSpot created by Yarotech'
        : 'Connect existing HotSpot',
    ],
    ...((values.complete_hotspot_setup
      ? [
          ['Customer network', values.gateway_cidr.trim()],
          [
            'Customer addresses',
            values.custom_dhcp
              ? values.dhcp_range.trim()
              : range
                ? `${range.first} – ${range.last}`
                : '—',
          ],
          [
            'DHCP',
            values.network_mode === 'reuse'
              ? `Reuse ${values.reuse_dhcp.trim()} (${values.reuse_pool.trim()})`
              : 'New DHCP server',
          ],
          [
            'Internet sharing',
            values.nat_mode === 'existing'
              ? 'Keep existing NAT'
              : `Add NAT on ${values.wan_interface.trim()}`,
          ],
        ]
      : [['HotSpot profile', values.hotspot_profile.trim()]]) as [string, string][]),
  ];
  return (
    <div className="space-y-4">
      <section
        aria-labelledby="add-router-review"
        className="rounded-card border border-border bg-surface-muted p-4"
      >
        <h4
          id="add-router-review"
          className="flex items-center gap-2 text-sm font-semibold text-ink-900"
        >
          <RouterIcon aria-hidden className="size-4 text-ink-500" />
          Review before creating
        </h4>
        <dl className="mt-3 grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-ink-500">{label}</dt>
              <dd className="font-medium break-words text-ink-900">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="text-xs leading-relaxed text-ink-600">
        Nothing changes on the router yet. Next you’ll get one command to paste into the router’s
        terminal. VPN keys and the RADIUS secret are generated securely by Yarotech.
      </p>
      <div>
        <Checkbox
          label="The customer port and network above are correct for this router."
          disabled={busy}
          {...form.register('network_reviewed')}
        />
        {errors.network_reviewed && (
          <p role="alert" className="mt-1 text-xs font-medium text-danger-600">
            {errors.network_reviewed.message}
          </p>
        )}
      </div>
    </div>
  );
}
