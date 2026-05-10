import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  useMarkNotificationRead,
  useNotifications,
  type NotificationRow,
} from '@/features/department/notifications';

const ICONS = {
  signup_approved: CheckCircle2,
  generic: Info,
  default: AlertCircle,
} as const;

const iconFor = (type: string) =>
  (ICONS as Record<string, typeof Info>)[type] ?? ICONS.default;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
};

interface RowProps {
  n: NotificationRow;
  onMarkRead: (id: string) => void;
  pending: boolean;
}

const NotificationItem = ({ n, onMarkRead, pending }: RowProps) => {
  const Icon = iconFor(n.type);
  return (
    <li className="flex items-start gap-2 border-b border-border-default px-3 py-2.5 last:border-b-0">
      <Icon size={16} className="mt-0.5 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-text">{n.title}</p>
        {n.body && (
          <p className="line-clamp-2 text-[12px] text-muted">{n.body}</p>
        )}
        <p className="mt-1 text-[11px] text-hint">{formatTime(n.created_at)}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => onMarkRead(n.id)}
        className="shrink-0 rounded-sm border border-border-default px-2 py-1 text-[11px] text-muted transition hover:bg-surface disabled:opacity-50"
      >
        Mark read
      </button>
    </li>
  );
};

export const NotificationBell = () => {
  const session = useAuth((s) => s.session);
  const userId = session?.userId;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!session) return null;

  const items = data ?? [];
  const count = items.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-sm border border-border-strong bg-card transition hover:bg-surface"
      >
        <Bell size={15} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-md border border-border-default bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
            <p className="text-[13px] font-semibold text-text">Notifications</p>
            <span className="text-[11px] text-muted">
              {count} unread
            </span>
          </div>
          {isLoading && (
            <p className="px-3 py-6 text-center text-[12px] text-muted">
              Loading…
            </p>
          )}
          {!isLoading && count === 0 && (
            <p className="px-3 py-6 text-center text-[12px] text-muted">
              You're all caught up.
            </p>
          )}
          {count > 0 && (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  pending={markRead.isPending}
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
