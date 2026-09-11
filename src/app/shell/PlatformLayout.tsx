import { PLATFORM_NAV } from '@/app/navigation/navConfig';
import { AppShell } from './AppShell';

export function PlatformLayout() {
  return (
    <AppShell
      groups={PLATFORM_NAV}
      homePath="/platform"
      profilePath={null}
      accent="platform"
      topBarStart={
        <span className="truncate text-sm font-medium text-ink-700">Platform console</span>
      }
    />
  );
}
