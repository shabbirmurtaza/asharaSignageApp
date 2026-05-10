import { useEffect, useRef, useState } from 'react';
import { ChevronRight, MoreVertical } from 'lucide-react';
import { TypeBadge } from '@/components/TypeBadge';
import type { Status } from '@/lib/rbac';
import type { PipelineUsage } from './api';
import { nextStatuses, COLUMN_LABEL, isPipelineStatus } from './transitions';

interface Props {
  usage: PipelineUsage;
  onTransition: (id: string, from: Status, to: Status) => void;
  onDragStart: (usage: PipelineUsage) => void;
  onDragEnd: () => void;
}

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

export const KanbanCard = ({
  usage,
  onTransition,
  onDragStart,
  onDragEnd,
}: Props) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const next = nextStatuses(usage.status);
  const primary = next.find((to) => isPipelineStatus(to));

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div
      ref={menuRef as never}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/usage-id', usage.id);
        onDragStart(usage);
      }}
      onDragEnd={onDragEnd}
      className="kcard relative"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="nm flex-1">
          {usage.sign?.canonical_name ?? 'Unknown sign'}
        </div>
        <button
          type="button"
          aria-label="Card actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="-mr-1 -mt-1 rounded p-1 text-muted hover:bg-surface hover:text-text focus:outline-none focus:ring-2 focus:ring-text/30"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      <div className="meta">
        <span>{usage.department?.name ?? '—'}</span>
        <span className="qty">×{usage.qty}</span>
      </div>
      <div className="meta">
        <span>
          {usage.venue?.name ?? '—'}
          {usage.zone?.name ? ` · ${usage.zone.name}` : ''}
        </span>
        <span>{usage.size?.label ?? ''}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {usage.sign?.sign_type?.name && (
          <TypeBadge type={usage.sign.sign_type.name} />
        )}
        <span className="text-[10px] text-hint">
          {formatRelative(usage.updated_at)}
        </span>
      </div>

      {primary && (
        <button
          type="button"
          onClick={() => onTransition(usage.id, usage.status, primary)}
          className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1 rounded-sm border border-border-default bg-card text-meta font-medium text-text transition hover:border-border-strong hover:bg-surface focus:outline-none focus:ring-2 focus:ring-text/30"
          aria-label={`Advance to ${isPipelineStatus(primary) ? COLUMN_LABEL[primary] : primary}`}
        >
          Advance
          <ChevronRight size={12} />
          <span className="text-muted">
            {isPipelineStatus(primary) ? COLUMN_LABEL[primary] : primary}
          </span>
        </button>
      )}

      {menuOpen && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-2 top-8 z-20 min-w-[160px] rounded-md border border-border-default bg-card py-1 shadow-md"
          >
            {next.length === 0 && (
              <div className="px-3 py-1.5 text-meta text-muted">No actions</div>
            )}
            {next.map((to) => {
              const label = isPipelineStatus(to)
                ? `Move to ${COLUMN_LABEL[to]}`
                : `Mark ${to}`;
              return (
                <button
                  key={to}
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-1.5 text-left text-meta text-text hover:bg-surface focus:bg-surface focus:outline-none"
                  onClick={() => {
                    setMenuOpen(false);
                    onTransition(usage.id, usage.status, to);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
