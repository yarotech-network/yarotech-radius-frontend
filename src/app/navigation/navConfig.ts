import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgeDollarSign,
  Building2,
  ClipboardList,
  CreditCard,
  Home,
  LayoutDashboard,
  ListChecks,
  Radio,
  Router,
  ScrollText,
  Settings,
  ShoppingBag,
  Smartphone,
  Store,
  Ticket,
  UserCircle,
  Users,
  Wallet,
  MessageCircle,
} from 'lucide-react';
import type { Capability } from '@/services/auth/principal';
import { can, canAny, type Principal } from '@/services/auth/principal';

export interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Any of these capabilities makes the item visible. Omit = always visible on the surface. */
  capabilities?: Capability[];
  /** Match nested routes (default true). */
  end?: boolean;
  /** Show in the mobile bottom bar (max 4 + "More"). */
  mobilePrimary?: boolean;
  children?: NavItem[];
}

export interface NavGroup {
  key: string;
  label?: string;
  items: NavItem[];
}

export const WORKSPACE_NAV: NavGroup[] = [
  {
    key: 'main',
    label: 'Main',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        to: '/dashboard',
        icon: LayoutDashboard,
        end: true,
        capabilities: ['dashboard.view'],
        mobilePrimary: true,
      },
    ],
  },
  {
    key: 'network',
    label: 'Network',
    items: [
      {
        key: 'routers',
        label: 'Routers',
        to: '/routers',
        icon: Router,
        capabilities: ['routers.view'],
        mobilePrimary: true,
      },
      {
        key: 'plans',
        label: 'Service Plans',
        to: '/plans',
        icon: ListChecks,
        capabilities: ['plans.view'],
      },
    ],
  },
  {
    key: 'operations',
    label: 'Customers & Operations',
    items: [
      {
        key: 'customers',
        label: 'Customers',
        to: '/customers',
        icon: Users,
        capabilities: ['customers.view'],
      },
      {
        key: 'sessions',
        label: 'Live sessions',
        to: '/sessions',
        icon: Activity,
        capabilities: ['sessions.view'],
      },
      {
        key: 'vouchers',
        label: 'Vouchers',
        to: '/vouchers',
        icon: Ticket,
        capabilities: ['vouchers.view', 'vouchers.generate'],
        mobilePrimary: true,
      },
      {
        key: 'storefront',
        label: 'Storefront',
        to: '/storefront',
        icon: ShoppingBag,
        capabilities: ['settings.profile'],
      },
      {
        key: 'whatsapp', label: 'WhatsApp', to: '/whatsapp', icon: MessageCircle,
        capabilities: ['whatsapp.view'],
      },
      {
        key: 'agents',
        label: 'Agents',
        to: '/agents',
        icon: Store,
        capabilities: ['agents.manage'],
      },
      {
        key: 'devices',
        label: 'IoT / MAC Devices',
        to: '/devices',
        icon: Smartphone,
        capabilities: ['devices.view'],
      },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    items: [
      {
        key: 'payments',
        label: 'Payments',
        to: '/payments',
        icon: CreditCard,
        capabilities: ['payments.view'],
        mobilePrimary: true,
        end: true,
      },
      {
        key: 'recovery',
        label: 'Payment Recovery',
        to: '/payments/recovery',
        icon: Activity,
        capabilities: ['payments.recovery.view'],
      },
    ],
  },
  {
    key: 'system',
    label: 'System',
    items: [
      {
        key: 'settings',
        label: 'Settings',
        to: '/settings',
        end: false,
        icon: Settings,
        capabilities: ['settings.profile', 'settings.billing', 'subscription.view'],
      },
      {
        key: 'audit',
        label: 'Audit log',
        to: '/audit',
        icon: ScrollText,
        capabilities: ['audit.view'],
      },
    ],
  },
];

export const PLATFORM_NAV: NavGroup[] = [
  {
    key: 'platform',
    items: [
      {
        key: 'overview',
        label: 'Dashboard',
        to: '/platform',
        icon: LayoutDashboard,
        end: true,
        mobilePrimary: true,
      },
      {
        key: 'tenants',
        label: 'Tenants',
        to: '/platform/tenants',
        icon: Building2,
        mobilePrimary: true,
      },
      {
        key: 'routers',
        label: 'Router fleet',
        to: '/platform/routers',
        icon: Radio,
        mobilePrimary: true,
      },
      {
        key: 'payments',
        label: 'Payments',
        to: '/platform/payments',
        icon: BadgeDollarSign,
        mobilePrimary: true,
      },
      {
        key: 'business-plans',
        label: 'Business plans',
        to: '/platform/business-plans',
        icon: BadgeDollarSign,
      },
      { key: 'staff', label: 'Staff', to: '/platform/staff', icon: Users },
      { key: 'audit', label: 'Audit log', to: '/platform/audit', icon: ClipboardList },
      { key: 'whatsapp', label: 'WhatsApp', to: '/platform/whatsapp', icon: MessageCircle },
    ],
  },
];

export const AGENT_NAV: NavItem[] = [
  { key: 'home', label: 'Home', to: '/agent', icon: Home, end: true },
  { key: 'sell', label: 'Sell', to: '/agent/sell', icon: ShoppingBag },
  { key: 'wallet', label: 'Wallet', to: '/agent/wallet', icon: Wallet },
  { key: 'vouchers', label: 'Vouchers', to: '/agent/vouchers', icon: Ticket },
  { key: 'profile', label: 'Profile', to: '/agent/profile', icon: UserCircle },
];

function filterItems(items: NavItem[], principal: Principal | null): NavItem[] {
  return items
    .filter((item) => !item.capabilities || canAny(principal, item.capabilities))
    .map((item) => ({
      ...item,
      ...(item.children ? { children: filterItems(item.children, principal) } : {}),
    }));
}

export function flattenNavItems(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])]));
}

export function visibleGroups(groups: NavGroup[], principal: Principal | null): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterItems(group.items, principal),
    }))
    .filter((group) => group.items.length > 0);
}

export function visibleItems(groups: NavGroup[], principal: Principal | null): NavItem[] {
  return visibleGroups(groups, principal).flatMap((g) => g.items);
}

/** Mobile bottom bar: up to four primary items the principal can see. */
export function mobilePrimaryItems(groups: NavGroup[], principal: Principal | null): NavItem[] {
  const items = visibleItems(groups, principal);
  const primary = items.filter((i) => i.mobilePrimary);
  const picked = primary.length >= 2 ? primary : items;
  return picked.slice(0, 4);
}

export { can };
