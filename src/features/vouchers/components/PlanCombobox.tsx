import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui';
import { formatKobo } from '@/lib/formatting/money';
import type { InternetPlan } from '@/types/api';

/** Searchable selector for the tenant's active voucher plans. */
export function PlanCombobox({
  plans,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  id,
  'aria-describedby': describedBy,
}: {
  plans: InternetPlan[];
  value: number;
  onChange: (id: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-describedby'?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = plans.find((plan) => plan.id === value);
  const matches = plans.filter((plan) =>
    `${plan.name} ${plan.price_display}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  function choose(plan: InternetPlan) {
    onChange(plan.id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpen(false);
        onBlur?.();
      }
    }}>
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        aria-describedby={describedBy}
        invalid={Boolean(invalid)}
        autoComplete="off"
        disabled={disabled}
        placeholder="Search or choose a plan"
        value={open ? query : selected?.name ?? ''}
        onFocus={() => {
          setQuery('');
          setActive(0);
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          onChange(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setActive(0);
            } else if (matches.length) {
              setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
            }
          }
          if (event.key === 'Enter' && open && matches[active]) {
            event.preventDefault();
            choose(matches[active]);
          }
        }}
        trailingSlot={<ChevronDown className="size-4 text-ink-500" aria-hidden />}
      />
      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-control border border-border bg-surface p-1 shadow-lg"
        >
          {matches.length ? matches.map((plan, index) => (
            <button
              key={plan.id}
              id={`${listId}-${plan.id}`}
              type="button"
              role="option"
              aria-selected={plan.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(plan)}
              onMouseEnter={() => setActive(index)}
              className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm text-ink-900 hover:bg-surface-muted ${index === active ? 'bg-surface-muted' : ''}`}
            >
              <span className="min-w-0 truncate">{plan.name} <span className="text-ink-500">· {formatKobo(plan.price)}</span></span>
              {plan.id === value && <Check className="size-4 shrink-0 text-brand-600" aria-hidden />}
            </button>
          )) : <p className="px-3 py-2 text-sm text-ink-500">No matching plans</p>}
        </div>
      )}
    </div>
  );
}
