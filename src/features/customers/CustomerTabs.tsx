import { Radio, TicketCheck } from 'lucide-react';
import { NavLink } from 'react-router';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { cn } from '@/lib/utilities/cn';

const sections = [
  {
    to: '/customers',
    label: 'Customers',
    icon: TicketCheck,
    capability: 'customers.view',
  },
  {
    to: '/sessions',
    label: 'Live sessions',
    icon: Radio,
    capability: 'sessions.view',
  },
] as const;

/** Switches between the customer list and who is connected right now. */
export function CustomerTabs() {
  const principal = usePrincipal();
  const visible = sections.filter((section) => can(principal, section.capability));
  if (visible.length < 2) return null;
  return (
    <nav aria-label="Customer workspace sections" className="border-b border-border">
      <div className="-mb-px flex gap-1 overflow-x-auto">
        {visible.map(({ to, label, icon: Icon }) => (
          <NavLink
            end
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-ink-500 hover:text-ink-900',
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
