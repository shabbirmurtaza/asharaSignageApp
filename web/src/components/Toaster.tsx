import { useToastStore } from '@/stores/toast';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

const COLOR = {
  info: 'bg-info text-white',
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
};

export const Toaster = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed top-6 right-6 z-50 flex w-[320px] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded px-4 py-3 text-[13px] shadow-lg ${COLOR[t.kind]}`}
          >
            <Icon size={16} />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-70 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
