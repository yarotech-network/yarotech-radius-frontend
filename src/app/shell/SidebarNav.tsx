import { useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { ChevronDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { NavGroup, NavItem } from '@/app/navigation/navConfig';
import { prefetchRoute } from '@/app/navigation/prefetch';
import { cn } from '@/lib/utilities/cn';

function NavigationItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const id = useId();
  const children = item.children ?? [];
  const active =
    pathname === item.to ||
    (!item.end && pathname.startsWith(`${item.to}/`)) ||
    children.some(
      (child) => pathname === child.to || (!child.end && pathname.startsWith(`${child.to}/`)),
    );
  // A new route reveals its active branch without discarding an explicit toggle on this route.
  const [toggle, setToggle] = useState<{ path: string; open: boolean } | null>(null);
  const open = toggle?.path === pathname ? toggle.open : active;
  return (
    <li>
      <div className={cn('sidebar-row', active && 'sidebar-row-active')}>
        <NavLink
          to={item.to}
          end={item.end ?? false}
          title={item.label}
          onClick={onNavigate}
          onMouseEnter={() => prefetchRoute(item.to, queryClient)}
          onFocus={() => prefetchRoute(item.to, queryClient)}
          className={cn('sidebar-link', collapsed && 'sidebar-link-collapsed')}
        >
          <item.icon className="size-[18px] shrink-0" aria-hidden />
          <span className={collapsed ? 'sr-only' : 'sidebar-link-label'}>{item.label}</span>
        </NavLink>
        {!collapsed && children.length > 0 && (
          <button
            type="button"
            className="sidebar-expand"
            aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setToggle({ path: pathname, open: !open })}
          >
            <ChevronDown
              className={cn('size-4 transition-transform', open && 'rotate-180')}
              aria-hidden
            />
          </button>
        )}
      </div>
      {!collapsed && children.length > 0 && (
        <ul id={id} hidden={!open} className="sidebar-children">
          {children.map((child) => (
            <li key={child.key}>
              <NavLink
                to={child.to}
                end={child.end ?? false}
                onClick={onNavigate}
                onMouseEnter={() => prefetchRoute(child.to, queryClient)}
                onFocus={() => prefetchRoute(child.to, queryClient)}
                className={({ isActive }) =>
                  cn('sidebar-child', isActive && 'sidebar-child-active')
                }
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function SidebarNav({
  groups,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <nav aria-label="Primary" className="sidebar-navigation">
      {groups.map((group) => (
        <div key={group.key}>
          {group.label && !collapsed && <p className="sidebar-group-label">{group.label}</p>}
          {group.label && collapsed && (
            <div className="mx-3 my-2 border-t border-border" aria-hidden />
          )}
          <ul className="space-y-1">
            {group.items.map((item) => (
              <NavigationItem
                key={item.key}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
