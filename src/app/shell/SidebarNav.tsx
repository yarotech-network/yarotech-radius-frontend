import { NavLink } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { NavGroup } from '@/app/navigation/navConfig';
import { prefetchRoute } from '@/app/navigation/prefetch';
import { cn } from '@/lib/utilities/cn';

/**
 * Dark-blue vertical navigation. `collapsed` renders the 72px icon rail (tablet, or user toggle).
 */
export function SidebarNav({
  groups,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const queryClient = useQueryClient();
  return (
    <nav
      aria-label="Primary"
      className="flex min-h-0 flex-1 scrollbar-thin flex-col gap-6 overflow-y-auto px-3 py-5"
    >
      {groups.map((group) => (
        <div key={group.key}>
          {group.label && !collapsed && (
            <p className="sidebar-group-label px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-brand-300/80 uppercase">
              {group.label}
            </p>
          )}
          {group.label && collapsed && <div className="mx-3 my-2 h-px bg-white/10" aria-hidden />}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const link = (
                <NavLink
                  to={item.to}
                  end={item.end ?? false}
                  title={item.label}
                  onClick={onNavigate}
                  onMouseEnter={() => prefetchRoute(item.to, queryClient)}
                  onFocus={() => prefetchRoute(item.to, queryClient)}
                  className={({ isActive }) =>
                    cn(
                      'sidebar-link group relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors motion-reduce:transition-none',
                      'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70',
                      isActive
                        ? 'bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-md ring-1 shadow-black/10 ring-white/15'
                        : 'text-brand-100/80 hover:bg-white/8 hover:text-white',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <item.icon className="size-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="sidebar-link-label truncate">{item.label}</span>}
                  {collapsed && <span className="sr-only">{item.label}</span>}
                </NavLink>
              );
              return <li key={item.key}>{link}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
