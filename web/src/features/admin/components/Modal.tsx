import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export const Modal = ({ open, title, onClose, children, footer }: Props) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md overflow-hidden rounded-lg bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-surface hover:text-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="px-5 py-4 text-[13px] text-text">{children}</div>
        {footer && (
          <footer className="border-t border-border-default bg-surface px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};
