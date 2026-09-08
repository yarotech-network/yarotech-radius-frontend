import { Link } from 'react-router';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/app/auth/useAuth';
import { displayName, initials } from '@/services/auth/principal';

export function SidebarAccount({
  collapsed = false,
  profilePath,
  onNavigate,
}: {
  collapsed?: boolean;
  profilePath: string | null;
  onNavigate?: () => void;
}) {
  const { principal, signOut } = useAuth();
  if (!principal) return null;
  const identity = (
    <>
      <span className="sidebar-avatar" aria-hidden>
        {initials(principal.user)}
      </span>
      {!collapsed && (
        <span className="sidebar-account-details">
          <span className="sidebar-account-name">{displayName(principal.user)}</span>
          <span className="sidebar-account-role">{principal.user.role.replaceAll('_', ' ')}</span>
          <span className="sidebar-account-email">{principal.user.email}</span>
        </span>
      )}
    </>
  );
  return (
    <div className={`sidebar-account ${collapsed ? 'sidebar-account-collapsed' : ''}`}>
      {profilePath ? (
        <Link
          to={profilePath}
          onClick={onNavigate}
          className="sidebar-identity"
          aria-label="Your profile"
        >
          {identity}
        </Link>
      ) : (
        <div className="sidebar-identity">{identity}</div>
      )}
      <button
        type="button"
        className="sidebar-signout"
        title="Sign out"
        onClick={() => {
          onNavigate?.();
          void signOut();
        }}
      >
        <LogOut className="size-4 shrink-0" aria-hidden />
        <span className={collapsed ? 'sr-only' : 'sidebar-signout-label'}>Sign out</span>
      </button>
    </div>
  );
}
