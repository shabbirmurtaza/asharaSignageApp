import type { ReactNode } from 'react';

interface Props {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export const FormField = ({ label, hint, error, children }: Props) => (
  <label className="mb-3 block">
    <span className="mb-1 block text-[12px] font-medium text-text">
      {label}
    </span>
    {children}
    {hint && !error && (
      <span className="mt-1 block text-[11px] text-hint">{hint}</span>
    )}
    {error && (
      <span className="mt-1 block text-[11px] text-danger">{error}</span>
    )}
  </label>
);

export const inputCls =
  'block w-full rounded border border-border-default bg-card px-2.5 py-1.5 text-[13px] text-text outline-none focus:border-text focus:ring-1 focus:ring-text/20';
