import { NavLink } from 'react-router';
export function ServicePlansNav() {
  return (
    <nav
      aria-label="Service plan sections"
      className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface-muted p-1.5"
    >
      {[
        ['/plans', 'Hotspot plans'],
        ['/plans/bandwidth', 'Bandwidth control'],
        ['/devices', 'IoT / MAC devices'],
      ].map(([to, label]) => (
        <NavLink
          key={to}
          to={to!}
          end
          className={({ isActive }) =>
            `rounded-lg px-4 py-2 text-sm font-semibold ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-600 hover:bg-white'}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
