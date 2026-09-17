import { NavLink } from 'react-router';
export function CustomerTabs() {
  return (
    <nav aria-label="Customer workspace" className="mb-5 flex flex-wrap gap-4">
      {(
        [
          ['/customers', 'Customers'],
          ['/customers/devices', 'Devices'],
          ['/sessions', 'Live Sessions'],
          ['/customers/contacts', 'Contact Records'],
        ] as const
      ).map(([to, label]) => (
        <NavLink
          end
          key={to}
          to={to}
          className={({ isActive }) =>
            isActive ? 'font-semibold text-brand-600 underline' : 'text-ink-500 hover:underline'
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
