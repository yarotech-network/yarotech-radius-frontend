import { ContactRound, MonitorSmartphone, Radio, TicketCheck } from 'lucide-react';
import { NavLink } from 'react-router';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';

const sections = [
  {
    to: '/customers',
    label: 'Access history',
    description: 'Purchases & issued vouchers',
    icon: TicketCheck,
    capability: 'customers.view',
  },
  {
    to: '/customers/devices',
    label: 'Devices',
    description: 'Observed device activity',
    icon: MonitorSmartphone,
    capability: 'customers.view',
  },
  {
    to: '/sessions',
    label: 'Live sessions',
    description: 'Connections online now',
    icon: Radio,
    capability: 'sessions.view',
  },
  {
    to: '/customers/contacts',
    label: 'Contact records',
    description: 'Saved customer profiles',
    icon: ContactRound,
    capability: 'customers.view',
  },
] as const;

export function CustomerTabs() {
  const principal = usePrincipal();
  return (
    <nav aria-label="Customer workspace sections" className="customer-section-navigation">
      <p className="mb-3 text-xs font-semibold tracking-wider text-ink-500 uppercase">
        Customer workspace
      </p>
      <div className="customer-section-links">
        {sections
          .filter((section) => can(principal, section.capability))
          .map(({ to, label, description, icon: Icon }) => (
            <NavLink
              end
              key={to}
              to={to}
              className={({ isActive }) =>
                `customer-section-link${isActive ? ' customer-section-link-active' : ''}`
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs leading-snug text-ink-500">{description}</span>
              </span>
            </NavLink>
          ))}
      </div>
    </nav>
  );
}
