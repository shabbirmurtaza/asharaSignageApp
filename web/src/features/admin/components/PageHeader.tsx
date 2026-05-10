import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ title, subtitle, actions }: Props) => (
  <div className="mb-5 flex items-end justify-between gap-4">
    <div>
      <h1 className="text-xl font-semibold text-text">{title}</h1>
      {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
