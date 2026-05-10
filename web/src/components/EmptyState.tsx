import type { ReactNode } from 'react';

interface Props {
  title: string;
  body?: string;
  action?: ReactNode;
}

export const EmptyState = ({ title, body, action }: Props) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-card px-6 py-12 text-center">
    <h3 className="text-[17px] font-medium text-text">{title}</h3>
    {body && <p className="max-w-md text-sm text-muted">{body}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);
