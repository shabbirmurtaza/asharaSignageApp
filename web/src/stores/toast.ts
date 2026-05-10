import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastEntry {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastStore {
  toasts: ToastEntry[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push(kind, message) {
    const id = ++counter;
    set({ toasts: [...get().toasts, { id, kind, message }] });
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const useToast = () => {
  const push = useToastStore((s) => s.push);
  return {
    info: (msg: string) => push('info', msg),
    success: (msg: string) => push('success', msg),
    error: (msg: string) => push('error', msg),
  };
};
