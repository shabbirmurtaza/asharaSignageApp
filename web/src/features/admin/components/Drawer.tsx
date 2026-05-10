import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  width?: 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  children: ReactNode;
}

const W: Record<NonNullable<Props['width']>, string> = {
  md: 'w-full max-w-md',
  lg: 'w-full max-w-lg',
  xl: 'w-full max-w-2xl',
};

export const Drawer = ({
  open,
  title,
  subtitle,
  onClose,
  width = 'lg',
  footer,
  children,
}: Props) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`relative flex ${W[width]} flex-col bg-card shadow-xl`}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between border-b border-border-default px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-text">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-surface hover:text-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="border-t border-border-default bg-surface px-5 py-3">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
};
