import type { Status } from '@/lib/rbac';

interface Props {
  status: Status;
}

export const StatusPill = ({ status }: Props) => (
  <span className={`pill pill--${status}`}>{status}</span>
);
