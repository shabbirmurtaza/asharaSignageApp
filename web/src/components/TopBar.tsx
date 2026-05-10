import { LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useChromeEvent } from '@/hooks/useChromeEvent';
import { accentTokens } from '@/lib/accent';
import { RoleBadge } from './RoleBadge';
import { EventSwitcher } from './EventSwitcher';
import { NotificationBell } from './NotificationBell';

interface Props {
  onOpenMenu?: () => void;
}

export const TopBar = ({ onOpenMenu }: Props) => {
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const event = useChromeEvent();
  const accent = accentTokens(event.data?.brand_primary);
  const qc = useQueryClient();
  const navigate = useNavigate();

  if (!session) return null;

  const onLogout = () => {
    logout();
    qc.clear();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border-default bg-card">
      <div
        aria-hidden
        className="h-0.5 w-full"
        style={{ background: accent.strip }}
      />
      <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-sm text-text hover:bg-surface md:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          )}
          <h1 className="truncate text-h3 text-text">Ashara Signage</h1>
          {event.data && (
            <span
              className="ml-1 hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-meta sm:inline-flex"
              style={{
                background: accent.tint,
                borderColor: accent.border,
                color: 'var(--text)',
              }}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: accent.base }}
              />
              {event.data.year}
              {event.data.city ? ` · ${event.data.city}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:block">
            <EventSwitcher />
          </div>
          <NotificationBell />
          <div className="hidden sm:block">
            <RoleBadge role={session.primaryRole} />
          </div>
          <button
            onClick={onLogout}
            className="flex h-8 items-center gap-2 rounded-sm border border-border-strong bg-card px-2 text-body-sm transition hover:bg-surface sm:px-3"
            aria-label="Logout"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
